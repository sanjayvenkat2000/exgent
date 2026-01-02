import csv
import io
import json
import os
from contextlib import asynccontextmanager
from typing import List, Optional

import uvicorn
from app.domain import (
    FileDetailResponse,
    SheetData,
    SheetInfo,
    SheetInfoPayload,
    UserFile,
)
from app.exgent.agent import excel_tag_agent
from app.file_store.file_store import FileStore, LocalFileStoreBackend
from app.server.excel_utils import (
    convert_excel_to_sheet_data,
    get_sheet_data,
    get_workbook_sheets,
)
from app.sheet_info_store.sheet_info_store import SheetInfoStore
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from google.adk.agents.run_config import RunConfig, StreamingMode
from google.adk.apps.app import App
from google.adk.artifacts.in_memory_artifact_service import InMemoryArtifactService
from google.adk.memory.in_memory_memory_service import InMemoryMemoryService
from google.adk.runners import Runner
from google.adk.sessions.database_session_service import DatabaseSessionService
from google.adk.utils.context_utils import Aclosing
from google.genai.types import Content, Part
from pydantic import BaseModel

# --- Configuration ---
load_dotenv()

BASE_STORAGE_DIR = os.getenv("base_storage_dir")
if BASE_STORAGE_DIR is None:
    raise ValueError("base_storage_dir environment variable is not set")

# --- Dependencies ---
file_store: Optional[FileStore] = None
sheet_info_store: Optional[SheetInfoStore] = None
runner: Optional[Runner] = None
session_service: Optional[DatabaseSessionService] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global file_store, sheet_info_store, session_service, adk_runner

    # Initialize FileStore
    if not BASE_STORAGE_DIR:
        raise ValueError("base_storage_dir environment variable is not set")

    if not os.path.exists(BASE_STORAGE_DIR):
        os.makedirs(BASE_STORAGE_DIR, exist_ok=True)

    fs_db_path = os.path.join(BASE_STORAGE_DIR, "file_store", "file_store_db.sqllite")
    fs_files_path = os.path.join(BASE_STORAGE_DIR, "file_store", "files")

    # Ensure directories exist
    os.makedirs(os.path.dirname(fs_db_path), exist_ok=True)
    os.makedirs(os.path.dirname(fs_files_path), exist_ok=True)

    file_store = FileStore(
        db_url=f"sqlite:///{fs_db_path}",
        backend=LocalFileStoreBackend(base_path=fs_files_path),
    )

    # Initialize FileExtractStore
    fes_db_path = os.path.join(
        BASE_STORAGE_DIR, "file_extract_store", "file_extract_store_db.sqllite"
    )

    # Ensure directories exist
    os.makedirs(os.path.dirname(fes_db_path), exist_ok=True)
    sheet_info_store = SheetInfoStore(db_url=f"sqlite:///{fes_db_path}")

    # Initialize SessionService
    session_db_path = os.path.join(
        BASE_STORAGE_DIR, "session_store", "session_store_db.sqllite"
    )
    os.makedirs(os.path.dirname(session_db_path), exist_ok=True)
    session_service = DatabaseSessionService(db_url=f"sqlite:///{session_db_path}")

    memory_service = InMemoryMemoryService()
    artifact_service = InMemoryArtifactService()

    # 1. Wrap the pre-loaded agent in an App instance
    # This replicates the 'if isinstance(agent_or_app, BaseAgent):' block
    agentic_app = App(
        name="excel_tag",
        root_agent=excel_tag_agent,
        plugins=[],  # You can add any necessary plugins here
    )

    adk_runner = Runner(
        app=agentic_app,
        artifact_service=artifact_service,
        session_service=session_service,
        memory_service=memory_service,
    )

    yield


app = FastAPI(lifespan=lifespan)

# --- CORS ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Models ---


class FileUpdate(BaseModel):
    original_filename: Optional[str] = None


# --- Helper Dependencies ---


def get_user_id():
    return "user_one"


def get_file_store() -> FileStore:
    if file_store is None:
        raise HTTPException(status_code=500, detail="FileStore not initialized")
    return file_store


def get_sheet_info_store() -> SheetInfoStore:
    if sheet_info_store is None:
        raise HTTPException(status_code=500, detail="SheetInfoStore not initialized")
    return sheet_info_store


def get_runner() -> Runner:
    if adk_runner is None:
        raise HTTPException(status_code=500, detail="Runner not initialized")
    return adk_runner


def get_session_service() -> DatabaseSessionService:
    if session_service is None:
        raise HTTPException(status_code=500, detail="SessionService not initialized")
    return session_service


# --- Routes ---


@app.get("/")
def read_root():
    return {"message": "Hello, World!"}


@app.get("/files", response_model=List[UserFile])
def list_files(
    user_id: str = Depends(get_user_id), store: FileStore = Depends(get_file_store)
):
    return store.list_files(user_id)


@app.delete("/files/{file_id}", response_model=UserFile)
def delete_file(
    file_id: str,
    user_id: str = Depends(get_user_id),
    store: FileStore = Depends(get_file_store),
):
    try:
        return store.delete_file(user_id, file_id)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/files/{file_id}", response_model=FileDetailResponse)
def get_file_details(
    file_id: str,
    user_id: str = Depends(get_user_id),
    f_store: FileStore = Depends(get_file_store),
    sheet_info_store: SheetInfoStore = Depends(get_sheet_info_store),
) -> FileDetailResponse:
    try:
        # Get file metadata and content
        user_file, content = f_store.get_file(user_id, file_id)

        sheet_data_list = convert_excel_to_sheet_data(content)

        sheets = []
        sheets_data: list[SheetData] = []
        for idx, (name, sheet_data) in enumerate(sheet_data_list):
            # Get latest extract for this sheet
            extract = sheet_info_store.get_latest(user_id, file_id, idx)
            sheets.append(
                SheetInfo(
                    user_id=user_id,
                    file_id=file_id,
                    sheet_idx=idx,
                    sheet_name=name,
                    payload=extract.payload if extract is not None else None,
                    version=extract.version if extract is not None else 0,
                )
            )
            sheets_data.append(sheet_data)

        return FileDetailResponse(
            **user_file.model_dump(), sheets=sheets, sheets_data=sheets_data
        )

    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/sheets/{file_id}", response_model=list[str])
