### Excel Utils

Excel Utils must perform the following function.

1. load a workbook from input of bytes
2. Create a list[SheetData] output 
    a. Insert an empty column at column 0
    b. For each sheet, when creating SheetData, we need to add a header row and row numbers.

    Example:
    raw_csv = """
    "column_a value","column b value",12,24.5,,
    "column_a aaa","column b bbb",120,240.5,,
    "column_a 111","column b 222",120,240.5,,
    """

    expected_output = """
     ,A,B,C,D,E,F,G
    1,,"column_a value","column b value",12,24.5,,
    2,,"column_a aaa","column b bbb",120,240.5,,
    3,,"column_a 111","column b 222",120,240.5,,
    """

    Note that we have 0, 0 as an empty space. We make this transformation to allow the LLM to reason about the sheet in rows and columns.
    We have an empty column at col position 1 (header A), that acts like the LLMs scratch pad for notes about the row.

    Important: SheetData is a list[list[str]] but the instructions are in csv.  Make the necessary edits when generating the code.

