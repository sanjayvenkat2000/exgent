import { useCallback, useMemo, useState } from 'react';
import { useSearchParams, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
    Flex,
    Box,
    Tabs,
    Table,
    ScrollArea,
    Text,
    Heading,
    Button,
    IconButton
} from '@radix-ui/themes';
import { ChatBubbleIcon, Cross2Icon } from '@radix-ui/react-icons';

const API_BASE = 'http://localhost:8080';

// Interfaces based on backend domain
interface SheetInfo {
    user_id: string;
    file_id: string;
    sheet_name: string;
    sheet_idx: number;
    version: number;
    // payload is optional/complex, omitting for now unless needed
}

interface SheetData {
    data: string[][];
}

interface FileDetailResponse {
    file_id: string;
    original_filename: string;
    user_id: string;
    create_date: string;
    sheets: SheetInfo[];
    sheets_data: SheetData[];
}

export const SheetInfoPage = () => {
    const { file_id } = useParams<{ file_id: string }>();
    const [searchParams, setSearchParams] = useSearchParams();
    const [isChatOpen, setIsChatOpen] = useState(true);

    // Get sheet_idx from URL or default to 0

    const activeSheetIdx = useMemo(() => {
        return searchParams.get('sheet_idx') ? parseInt(searchParams.get('sheet_idx')!, 10) : 0;
    }, [searchParams]);

    // Fetch Sheets
    const { data: sheets, isLoading: isLoadingSheets, isError: isErrorSheets } = useQuery<string[]>({
        queryKey: ['sheets', file_id],
        queryFn: async () => {
            if (!file_id) throw new Error('No file ID');
            const res = await fetch(`${API_BASE}/sheets/${file_id}`);
            return res.json();
        },
        enabled: !!file_id
    });

    // Fetch File Details
    const { data: fileDetails, isLoading, isError } = useQuery<FileDetailResponse>({
        queryKey: ['file', file_id, activeSheetIdx],
        queryFn: async () => {
            if (!file_id) throw new Error('No file ID');
            const res = await fetch(`${API_BASE}/files/${file_id}/${activeSheetIdx}`);
            if (!res.ok) throw new Error('Failed to fetch file details');
            return res.json();
        },
        enabled: !!file_id
    });


    const currentSheetData = useMemo(() => {
        return fileDetails?.sheets_data?.[0];
    }, [fileDetails]);


    const handleTabChange = useCallback((value: string) => {
        setSearchParams({ sheet_idx: value });
    }, [setSearchParams]);

    if (isLoading) {
        return (
            <Flex align="center" justify="center" style={{ height: 'calc(100vh - 60px)' }}>
                <Text>Loading file details...</Text>
            </Flex>
        );
    }

    if (isError || !fileDetails) {
        return (
            <Flex align="center" justify="center" style={{ height: 'calc(100vh - 60px)' }}>
                <Text color="red">Error loading file details.</Text>
            </Flex>
        );
    }

    return (
        <Box style={{ height: 'calc(100vh - 60px)', overflow: 'hidden', display: 'flex', flexDirection: 'row' }}>
            {/* Left Section: Sheet Data */}
            <Box style={{
                width: isChatOpen ? '60%' : '100%',
                borderRight: '1px solid var(--gray-5)',
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                position: 'relative',
                transition: 'width 0.3s ease-in-out'
            }}>

                <Box style={{ flexShrink: 0, overflowX: 'auto' }}>
                    <Tabs.Root value={activeSheetIdx.toString()} onValueChange={handleTabChange} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                        <Tabs.List style={{ flexWrap: 'nowrap', width: 'fit-content' }}>
                            {sheets?.map((sheet, index) => (
                                <Tabs.Trigger key={index} value={index.toString()}>
                                    {sheet}
                                </Tabs.Trigger>
                            ))}
                        </Tabs.List>
                    </Tabs.Root>
                </Box>
                <Box style={{ flexGrow: 1, overflow: 'hidden', position: 'relative' }}>
                    <ScrollArea style={{ flexGrow: 1, height: '100%' }}>
                        <Table.Root variant="surface">
                            <Table.Header>
                                <Table.Row style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                                    {/* Sticky Header Row */}
                                    {currentSheetData?.data[0]?.map((header, idx) => (
                                        <Table.ColumnHeaderCell key={idx} style={{
                                            position: 'sticky',
                                            top: 0,
                                            zIndex: 10,
                                            backgroundColor: 'var(--color-surface)',
                                            whiteSpace: 'nowrap'
                                        }}>
                                            {header || `Col ${idx + 1}`}
                                        </Table.ColumnHeaderCell>
                                    ))}
                                </Table.Row>
                            </Table.Header>
                            <Table.Body>
                                {currentSheetData?.data?.slice(1).map((row, rowIdx) => (
                                    <Table.Row key={rowIdx}>
                                        {row.map((cell, cellIdx) => (
                                            <Table.Cell key={cellIdx} style={{ whiteSpace: 'nowrap' }}>
                                                {cell}
                                            </Table.Cell>
                                        ))}
                                    </Table.Row>
                                ))}
                            </Table.Body>
                        </Table.Root>
                    </ScrollArea>
                </Box>

                {/* Floating Chat Toggle Button - Only visible when chat is closed */}
                {!isChatOpen && (
                    <Box style={{ position: 'absolute', bottom: '20px', right: '20px', zIndex: 20 }}>
                        <IconButton
                            size="3"
                            radius="full"
                            onClick={() => setIsChatOpen(true)}
                            style={{ boxShadow: 'var(--shadow-3)' }}
                        >
                            <ChatBubbleIcon width="20" height="20" />
                        </IconButton>
                    </Box>
                )}

            </Box >

            {/* Right Section: Chat Area */}
            <Box style={{
                width: isChatOpen ? '40%' : '0%',
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                overflow: 'hidden',
                transition: 'width 0.3s ease-in-out',
                opacity: isChatOpen ? 1 : 0,
                pointerEvents: isChatOpen ? 'auto' : 'none',
                position: 'relative' // Needed for absolute positioning of close button
            }}>
                {/* Close Button */}
                <Box style={{ position: 'absolute', top: '10px', right: '10px', zIndex: 10 }}>
                    <IconButton
                        size="2"
                        variant="ghost"
                        color="gray"
                        onClick={() => setIsChatOpen(false)}
                    >
                        <Cross2Icon width="20" height="20" />
                    </IconButton>
                </Box>

                <ScrollArea style={{ flexGrow: 1 }}>
                    <Flex direction="column" align="center" justify="center" style={{ minHeight: '100%', padding: '20px' }}>
                        {/* Placeholder for Empty Chat State */}
                        <Flex direction="column" align="center" gap="4">
                            <Box p="4" style={{ backgroundColor: 'var(--gray-3)', borderRadius: '50%' }}>
                                <ChatBubbleIcon width="32" height="32" color="var(--gray-11)" />
                            </Box>
                            <Heading size="4" align="center" color="gray">Start a conversation</Heading>
                            <Text align="center" color="gray" style={{ maxWidth: 300 }}>
                                Ask questions about your data, analyze trends, or extract insights.
                            </Text>
                            <Button size="3" variant="soft">
                                <ChatBubbleIcon /> Start Analysis
                            </Button>
                        </Flex>
                    </Flex>
                </ScrollArea>

                {/* Chat Input Placeholder */}
                <Box p="4" style={{ borderTop: '1px solid var(--gray-5)' }}>
                    {/* Input area will go here */}
                    <Box style={{ height: 40, backgroundColor: 'var(--gray-3)', borderRadius: 4 }} />
                </Box>
            </Box >
        </Box >
    );
};

