/**
 "Server Models
 */

export interface ReportGroup {
    name: string;
    header_rows: number[];
    line_items: number[];
    total: number;
}

export interface ReportGroupValidationResult {
    group_name: string;
    date_column: number;
    calculated_total: number;
    actual_total: number;
    matches: boolean;
}

export interface SheetStructure {
    statement_type: string;
    financial_items_column: number;
    date_columns: number[];
    groups: ReportGroup[];
    validation_results: ReportGroupValidationResult[];
}

export interface SheetTag {
    row: number;
    tag: string;
}

export interface SheetInfoPayload {
    structure: SheetStructure;
    tags: SheetTag[];
}

/**
 "Database Storage Models
 */

export interface UserFile {
    file_id: string;
    original_filename: string;
    user_id: string;
    file_uri: string;
    create_date: string
    update_date: string
    is_deleted: boolean;
}

export interface SheetInfo {
    user_id: string; // The user who uploaded the file
    file_id: string;
    payload?: SheetInfoPayload | null; // Optional/Nullable
    sheet_name: string;
    sheet_idx: number;
    version: number;
}

export interface SheetData {
    data: string[][];
}

export interface FileDetailResponse {
    sheets: SheetInfo[];
    sheets_data: SheetData[];
}

export const ontologyTagsIncomeStatement = [
    "Gross Revenue",
    "Total Discounts",
    "Total Cancellation and Returns",
    "Net Revenue",
    "Gross Product Cost",
    "Fulfillment, Shipping, Merchant Fee",
    "Marketing",
    "Payroll, Benefits, and Admin",
    "Other Operating Expenses",
    "Operating Income",
    "Non operating income",
    "Non operating expenses",
    "Interest",
    "Depreciation & Amortization",
    "Pre-Tax Income",
    "Taxes",
]

export const ontologyTagsBalanceSheet = [
    "Cash and bank balances",
    "Inventory",
    "Accounts receivable",
    "Total Current Assets",
    "Property, Plant, & Equipment",
    "Accumulated Depreciation & Ammortization",
    "Other Long Term Assets",
    "Credit Cards",
    "Accounts payable",
    "Short Term Debt (under CL)",
    "Total Current Liabilities",
    "Long Term Debt (under LTL)",
    "Long Term Liabilities ex Debt",
    "Equity",
]

export const ontologyTags = [
    ...ontologyTagsIncomeStatement,
    ...ontologyTagsBalanceSheet,
]