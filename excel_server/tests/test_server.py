import os
import shutil
from pathlib import Path

import pytest
from app.domain import SheetInfoPayload, SheetStructure
from app.file_store.file_store import FileStore, LocalFileStoreBackend
from app.server.server import (
    UpdateSheetInfoRequest,
    app,
    get_file_store,
    get_sheet_info_store,
)
from app.sheet_info_store.sheet_info_store import SheetInfoStore
from fastapi.testclient import TestClient

# --- Fixtures ---


@pytest.fixture
def temp_storage_path():
    storage_dir = Path("/tmp/storage")
    if storage_dir.exists():
        shutil.rmtree(storage_dir)
    storage_dir.mkdir(parents=True, exist_ok=True)
    return str(storage_dir)


@pytest.fixture
def test_file_store(temp_storage_path):
    storage_dir = Path(temp_storage_path) / "file_store_files"
    storage_dir.mkdir()

    # Use file-based SQLite in /tmp/storage
    db_path = Path(temp_storage_path) / "file_store.db"
    db_url = f"sqlite:///{db_path}"
    backend = LocalFileStoreBackend(base_path=str(storage_dir))

    # Simple auth callback that allows everything (if needed by FileStore logic)
    def auth_callback(user_id, action, file_id=None):
        return True

    store = FileStore(db_url=db_url, backend=backend, auth_callback=auth_callback)
    return store


@pytest.fixture
def test_file_extract_store(temp_storage_path):
    # Use file-based SQLite in /tmp/storage
    db_path = Path(temp_storage_path) / "sheet_info_store_server.db"
    db_url = f"sqlite:///{db_path}"
    store = SheetInfoStore(db_url=db_url)
    return store


@pytest.fixture
def client(test_file_store, test_file_extract_store):
    # Override dependencies
    app.dependency_overrides[get_file_store] = lambda: test_file_store
    app.dependency_overrides[get_sheet_info_store] = lambda: test_file_extract_store

    with TestClient(app) as c:
        yield c

    # Clear overrides
    app.dependency_overrides.clear()


@pytest.fixture
def sample_xlsx_path():
    # Assuming test is running from project root or finding relative to this file
    current_dir = os.path.dirname(os.path.abspath(__file__))
    path = os.path.join(current_dir, "sample.xlsx")
    if not os.path.exists(path):
        # Fallback if running from root
        path = os.path.abspath("excel_server/tests/sample.xlsx")
    return path


# --- Tests ---


def test_read_root(client):
    response = client.get("/")
    assert response.status_code == 200
    assert response.json() == {"message": "Hello, World!"}


def test_upload_file(client, sample_xlsx_path):
    with open(sample_xlsx_path, "rb") as f:
        response = client.post(
            "/upload",
            files={
                "file": (
                    "sample.xlsx",
                    f,
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                )
            },
        )
    assert response.status_code == 200
    data = response.json()
    assert data["original_filename"] == "sample.xlsx"
    assert "file_id" in data


def test_list_files(client, sample_xlsx_path):
    # First upload a file
    with open(sample_xlsx_path, "rb") as f:
        client.post(
            "/upload",
            files={
                "file": (
                    "sample.xlsx",
                    f,
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                )
            },
        )

    response = client.get("/files")
    assert response.status_code == 200
    files = response.json()
    assert len(files) >= 1
    assert files[0]["original_filename"] == "sample.xlsx"


def test_get_file_details(client, sample_xlsx_path):
    # Upload
    with open(sample_xlsx_path, "rb") as f:
        upload_resp = client.post(
            "/upload",
            files={
                "file": (
                    "sample.xlsx",
                    f,
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                )
            },
        )
    file_id = upload_resp.json()["file_id"]

    # Get details
    response = client.get(f"/files/{file_id}")
    assert response.status_code == 200
    data = response.json()

    assert data["file_id"] == file_id
    # Check sheets - sample.xlsx should have some sheets
    # If sample.xlsx is empty or not parsed correctly, this might fail,
    # but based on code it tries to parse with openpyxl.
    assert "sheets" in data
    assert isinstance(data["sheets"], list)
    # If sample.xlsx has content, we expect sheets
    # We can check specific sheets if we knew the content of sample.xlsx,
    # but generic check is safer without peeking.


def test_delete_file(client, sample_xlsx_path):
    with open(sample_xlsx_path, "rb") as f:
        upload_resp = client.post(
            "/upload",
            files={
                "file": (
                    "sample.xlsx",
                    f,
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                )
            },
        )
    file_id = upload_resp.json()["file_id"]

    # Delete
    del_resp = client.delete(f"/files/{file_id}")
    assert del_resp.status_code == 200

    # Verify gone
    get_resp = client.get(f"/files/{file_id}")
    assert get_resp.status_code == 404


def test_analyze_file_sheet(client, sample_xlsx_path):
    with open(sample_xlsx_path, "rb") as f:
        upload_resp = client.post(
            "/upload",
            files={
                "file": (
                    "sample.xlsx",
                    f,
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                )
            },
        )
    file_id = upload_resp.json()["file_id"]

    # Analyze sheet 0
    response = client.post(f"/analyze/{file_id}/0")
    assert response.status_code == 200
    assert response.json() == {
        "message": "Analysis started",
        "file_id": file_id,
        "sheet_idx": 0,
    }


def test_update_extract(client, sample_xlsx_path):
    with open(sample_xlsx_path, "rb") as f:
        upload_resp = client.post(
            "/upload",
            files={
                "file": (
                    "sample.xlsx",
                    f,
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                )
            },
        )
    file_id = upload_resp.json()["file_id"]

    # Update extract for sheet 0
    payload = SheetInfoPayload(
        structure=SheetStructure(
            statement_type="test",
            financial_items_column=1,
            date_columns=[2],
            groups=[],
        ),
        tags=[],
    )
    request = UpdateSheetInfoRequest(sheet_name="sheet1", payload=payload)

    response = client.post(f"/update/{file_id}/0", json=request.model_dump())
    assert response.status_code == 200
    data = response.json()
    # assert SheetInfoPayload.model_validate_json(data["payload"]) == payload
    sheet_info_payload = SheetInfoPayload.model_validate(data["payload"])
    assert sheet_info_payload == payload
    assert data["file_id"] == file_id
    assert data["sheet_idx"] == 0
