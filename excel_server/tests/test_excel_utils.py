import io

from app.server.excel_utils import convert_excel_to_sheet_data
from openpyxl import Workbook


def test_convert_excel_to_sheet_data():
    """
    Tests the convert_excel_to_sheet_data function using the example
    provided in excel_server/app/server/excel_utils.md.
    """
    # 1. Create the Excel workbook matching the "raw_csv" example
    wb = Workbook()
    ws = wb.active
    if ws is None:
        ws = wb.create_sheet("Sheet1")

    # The example data:
    # "column_a value","column b value",12,24.5,,
    # "column_a aaa","column b bbb",120,240.5,,
    # "column_a 111","column b 222",120,240.5,,

    # Note: The example shows trailing commas implying empty cells.
    # 5 commas -> 6 columns.
    data_rows = [
        ["column_a value", "column b value", 12, 24.5, None, None],
        ["column_a aaa", "column b bbb", 120, 240.5, None, None],
        ["column_a 111", "column b 222", 120, 240.5, None, None],
    ]

    for row in data_rows:
        ws.append(row)

    # Save to bytes
    excel_file = io.BytesIO()
    wb.save(excel_file)
    excel_bytes = excel_file.getvalue()

    # 2. Call the function
    result = convert_excel_to_sheet_data(excel_bytes)

    # 3. Assertions
    assert len(result) == 1
    sheet_data = result[0][1].data

    # Expected output analysis:
    # Header: " ", "A", "B", "C", "D", "E", "F", "G"
    # Row 1: "1", "", "column_a value", "column b value", "12", "24.5", "", ""
    # ...

    # Check header
    expected_header = [" ", "A", "B", "C", "D", "E", "F", "G"]
    assert sheet_data[0] == expected_header

    # Check Row 1
    # Note: numbers are converted to strings, None is converted to ""
    # Also an empty column is inserted at column 0 (which becomes column 1 / header A)
    expected_row_1 = ["1", "", "column_a value", "column b value", "12", "24.5", "", ""]
    assert sheet_data[1] == expected_row_1

    # Check Row 2
    expected_row_2 = ["2", "", "column_a aaa", "column b bbb", "120", "240.5", "", ""]
    assert sheet_data[2] == expected_row_2

    # Check Row 3
    expected_row_3 = ["3", "", "column_a 111", "column b 222", "120", "240.5", "", ""]
    assert sheet_data[3] == expected_row_3
