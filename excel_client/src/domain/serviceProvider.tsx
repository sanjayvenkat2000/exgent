import React, { createContext, use } from 'react';
import type { SheetData, SheetInfo, SheetInfoPayload, UserFile } from './domain'
import type { Event } from './googleAdkTypes';


export class Service {
    private readonly apiUrl: string;

    constructor(apiUrl: string) {
        this.apiUrl = apiUrl;
    }

    async getSheets(fileId: string): Promise<string[]> {
        const url = `${this.apiUrl}/sheets/${fileId}`;
        const response = await fetch(url);
        return response.json();
    }

    async getSheetData(fileId: string, sheetIdx: number): Promise<SheetData> {
        const url = `${this.apiUrl}/sheetdata/${fileId}/${sheetIdx}`;
        const response = await fetch(url);
        return response.json();
    }

    async getSheetInfo(fileId: string, sheetIdx: number): Promise<SheetInfo | null> {
        const url = `${this.apiUrl}/sheetinfo/${fileId}/${sheetIdx}`;
        const response = await fetch(url);
        return response.json();
    }

    async updateSheetInfo(fileId: string, sheetIdx: number, sheet_name: string, sheetInfo: SheetInfoPayload): Promise<SheetInfo> {
        const url = `${this.apiUrl}/sheetinfo/${fileId}/${sheetIdx}`;
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ sheet_name, payload: sheetInfo }),
        });
        if (!response.ok) throw new Error('Failed to update sheet info');
        return response.json();
    }

    async getSheetChatHistory(fileId: string, sheetIdx: number): Promise<Event[]> {
        const url = `${this.apiUrl}/sheetchat/history/${fileId}/${sheetIdx}`;
        const response = await fetch(url);
        return response.json();
    }

    async getUserFile(fileId: string): Promise<UserFile> {
        const url = `${this.apiUrl}/files/${fileId}`;
        const response = await fetch(url);
        return response.json();
    }

    async listFiles(): Promise<UserFile[]> {
        const url = `${this.apiUrl}/files`;
        const response = await fetch(url);
        return response.json();
    }

    async uploadFile(file: File): Promise<UserFile> {
        const url = `${this.apiUrl}/upload`;
        const formData = new FormData();
        formData.append('file', file);
        const response = await fetch(url, {
            method: 'POST',
            body: formData,
        });
        if (!response.ok) throw new Error('Upload failed');
        return response.json();
    }
}


const ServiceContext = createContext<Service | undefined>(undefined);

export const ServiceProvider: React.FC<{
    service: Service;
    children: React.ReactNode;
}> = ({ service, children }) => {
    return (
        <ServiceContext value={service}>
            {children}
        </ServiceContext>
    );
};

export const useService = () => {
    const context = use(ServiceContext);
    if (!context) {
        throw new Error('useService must be used within a ServiceProvider');
    }
    return context;
};
