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
import { useService } from '../services/serviceProvider';
import type { FileDetailResponse } from '../domain/domain';

export const SheetInfoPage = () => {
    const { file_id, sheet_idx } = useParams<{ file_id: string; sheet_idx?: string }>();
    const [searchParams, setSearchParams] = useSearchParams();
    const [isChatOpen, setIsChatOpen] = useState(true);
    const service = useService();
    // Get sheet_idx from URL or default to 0

    const activeSheetIdx = useMemo(() => {
        const queryIdx = searchParams.get('sheet_idx');
        if (queryIdx !== null) {
            return parseInt(queryIdx, 10);
        }
        if (sheet_idx !== undefined) {
            return parseInt(sheet_idx, 10);
        }
        return 0;
    }, [searchParams, sheet_idx]);

    // Fetch Sheets
    const { data: sheets, isLoading: isLoadingSheets, isError: isErrorSheets } = useQuery<string[]>({
        queryKey: ['sheets', file_id],
        queryFn: async () => {
            if (!file_id) throw new Error('No file ID');
            return service.getSheets(file_id);
        },
        enabled: !!file_id
    });

    // Fetch File Details
    const { data: fileDetails, isLoading, isError } = useQuery<FileDetailResponse>({
        queryKey: ['file', file_id, activeSheetIdx],
        queryFn: async () => {
            if (!file_id) throw new Error('No file ID');
            if (activeSheetIdx === undefined || activeSheetIdx === null) throw new Error('No sheet index');
            return service.getFileDetails(file_id, activeSheetIdx);
        },
        enabled: !!file_id && activeSheetIdx !== undefined && activeSheetIdx !== null
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
                        <Table.Root variant="surface" size="1">
                            <Table.Header>
                                <Table.Row style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                                    {/* Sticky Header Row */}
                                    {currentSheetData?.data[0]?.map((header, idx) => (
                                        <Table.ColumnHeaderCell key={idx} style={{
                                            position: 'sticky',
                                            top: 0,
                                            zIndex: 10,
                                            backgroundColor: 'var(--color-surface)',
                                            whiteSpace: 'nowrap',
                                            padding: '2px 4px',
                                            textAlign: 'center',
                                            borderRight: '1px solid var(--gray-5)',
                                        }}>
                                            {header || `Col ${idx + 1}`}
                                        </Table.ColumnHeaderCell>
                                    ))}
                                </Table.Row>
                            </Table.Header>
                            <Table.Body>
                                {currentSheetData?.data?.slice(1).map((row, rowIdx) => (
                                    <Table.Row key={rowIdx} style={{ height: '23px' }}>
                                        {row.map((cell, cellIdx) => (
                                            <Table.Cell key={cellIdx} style={{
                                                whiteSpace: 'nowrap',
                                                padding: '0px 4px',
                                                lineHeight: '22px',
                                                height: '22px',
                                                verticalAlign: 'middle',
                                                borderRight: '1px solid var(--gray-5)',
                                            }}>
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

