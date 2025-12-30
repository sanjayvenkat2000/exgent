import shutil
from pathlib import Path

import pytest
from app.file_store.file_store import FileStore, LocalFileStoreBackend


# Fixture for temporary storage path
@pytest.fixture
def temp_storage_path():
    storage_dir = Path("/tmp/storage")
    if storage_dir.exists():
        shutil.rmtree(storage_dir)
    storage_dir.mkdir(parents=True, exist_ok=True)
    return str(storage_dir)


# Fixture for FileStore instance
@pytest.fixture
def file_store(temp_storage_path):
    # Use file-based SQLite in /tmp/storage
    db_path = Path(temp_storage_path) / "file_store.db"
    db_url = f"sqlite:///{db_path}"
    backend = LocalFileStoreBackend(base_path=temp_storage_path)

    # Simple auth callback that allows everything
    def auth_callback(user_id, action, file_id=None):
        return True

    store = FileStore(db_url=db_url, backend=backend, auth_callback=auth_callback)
    return store


def test_create_file(file_store):
    user_id = "user123"
    filename = "test.txt"
    content = b"Hello, World!"

    user_file = file_store.create_file(user_id, filename, content)

    assert user_file.file_id is not None
    assert user_file.original_filename == filename
    assert user_file.user_id == user_id
    assert not user_file.is_deleted
    assert user_file.create_date is not None


def test_get_file(file_store):
    user_id = "user123"
    filename = "test.txt"
    content = b"Hello, World!"

    created_file = file_store.create_file(user_id, filename, content)

    fetched_meta, fetched_content = file_store.get_file(user_id, created_file.file_id)

    assert fetched_meta.file_id == created_file.file_id
    assert fetched_content == content


def test_list_files(file_store):
    user_id = "user123"

    file_store.create_file(user_id, "file1.txt", b"Content 1")
    file_store.create_file(user_id, "file2.txt", b"Content 2")

    files = file_store.list_files(user_id)
    assert len(files) == 2

    # Verify filtering by user
    file_store.create_file("other_user", "file3.txt", b"Content 3")
    files_user1 = file_store.list_files(user_id)
    assert len(files_user1) == 2


def test_delete_file(file_store):
    user_id = "user123"
    created_file = file_store.create_file(user_id, "file1.txt", b"Content 1")

    file_store.delete_file(user_id, created_file.file_id)

    # Should not be in list
    files = file_store.list_files(user_id)
    assert len(files) == 0

    # Getting it should raise FileNotFoundError
    with pytest.raises(FileNotFoundError):
        file_store.get_file(user_id, created_file.file_id)


def test_auth_callback_denial(temp_storage_path):
    db_path = Path(temp_storage_path) / "file_store_denial.db"
    db_url = f"sqlite:///{db_path}"
    backend = LocalFileStoreBackend(base_path=temp_storage_path)

    # Deny all
    def auth_callback(user_id, action, file_id=None):
        return False

    store = FileStore(db_url=db_url, backend=backend, auth_callback=auth_callback)

    with pytest.raises(PermissionError):
        store.create_file("user1", "test.txt", b"data")
