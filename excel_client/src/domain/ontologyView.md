Lets create a new file where we compute the ontologized view of the sheet OntologyView.ts

Your task is to implement this function.
export const generate_ontology_view = (sheetData: SheetData, sheetInfoPayload: SheetInfoPayload):SheetData => {
    //
}

**Instructions**
A. We will keep just the date_columns from the sheet. Create a copy of the sheetData. Use immer.
B. Determine where row_groups start. All rows above this are called header_rows.
C. For each row_group
   1. Deterime which rows to keep using the following rules. 
   Case 1: All lineitem tags are the same AND same as the total row tag => Include only the total row.
   Case 2: If a group has only one line item and one total and they have the same tag, only include the total row.
   Case 3: Else include line item and total rows.

   2. Now that we have the rows for the group. Lets obtain the group data. The group data include the rows containing the lineitem and total row.

   3. Perform a group_by(tag), sum(date_columns) over the group

   4. Format your output as follows
      "tag","date_col_1","date_col_2",...,"date_col_n"
      <group results>

D. Finally output sheet data.
   1. Include the header rows. (Make sure you add a column for tag that is blank)
   2. Output the date from each row_group. Add an empty line before each row group.

   