def get_sheet_names(
    file_id: str,
    user_id: str = Depends(get_user_id),
    f_store: FileStore = Depends(get_file_store),
) -> list[str]:
    user_file, content = f_store.get_file(user_id, file_id)
    return get_workbook_sheets(content)


@app.get("/sheetdata/{file_id}/{sheet_idx}", response_model=SheetData)
def get_sheet_data_by_index(
    file_id: str,
    sheet_idx: int,
    user_id: str = Depends(get_user_id),
    f_store: FileStore = Depends(get_file_store),
) -> SheetData:
    user_file, content = f_store.get_file(user_id, file_id)
    return get_sheet_data(content, sheet_idx)


@app.get("/sheetinfo/{file_id}/{sheet_idx}", response_model=SheetInfo)
def get_sheet_info_by_index(
    file_id: str,
    sheet_idx: int,
    user_id: str = Depends(get_user_id),
    sheet_info_store: SheetInfoStore = Depends(get_sheet_info_store),
) -> Optional[SheetInfo]:
    result = sheet_info_store.get_latest(user_id, file_id, sheet_idx)
    return (
        result
        if result is not None
        else SheetInfo(
            user_id=user_id,
            file_id=file_id,
            sheet_idx=sheet_idx,
            sheet_name="",
            payload=None,
            version=0,
        )
    )


class UpdateSheetInfoRequest(BaseModel):
    sheet_name: str
    payload: Optional[SheetInfoPayload] = None


@app.post("/sheetinfo/{file_id}/{sheet_idx}", response_model=SheetInfo)
def update_sheet_info(
    file_id: str,
    sheet_idx: int,
    request: UpdateSheetInfoRequest,
    user_id: str = Depends(get_user_id),
    sheet_info_store: SheetInfoStore = Depends(get_sheet_info_store),
) -> SheetInfo:
    try:
        sheet_name = request.sheet_name
        payload = request.payload
        return sheet_info_store.add_sheet_info(
            user_id, file_id, sheet_idx, sheet_name, payload
        )
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def list_to_csv_string(data: list[list[str]]) -> str:
    # 1. Create an in-memory text buffer
    output = io.StringIO()

    # 2. Initialize the writer
    # lineterminator='\n' ensures consistent line endings across OS platforms
    writer = csv.writer(output, quoting=csv.QUOTE_NONNUMERIC, lineterminator="\n")

    # 3. Write all rows
    writer.writerows(data)

    # 4. Retrieve the string and return it
    return output.getvalue()


@app.post("/analyze_sheet/{file_id}/{sheet_idx}")
async def analyze_file_sheet(
    file_id: str,
    sheet_idx: int,
    user_id: str = Depends(get_user_id),
    f_store: FileStore = Depends(get_file_store),
    sheet_info_store: SheetInfoStore = Depends(get_sheet_info_store),
    runner: Runner = Depends(get_runner),
    session_service: DatabaseSessionService = Depends(get_session_service),
) -> StreamingResponse:
    # Check if file exists
    try:
        f_store.get_file_metadata(user_id, file_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="File not found")

    session_id = f"{file_id}_{sheet_idx}"
    user_file, content = f_store.get_file(user_id, file_id)
    sheet_data_list = convert_excel_to_sheet_data(content, [sheet_idx])
    sheet_name, sheet_data = sheet_data_list[0]

    # Convert the sheet data to a csv string
    excel_file_data = list_to_csv_string(sheet_data.data)

    session = await session_service.get_session(
        app_name="excel_tag", user_id=user_id, session_id=session_id
    )
    if not session:
        session = await session_service.create_session(
            app_name="excel_tag", user_id=user_id, session_id=session_id
        )
        if not session:
            raise HTTPException(status_code=500, detail="Failed to create session")

    async def event_generator():
        try:
            async with Aclosing(
                runner.run_async(
                    user_id=user_id,
                    session_id=session_id,
                    new_message=Content(parts=[Part(text="")], role="user"),
                    state_delta={
                        "excel_file_data": excel_file_data,
                    },
                    run_config=RunConfig(
                        streaming_mode=StreamingMode.SSE,
                        custom_metadata={
                            "sheet_info_store": sheet_info_store,
                            "file_id": file_id,
                            "sheet_idx": sheet_idx,
                            "sheet_name": sheet_name,
                        },
                    ),
                )
            ) as agen:
                async for event in agen:
                    if hasattr(event, "model_dump"):
                        data = json.dumps(event.model_dump(), default=str)
                    elif hasattr(event, "dict"):
                        data = json.dumps(event.dict(), default=str)
                    else:
                        data = json.dumps(event, default=str)
                    yield f"data: {data}\n\n"
        except Exception as e:
            error_data = json.dumps({"error": str(e)})
            yield f"event: error\ndata: {error_data}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")

    # return {"message": "Analysis started", "file_id": file_id, "sheet_idx": sheet_idx}


@app.post("/upload", response_model=UserFile)
async def upload_file(
    file: UploadFile = File(...),
    user_id: str = Depends(get_user_id),
    store: FileStore = Depends(get_file_store),
) -> UserFile:
    content = await file.read()
    filename = file.filename or "unknown"
    return store.create_file(user_id, filename, content)


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8080)
