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
 
* The client provides the following functions
  1. Allows the user to list their files.
  2. Allows the user to view the details of their excel files.
  3. Allows the user to review the AI's output and correct it as necessary.

### Implementation Details







  
