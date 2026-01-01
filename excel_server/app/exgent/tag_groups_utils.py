import pandas as pd
from app.domain import ReportGroup


def generate_group_csv(
    row_group: ReportGroup,
    df: pd.DataFrame,
    financial_items_column: int,
    date_columns: list[int],
) -> str:
    """
    Generates a CSV string for a specific ReportGroup.

    Args:
        row_group: The ReportGroup to process.
        df: The DataFrame containing the sheet data.
        financial_items_column: The column index for financial items text.
        date_columns: A list of column indices for dates. The first one is used for values.

    Returns:
        A CSV string with columns: row_number, row_type, financial_item, value.
    """
    rows = []

    # Helper to safely extract data
    def extract_row_data(row_idx: int, row_type: str):
        if row_idx < 0 or row_idx >= len(df):
            return None

        # row_number is the first column of the dataframe (index 0)
        row_number = df.iloc[row_idx, 0]

        # financial_item from the specified column
        financial_item = None
        if 0 <= financial_items_column < df.shape[1]:
            financial_item = df.iloc[row_idx, financial_items_column]

        # value from the first date column
        value = None
        if date_columns and len(date_columns) > 0:
            date_col_idx = date_columns[0]
            if 0 <= date_col_idx < df.shape[1]:
                value = df.iloc[row_idx, date_col_idx]

        return {
            "row_number": row_number,
            "row_type": row_type,
            "financial_item": financial_item,
            "value": value,
        }

    # 1. Header rows
    for r in row_group.header_rows:
        data = extract_row_data(r, "header")
        if data:
            rows.append(data)

    # 2. Line items
    for r in row_group.line_items:
        data = extract_row_data(r, "line_item")
        if data:
            rows.append(data)

    # 3. Total row
    data = extract_row_data(row_group.total, "total_row")
    if data:
        rows.append(data)

    if not rows:
        return "row_number,row_type,financial_item,value\n"

    result_df = pd.DataFrame(rows)
    # Ensure column order
    result_df = result_df[["row_number", "row_type", "financial_item", "value"]]

    return result_df.to_csv(index=False)
