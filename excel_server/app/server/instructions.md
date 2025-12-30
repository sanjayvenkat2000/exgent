### Server

The server is a fast api implementation of the following routes.

**On app startup**
We will instantiate a file_store
The base directory information will be provided in the environment variables "base_storage_dir"
We will add "{base_storage_dir}/file_store/file_store_db.sqllite" to initialize the database for the file_store
We will use the local storage implementation and store the files in "{base_storage_dir}/file_store/files/{file_id}"

We will instantiate a file_extract_store
The base directory information will be provided in the environment variables "base_storage_dir"
We will add "{base_storage_dir}/file_extract_store/file_extract_store_db.sqllite" to initialize the database for the file_extract_store


Then implement the following routes. For the default implementations call the methods in the file_store and file_exrtact_store for the information.  we will define detailed request types a bit later. Just boiler plate routes

/files (GET) : Lists the users files 
/files/{file_id} (GET): Gets the files details for display ( an excel file has multiple sheets so this data is passed back ). All meta-data from processing the file are also returned in this call.
/files/{file_id} (DELETE): Removes the file from the listing of files. Just call the 
/analyze/{file_id}/{sheet_idx} (POST): Invokes the AI workflow to process the sheets data.
/update/{file_id}/{sheet_idx} (POST): Creates an updated entry in file_extract_store
/upload (POST): Allows a user to upload a file.

Important
Make sure you add CORS headers.

All routes implemented must inject a dependency that obtains the user_id. Dummy function for now that returns a fixed id user_one.

Implement tests for the server functionality.  You have access to sample.xlsx available in the tests folder.

