/**
 * Server Models
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
 * Database Storage Models
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