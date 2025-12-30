import pytest
from app.file_extract_store.file_extract_store import FileExtractStore


@pytest.fixture
def file_extract_store():
    # Use in-memory SQLite for testing
    db_url = "sqlite:///:memory:"

    # Simple auth callback that allows everything
    def auth_callback(user_id, action, file_id=None):
        return True

    store = FileExtractStore(db_url=db_url, auth_callback=auth_callback)
    return store


def test_add_extract(file_extract_store):
    user_id = "user123"
    file_id = "file_abc"
    sheet_idx = 0
    payload = '{"data": "test"}'

    extract = file_extract_store.add_extract(user_id, file_id, sheet_idx, payload)

    assert extract.file_id == file_id
    assert extract.sheet_idx == sheet_idx
    assert extract.payload == payload
    assert extract.version == 1
    assert extract.user_id == user_id

    latest = file_extract_store.get_latest(user_id, file_id, sheet_idx)
    assert latest is not None
    assert latest.version == 1
    assert latest.payload == payload


def test_versioning(file_extract_store):
    user_id = "user123"
    file_id = "file_abc"
    sheet_idx = 0

    extract1 = file_extract_store.add_extract(user_id, file_id, sheet_idx, "payload1")
    assert extract1.version == 1

    extract2 = file_extract_store.add_extract(user_id, file_id, sheet_idx, "payload2")
    assert extract2.version == 2

    latest = file_extract_store.get_latest(user_id, file_id, sheet_idx)
    assert latest.version == 2
    assert latest.payload == "payload2"


def test_get_history(file_extract_store):
    user_id = "user123"
    file_id = "file_abc"
    sheet_idx = 0

    file_extract_store.add_extract(user_id, file_id, sheet_idx, "v1")
    file_extract_store.add_extract(user_id, file_id, sheet_idx, "v2")
    file_extract_store.add_extract(user_id, file_id, sheet_idx, "v3")

    history = file_extract_store.get_history(user_id, file_id, sheet_idx)
    assert len(history) == 3
    assert [h.version for h in history] == [1, 2, 3]
    assert [h.payload for h in history] == ["v1", "v2", "v3"]


def test_auth_callback(file_extract_store):
    # Override auth callback to deny
    def deny_callback(user_id, action, file_id=None):
        return False

    file_extract_store.auth_callback = deny_callback

    with pytest.raises(PermissionError):
        file_extract_store.add_extract("user1", "file1", 0, "data")

    with pytest.raises(PermissionError):
        file_extract_store.get_latest("user1", "file1", 0)

    with pytest.raises(PermissionError):
        file_extract_store.get_history("user1", "file1", 0)
