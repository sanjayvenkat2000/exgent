# Hacking an excel agent

## Overview
Our client is a financial institution that makes business loans to small business operating in the Consumer Packaged Goods space.  They make loans to both direct to consumer and distribution via retail stores.  

1. Before a loan is underwritten, our client needs to collect financial statements (Income Statement, Cash Flow Statement and Balance Sheets) from the borrower.
2. After a loan is granted, our client reviews the borrowers financial statements on a monthly or quarterly basis, to make sure the tenants of the loan are not violated and the financial metrics or the borrower are sound.
3. In order to perform the loan approval and loan monitoring mentioned in step 1 and 2, our client must convert the financial statement into their **internal ontology** to perform the analysis. This requires an Financial Analyst to map the borrowers accounts to internal concepts such as Marketing Expense, Admin Expense etc.  There are about 30 different concepts to map and vary based on the type of the business. 

## Problem Statement
1. It takes the analyst approxiately 30 minutes to process a financial statement.  First the analyst must read the excel files provided by the client, map it to the internal ontology, and finally make sure the numbers in the spreadsheet all add up.
2. The sheet formatting and style of reporting varies a lot between different clients.  This is the classic, easy for a human hard for a computer problem.
3. Financial Analysts are excel experts. Financial Analysts review highly accurate and reproducable results and will not tollerate any error margin.

## Solution


  
