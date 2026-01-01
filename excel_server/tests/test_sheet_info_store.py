import shutil
from pathlib import Path

import pytest
from app.domain import SheetInfoPayload, SheetStructure
from app.sheet_info_store.sheet_info_store import SheetInfoStore


@pytest.fixture
def temp_storage_path():
    storage_dir = Path("/tmp/storage")
    if storage_dir.exists():
        shutil.rmtree(storage_dir)
    storage_dir.mkdir(parents=True, exist_ok=True)
    return str(storage_dir)


@pytest.fixture
def sheet_info_store(temp_storage_path):
    # Use file-based SQLite in /tmp/storage
    db_path = Path(temp_storage_path) / "sheet_info_store.db"
    db_url = f"sqlite:///{db_path}"

    # Simple auth callback that allows everything
    def auth_callback(user_id, action, file_id=None):
        return True

    store = SheetInfoStore(db_url=db_url, auth_callback=auth_callback)
    return store


def test_add_sheet_info(sheet_info_store):
    user_id = "user123"
    file_id = "file_abc"
    sheet_idx = 0
    sheet_name = "sheet1"
    payload = None

    sheet_info = sheet_info_store.add_sheet_info(
        user_id, file_id, sheet_idx, sheet_name, payload
    )

    assert sheet_info.file_id == file_id
    assert sheet_info.sheet_idx == sheet_idx
    assert sheet_info.sheet_name == sheet_name
    assert sheet_info.payload == payload
    assert sheet_info.user_id == user_id

    latest = sheet_info_store.get_latest(user_id, file_id, sheet_idx)

    assert latest is not None
    assert latest.version == 1
    assert latest.payload == payload


def test_versioning(sheet_info_store):
    user_id = "user123"
    file_id = "file_abc"
    sheet_idx = 0
    sheet_name = "sheet1"
    extract1 = sheet_info_store.add_sheet_info(
        user_id, file_id, sheet_idx, sheet_name, None
    )
    assert extract1.version == 1
    assert extract1.payload is None

    payload1 = SheetInfoPayload(
        structure=SheetStructure(
            statement_type="test",
            financial_items_column=1,
            date_columns=[2],
            groups=[],
        ),
        tags=[],
    )

    extract2 = sheet_info_store.add_sheet_info(
        user_id,
        file_id,
        sheet_idx,
        sheet_name,
        payload1,
    )
    assert extract2.version == 2

    latest = sheet_info_store.get_latest(user_id, file_id, sheet_idx)
    assert latest.version == 2
    # assert latest.payload == payload1.model_dump_json()


def test_get_history(sheet_info_store):
    user_id = "user123"
    file_id = "file_abc"
    sheet_idx = 0
    sheet_name = "sheet1"

    payload1 = SheetInfoPayload(
        structure=SheetStructure(
            statement_type="v1",
            financial_items_column=1,
            date_columns=[2],
            groups=[],
        ),
        tags=[],
    )
    payload2 = SheetInfoPayload(
        structure=SheetStructure(
            statement_type="v2",
            financial_items_column=1,
            date_columns=[2],
            groups=[],
        ),
        tags=[],
    )
    payload3 = SheetInfoPayload(
        structure=SheetStructure(
            statement_type="v3",
            financial_items_column=1,
            date_columns=[2],
            groups=[],
        ),
        tags=[],
    )

    sheet_info_store.add_sheet_info(user_id, file_id, sheet_idx, sheet_name, payload1)
    sheet_info_store.add_sheet_info(user_id, file_id, sheet_idx, sheet_name, payload2)
    sheet_info_store.add_sheet_info(user_id, file_id, sheet_idx, sheet_name, payload3)

    history = sheet_info_store.get_history(user_id, file_id, sheet_idx)
    assert len(history) == 3
    assert [h.version for h in history] == [1, 2, 3]
    assert [h.payload.structure.statement_type for h in history] == [
        "v1",
        "v2",
        "v3",
    ]


def test_auth_callback(sheet_info_store):
    # Override auth callback to deny
    def deny_callback(user_id, action, file_id=None):
        return False

    sheet_info_store.auth_callback = deny_callback
    sheet_name = "sheet1"

    with pytest.raises(PermissionError):
        sheet_info_store.add_sheet_info("user1", "file1", 0, sheet_name, "data")

    with pytest.raises(PermissionError):
        sheet_info_store.get_latest("user1", "file1", 0)

    with pytest.raises(PermissionError):
        sheet_info_store.get_history("user1", "file1", 0)


def test_get_latest_no_results(sheet_info_store):
    user_id = "user123"
    file_id = "non_existent_file"
    sheet_idx = 0

    latest = sheet_info_store.get_latest(user_id, file_id, sheet_idx)
    assert latest is None
