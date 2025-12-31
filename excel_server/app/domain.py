from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

########################################################
# Server Models
########################################################


class ReportGroup(BaseModel):
    name: str
    header_rows: list[int]
    line_items: list[int]
    total: int


class SheetStructure(BaseModel):
    statement_type: str
    financial_items_column: int
    date_columns: list[int]
    groups: list[ReportGroup]


class SheetTag(BaseModel):
    row: int
    tag: str


class SheetInfoPayload(BaseModel):
    structure: SheetStructure
    tags: list[SheetTag]


########################################################
# Database Storage Models
########################################################
class UserFile(BaseModel):
    file_id: str
    original_filename: str
    user_id: str
    file_uri: str
    create_date: datetime
    update_date: datetime
    is_deleted: bool


class SheetInfo(BaseModel):
    user_id: str = Field(description="The user who uploaded the file")
    file_id: str
    payload: Optional[SheetInfoPayload] = None
    sheet_name: str
    sheet_idx: int
    version: int
