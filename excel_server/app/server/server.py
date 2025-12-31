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
from app.file_store.file_store import FileStore, LocalFileStoreBackend
from app.server.excel_utils import convert_excel_to_sheet_data
from app.sheet_info_store.sheet_info_store import SheetInfoStore
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# --- Configuration ---
load_dotenv()

BASE_STORAGE_DIR = os.getenv("base_storage_dir")
if BASE_STORAGE_DIR is None:
    raise ValueError("base_storage_dir environment variable is not set")

# --- Dependencies ---
file_store: Optional[FileStore] = None
sheet_info_store: Optional[SheetInfoStore] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global file_store, sheet_info_store

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


# --- Routes ---


@app.get("/")
def read_root():
    return {"message": "Hello, World!"}


@app.get("/files", response_model=List[UserFile])
def list_files(
    user_id: str = Depends(get_user_id), store: FileStore = Depends(get_file_store)
):
    return store.list_files(user_id)


@app.get("/files/{file_id}", response_model=FileDetailResponse)
def get_file_details(
    file_id: str,
    user_id: str = Depends(get_user_id),
    f_store: FileStore = Depends(get_file_store),
    fe_store: SheetInfoStore = Depends(get_sheet_info_store),
) -> FileDetailResponse:
    try:
        # Get file metadata and content
        user_file, content = f_store.get_file(user_id, file_id)

        sheet_data_list = convert_excel_to_sheet_data(content)

        sheets = []
        sheets_data: list[SheetData] = []
        for idx, (name, sheet_data) in enumerate(sheet_data_list):
            # Get latest extract for this sheet
            extract = fe_store.get_latest(user_id, file_id, idx)
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


@app.post("/analyze/{file_id}/{sheet_idx}")
def analyze_file_sheet(
    file_id: str,
    sheet_idx: int,
    user_id: str = Depends(get_user_id),
    f_store: FileStore = Depends(get_file_store),
    fe_store: SheetInfoStore = Depends(get_sheet_info_store),
):
    # Check if file exists
    try:
        f_store.get_file_metadata(user_id, file_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="File not found")

    # TODO: Invoke AI workflow here.
    # For now, we'll just simulate a "processing" state or similar if needed.
    # The instructions don't specify what this should return or do exactly other than "Invokes the AI workflow".
    # We could trigger a background task.

    return {"message": "Analysis started", "file_id": file_id, "sheet_idx": sheet_idx}


class UpdateSheetInfoRequest(BaseModel):
    sheet_name: str
    payload: Optional[SheetInfoPayload] = None


@app.post("/update/{file_id}/{sheet_idx}", response_model=SheetInfo)
def update_sheet_info(
    file_id: str,
    sheet_idx: int,
    request: UpdateSheetInfoRequest,
    user_id: str = Depends(get_user_id),
    fe_store: SheetInfoStore = Depends(get_sheet_info_store),
) -> SheetInfo:
    try:
        sheet_name = request.sheet_name
        payload = request.payload
        return fe_store.add_sheet_info(user_id, file_id, sheet_idx, sheet_name, payload)
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


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
