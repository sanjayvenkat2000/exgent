import os
from abc import ABC, abstractmethod
from datetime import UTC, datetime
from pathlib import Path
from typing import Callable, List, Optional
from uuid import uuid4

from sqlalchemy import Boolean, DateTime, String, create_engine, select
from sqlalchemy.orm import Mapped, declarative_base, mapped_column, sessionmaker

from app.domain import UserFile


def get_utc_now():
    return datetime.now(UTC)


# SQLAlchemy Base
Base = declarative_base()


class UserFileModel(Base):
    __tablename__ = "user_files"

    file_id: Mapped[str] = mapped_column(String, primary_key=True)
    original_filename: Mapped[str] = mapped_column(String)
    user_id: Mapped[str] = mapped_column(String)
    file_uri: Mapped[str] = mapped_column(String)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False)
    create_date: Mapped[datetime] = mapped_column(DateTime, default=get_utc_now)
    update_date: Mapped[datetime] = mapped_column(
        DateTime, default=get_utc_now, onupdate=get_utc_now
    )

    def to_pydantic(self) -> UserFile:
        return UserFile(
            file_id=self.file_id,
            original_filename=self.original_filename,
            user_id=self.user_id,
            file_uri=self.file_uri,
            create_date=self.create_date,
            update_date=self.update_date,
            is_deleted=self.is_deleted,
        )


class StorageBackend(ABC):
    @abstractmethod
    def save(self, file_id: str, content: bytes) -> str:
        """Save content and return the URI."""
        pass

    @abstractmethod
    def read(self, file_uri: str) -> bytes:
        """Read content from the URI."""
        pass

    @abstractmethod
    def delete(self, file_uri: str) -> None:
        """Delete content at the URI."""
        pass


class LocalFileStoreBackend(StorageBackend):
    def __init__(self, base_path: str = "./file_storage"):
        self.base_path = Path(base_path)
        self.base_path.mkdir(parents=True, exist_ok=True)

    def save(self, file_id: str, content: bytes) -> str:
        # Simple implementation: use file_id as filename
        file_path = self.base_path / file_id
        with open(file_path, "wb") as f:
            f.write(content)
        return str(file_path.absolute())

    def read(self, file_uri: str) -> bytes:
        # In this simple implementation, file_uri is the absolute path
        with open(file_uri, "rb") as f:
            return f.read()

    def delete(self, file_uri: str) -> None:
        try:
            os.remove(file_uri)
        except FileNotFoundError:
            pass


class FileStore:
    def __init__(
        self,
        db_url: str,
        backend: StorageBackend,
        auth_callback: Optional[Callable[[str, str, Optional[str]], bool]] = None,
    ):
        """
        auth_callback signature: (user_id: str, action: str, file_id: Optional[str]) -> bool
        actions: 'create', 'read', 'delete', 'list'
        """
        self.engine = create_engine(db_url)
        Base.metadata.create_all(self.engine)
        self.SessionLocal = sessionmaker(
            autocommit=False, autoflush=False, bind=self.engine
        )
        self.backend = backend
        self.auth_callback = auth_callback

    def _check_auth(
        self, user_id: str, action: str, file_id: Optional[str] = None
    ) -> None:
        if self.auth_callback:
            if not self.auth_callback(user_id, action, file_id):
                raise PermissionError(
                    f"User {user_id} not authorized to {action} file {file_id}"
                )

    def create_file(self, user_id: str, filename: str, content: bytes) -> UserFile:
        file_id = str(uuid4())
        self._check_auth(user_id, "create", file_id)
        file_uri = self.backend.save(file_id, content)
        db_file = UserFileModel(
            file_id=file_id,
            original_filename=filename,
            user_id=user_id,
            file_uri=file_uri,
            create_date=get_utc_now(),
            update_date=get_utc_now(),
            is_deleted=False,
        )

        with self.SessionLocal() as session:
            session.add(db_file)
            session.commit()
            session.refresh(db_file)
            return db_file.to_pydantic()

    def get_file(self, user_id: str, file_id: str) -> tuple[UserFile, bytes]:
        self._check_auth(user_id, "read", file_id)
        with self.SessionLocal() as session:
            db_file = session.get(UserFileModel, file_id)
            if not db_file or db_file.is_deleted:
                raise FileNotFoundError(f"File {file_id} not found")

            content = self.backend.read(db_file.file_uri)
            return db_file.to_pydantic(), content

    def get_file_metadata(self, user_id: str, file_id: str) -> UserFile:
        with self.SessionLocal() as session:
            db_file = session.get(UserFileModel, file_id)
            if not db_file or db_file.is_deleted:
                raise FileNotFoundError(f"File {file_id} not found")
            return db_file.to_pydantic()

    def delete_file(self, user_id: str, file_id: str) -> UserFile:
        self._check_auth(user_id, "delete", file_id)

        with self.SessionLocal() as session:
            db_file = session.get(UserFileModel, file_id)
            if not db_file or db_file.is_deleted:
                raise FileNotFoundError(f"File {file_id} not found")

            # Soft delete
            db_file.is_deleted = True
            session.commit()
            session.refresh(db_file)

            return db_file.to_pydantic()

    def list_files(self, user_id: str) -> List[UserFile]:
        self._check_auth(user_id, "list")

        with self.SessionLocal() as session:
            # Listing files for the user
            stmt = select(UserFileModel).where(
                UserFileModel.user_id == user_id,
                UserFileModel.is_deleted == False,  # noqa: E712
            )
            results = session.execute(stmt).scalars().all()
            return [f.to_pydantic() for f in results]
