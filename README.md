# Hacking an Excel Workflow

## Overview
Our client is a financial institution that makes business loans to small business operating in the Consumer Packaged Goods space.  They make loans to both "direct to consumer" and "distribution via retail" stores.  

1. Before a loan is underwritten, our client needs to collect financial statements (Income Statement, Cash Flow Statement and Balance Sheets) from the borrower.
2. After a loan is granted, our client reviews the borrowers financial statements on a monthly or quarterly basis, to make sure the tenants of the loan are not violated and the financial metrics or the borrower are sound.
3. In order to perform the loan approval and loan monitoring mentioned in step 1 and 2, our client must convert the financial statement into their **internal ontology** to perform the analysis. This requires an Financial Analyst to map the borrowers accounts to internal concepts such as Marketing Expense, Admin Expense etc.  There are about 30 different concepts to map and vary based on the type of the business. 

## Problem Statement
1. It takes the analyst approxiately 30 minutes to process a financial statement.  First the analyst must read the excel files provided by the client, map it to the internal ontology, and finally make sure the numbers in the spreadsheet all add up.
2. The sheet formatting and style of reporting varies a lot between different clients.  This is the classic, easy for a human hard for a computer problem.
3. Financial Analysts are excel experts. Financial Analysts review highly accurate and reproducable results and will not tolerate any error margin.
4. Being in the Financial Services industry, our client has to maintain a full audit history of all documents and decisions made by an AI or Financial Analyst. The decision making process must be capable of being reviewed. 

## Proposed Solution
Build an AI Financial Agent to handle the mundate tasks of understanding the **internal ontology** and the borrowers business.  The AI Agent must process the data, but have a human in the loop to approve the results.  This step guarantees the high-accuracy required in the financial services disipline.  This agents function can be expanded further in the future to chip away at the manual tasks performed by the Financial Analyst.

### Design Overview
The agent is built with the Google ADK toolkit server using a Fast API application.  The toolkit provides a simple agent infrastruture along with some of the basic features required for a production application. 
* The server provides the following functions.
  1. /files (GET) : Lists the files a user uploads.
  2. /files/{file_id} (GET):  Gets the files details for display ( an excel file has multiple sheets so this data is passed back ). All meta-data from processing the file are also returned in this call.
  3. /files/{file_id} (POST): Update the file meta-data from the UI.  This endpoint provides the human in the loop functionality that is required for this usecase.
  4. /files/{file_id} (DELETE): Removes the file from the listing of files. The original file is not deleted from the system.
  5. /analyze/{file_id}/{sheet_idx} (POST): Invokes the AI workflow to process the sheets data.
  6. /update/{file_id}/{sheet_idx} (POST): 

* The agent itself is exposed to the application using the Google A2A protocol.
  1. Allows our agent to join an eco-system of agents if required.
  2. Provides to authentication that is built into the protocol and not slapped on later like MCP.
  3. Negatives - the google A2A agent is a self standing JSON RPC endpoint and will run out-of-process from the server. Not required, but cleaner.
 
* The client provides the following functions
  1. Allows the user to list their files.
  2. Allows the user to view the details of their excel files.
  3. Allows the user to chat with the AI about extracting financial information from the excel sheet interactively and make the necessary corrections.

### Implementation Details

#### File Store
The file store is responsible for maintaining a record of a user's files. The file store must be an interface that supports various storage backends. Supported backends will include s3 and local file store.
  1. The file store uses a postgres database to maintain access control to the storage backends. The schema contains a table called `user_files`.
  2. The file store interface must support basic CRUD operations on files. The file store must provide an authorization callback to make sure the user is allowed to perform the required action on the file.
  3. `local_fs` storage backend is the default implementation. This is not suitable for production. For production use you need to consider block storage for your containers and make sure the file is not stored on ephemeral disks.
  4. The db table schema is described in excel_server/file_store/instructions.md

#### File Extraction Store
The file extraction store is responsible for maintaining the most upto-date information required to extract financial statement into their **internal ontology** 
  1. The db table schema is described in excel_server/file_extract_store/instruction.md 

#### Session Store
The session store records the state of an AI chat or processing step. The session store records all the events involved in a multi-step AI workflow. 
  1. The session store uses a postgres database to maintain AI chat history, tool call history, and intermediate states generated during the AI workflow.
  2. The session store implementation will be handled by Google ADK (any Agent framework should provide similar implementations).

#### Server Implementation
1. The server is implemented using FastAPI.
2. The server starts up on port 8080.
3. Make sure you add CORS headers.
4. All routes implemented must inject a dependency that obtains the user_id. Dummy function for now that returns a fixed id `user_one`. 








  
