import logging
from datetime import datetime
from typing import Callable, List, Optional

from pydantic import BaseModel, Field
from sqlalchemy import (
    DateTime,
    Integer,
    String,
    Text,
    create_engine,
    func,
    select,
)
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Mapped, declarative_base, mapped_column, sessionmaker

# Logging setup
logger = logging.getLogger(__name__)

Base = declarative_base()


class FileExtractInfo(BaseModel):
    user_id: str = Field(description="The user who uploaded the file")
    file_id: str
    sheet_idx: int
    payload: str
    updated_by: str = Field(
        description="The user_id or 'model_name' of who updated the file"
    )
    version: int
    create_time: datetime


class FileExtractModel(Base):
    __tablename__ = "file_info"

    file_id: Mapped[str] = mapped_column(String, primary_key=True)
    sheet_idx: Mapped[int] = mapped_column(Integer, primary_key=True)
    version: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[str] = mapped_column(String, primary_key=True)

    payload: Mapped[str] = mapped_column(Text)
    updated_by: Mapped[str] = mapped_column(String)
    create_time: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    def to_pydantic(self) -> FileExtractInfo:
        return FileExtractInfo(
            user_id=self.user_id,
            file_id=self.file_id,
            sheet_idx=self.sheet_idx,
            payload=self.payload,
            updated_by=self.updated_by,
            version=self.version,
            create_time=self.create_time,
        )


class FileExtractStore:
    def __init__(
        self,
        db_url: str,
        auth_callback: Optional[Callable[[str, str, Optional[str]], bool]] = None,
    ):
        self.engine = create_engine(db_url)
        Base.metadata.create_all(self.engine)
        self.SessionLocal = sessionmaker(
            autocommit=False, autoflush=False, bind=self.engine
        )
        self.auth_callback = auth_callback

    def _check_auth(
        self, user_id: str, action: str, file_id: Optional[str] = None
    ) -> None:
        if self.auth_callback:
            if not self.auth_callback(user_id, action, file_id):
                raise PermissionError(
                    f"User {user_id} not authorized to {action} file {file_id}"
                )

    def add_extract(
        self, user_id: str, file_id: str, sheet_idx: int, payload: str
    ) -> FileExtractInfo:
        # Check update permission on the file
        self._check_auth(user_id, "update", file_id)

        with self.SessionLocal() as session:
            # Get current max version
            stmt = select(func.max(FileExtractModel.version)).where(
                FileExtractModel.file_id == file_id,
                FileExtractModel.sheet_idx == sheet_idx,
            )
            max_version = session.execute(stmt).scalar()
            new_version = (max_version if max_version is not None else 0) + 1

            new_extract = FileExtractModel(
                user_id=user_id,
                file_id=file_id,
                sheet_idx=sheet_idx,
                payload=payload,
                updated_by=user_id,
                version=new_version,
                create_time=datetime.utcnow(),
            )

            try:
                session.add(new_extract)
                session.commit()
                session.refresh(new_extract)
                return new_extract.to_pydantic()
            except IntegrityError:
                session.rollback()
                raise ValueError("Version conflict. Please try again.")

    def get_history(
        self, user_id: str, file_id: str, sheet_idx: int
    ) -> List[FileExtractInfo]:
        self._check_auth(user_id, "read", file_id)
        with self.SessionLocal() as session:
            stmt = (
                select(FileExtractModel)
                .where(
                    FileExtractModel.file_id == file_id,
                    FileExtractModel.sheet_idx == sheet_idx,
                )
                .order_by(FileExtractModel.version.asc())
            )
            results = session.execute(stmt).scalars().all()
            return [r.to_pydantic() for r in results]

    def get_latest(
        self, user_id: str, file_id: str, sheet_idx: int
    ) -> Optional[FileExtractInfo]:
        self._check_auth(user_id, "read", file_id)
        with self.SessionLocal() as session:
            stmt = (
                select(FileExtractModel)
                .where(
                    FileExtractModel.file_id == file_id,
                    FileExtractModel.sheet_idx == sheet_idx,
                )
                .order_by(FileExtractModel.version.desc())
                .limit(1)
            )
            result = session.execute(stmt).scalar()
            return result.to_pydantic() if result else None
