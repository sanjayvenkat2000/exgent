import React, { createContext, use } from 'react';
import type { FileDetailResponse, UserFile } from '../domain/domain'

const API_BASE_URL = 'http://localhost:8080';


export class Service {
    async getSheets(fileId: string): Promise<string[]> {
        const url = `${API_BASE_URL}/sheets/${fileId}`;
        const response = await fetch(url);
        return response.json();
    }

    async getFileDetails(fileId: string, sheetIdx: number): Promise<FileDetailResponse> {
        const url = `${API_BASE_URL}/files/${fileId}/${sheetIdx}`;
        const response = await fetch(url);
        return response.json();
    }

    async listFiles(): Promise<UserFile[]> {
        const url = `${API_BASE_URL}/files`;
        const response = await fetch(url);
        return response.json();
    }

    async uploadFile(file: File): Promise<UserFile> {
        const url = `${API_BASE_URL}/upload`;
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
