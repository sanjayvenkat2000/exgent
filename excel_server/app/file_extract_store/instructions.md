### File Extract Store
A File Extract store maintains a versioned store that save the outputs for a specific sheet. Remember we are processing Excel files in this workflow and Excel files have 1 or more sheets.

The file extract store stores its payload (JSON) as a string in the database.

The db schema for the table `file_info` is as follows
class FileInfo(BaseModel):
    user_id: str
    file_id: str
    sheet_idx: int
    payload: str
    updated_by: str
    version: int
    create_time: datetime

The file extract store will be implemented using SQLAlchemey.

Requirements
1. The file_info is an append only table and increments its version when a data is added. Consider opportunistic locking to make sure we get all updates and no version conflict.

2. Put your implementation in file_extract_store.py.  

3. Add methods to get the history of all updates given a file_id and sheet_idx. 

4. Add a methods to get the latest file_info given the file_id and sheet_idx.

5. Similar to excel_server/app/file_store/file_store.py, add a auth_callback that checks if the user can 'read' or 'update' the file before responding. if not raise a permission error.

Refer to excel_server/app/file_store/file_store.py for implememation style.

Write a test in the tests folder.
