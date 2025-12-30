### File Store

The file store is responsible for maintaining a record of a user's files. The file store must be an interface that supports various storage backends. Supported backends will include s3 and local file store.

* The file store uses a postgres database to maintain access control to the storage backends. The schema contains a table called `user_files`.

* The file store interface must support basic CRUD operations on files. The file store must provide an authorization callback to make sure the user is allowed to perform the required action on the file.

* local_fs storage backend is the default implementation. This is not suitable for production. For production use you need to consider block storage for your containers and make sure the file is not stored on ephemeral disks.

* `user_files` schema
file_id: string
original_filename: string
user_id: string
file_uri: string
is_deleted: boolean
create_date: datetime
update_date: datetime

Implement the file_store using sqlalchemy and the predefined user file in file_store.py

