export interface UserFile {
    file_id: string;
    original_filename: string;
    user_id: string;
    create_date: string;
    update_date: string;
}

export interface SheetData {
    data: string[][];
}

export interface SheetInfo {
    user_id: string;
    file_id: string;
    sheet_name: string;
    sheet_idx: number;
    version: number;
}
export interface FileDetailResponse {
    file_id: string;
    original_filename: string;
    user_id: string;
    create_date: string;
    sheets: SheetInfo[];
    sheets_data: SheetData[];
}