import { useCallback, useMemo, useState } from 'react';
import { useSearchParams, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    Flex,
    Box,
    Tabs,
    Table,
    ScrollArea,
    Text,
    IconButton
} from '@radix-ui/themes';
import { ChatBubbleIcon } from '@radix-ui/react-icons';
import { TagCell } from '../components/TagCell';
import { useService } from '../domain/serviceProvider';
import type { SheetData, SheetInfo, ReportGroup, SheetTag, UserFile } from '../domain/domain';
import { produce } from 'immer';
import { ChatComponent } from '../components/ChatComponent';

const rowGroupColorsOrange = ["#FFD19A", "#FFC182", "#F5AE73"];
const rowGroupColorsBlue = ["#D6EAF8", "#AED6F1", "#85C1E9"];

export const SheetInfoPage = () => {
    const { file_id, sheet_idx } = useParams<{ file_id: string; sheet_idx?: string }>();
    const [searchParams, setSearchParams] = useSearchParams();
    const [isChatOpen, setIsChatOpen] = useState(true);
    const service = useService();
    const queryClient = useQueryClient();

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

    // Fetch Sheet Names
    const { data: sheet_names } = useQuery<string[]>({
        queryKey: ['sheets', file_id],
        queryFn: async () => {
            if (!file_id) throw new Error('No file ID');
            return service.getSheets(file_id);
        },
        enabled: !!file_id
    });

    // Fetch File Info
    const { data: fileInfo } = useQuery<UserFile>({
        queryKey: ['file-info', file_id],
        queryFn: async () => {
            if (!file_id) throw new Error('No file ID');
            return service.getUserFile(file_id);
        },
        enabled: !!file_id
    });

    // Fetch current Sheet Data
    const { data: currentSheetData, isLoading, isError } = useQuery<SheetData>({
        queryKey: ['file', file_id, activeSheetIdx],
        queryFn: async () => {
            if (!file_id) throw new Error('No file ID');
            if (activeSheetIdx === undefined || activeSheetIdx === null) throw new Error('No sheet index');
            return service.getSheetData(file_id, activeSheetIdx);
        },
        enabled: !!file_id && activeSheetIdx !== undefined && activeSheetIdx !== null
    });

    // Fetch current Sheet Info
    const { data: currentSheetInfo } = useQuery<SheetInfo | null>({
        queryKey: ['sheetinfo', file_id, activeSheetIdx],
        queryFn: async () => {
            if (!file_id) throw new Error('No file ID');
            if (activeSheetIdx === undefined || activeSheetIdx === null) throw new Error('No sheet index');
            return service.getSheetInfo(file_id, activeSheetIdx);
        },
        enabled: !!file_id && activeSheetIdx !== undefined && activeSheetIdx !== null
    });

    const handleTabChange = useCallback((value: string) => {
        setSearchParams({ sheet_idx: value });
    }, [setSearchParams]);

    const rowGroupColors = useMemo(() => {
        const groups = currentSheetInfo?.payload?.structure?.groups || [];
        const colorMap: Record<number, string> = {};

        groups.forEach((group: ReportGroup, idx: number) => {
            const palette = idx % 2 === 0 ? rowGroupColorsOrange : rowGroupColorsBlue;

            // Header: Middle shade
            group.header_rows.forEach((row: number) => {
                colorMap[row] = palette[1];
            });

            // Line items: Lightest shade
            group.line_items.forEach((row: number) => {
                colorMap[row] = palette[0];
            });

            // Total: Darkest shade
            colorMap[group.total] = palette[2];
        });

        return colorMap;
    }, [currentSheetInfo]);

    const rowTags = useMemo(() => {
        const rowTags: Record<number, string> = {};
        (currentSheetInfo?.payload?.tags || []).forEach((t: SheetTag) => {
            rowTags[t.row] = t.tag;
        });
        return rowTags;
    }, [currentSheetInfo?.payload?.tags]);

    const [changingRow, setChangingRow] = useState<number | null>(null);

    const mutation = useMutation({
        mutationFn: async (newSheetInfo: SheetInfo) => {
            if (!file_id || activeSheetIdx === undefined || !newSheetInfo.payload) {
                throw new Error("Missing required data for update");
            }
            return service.updateSheetInfo(file_id, activeSheetIdx, newSheetInfo.sheet_name, newSheetInfo.payload);
        },
        onSuccess: () => {
            setChangingRow(null);
            queryClient.invalidateQueries({ queryKey: ['sheetinfo', file_id, activeSheetIdx] });
        },
        onError: () => {
            setChangingRow(null);
        }
    });

    const handleTagChange = useCallback((rowIndex: number, tag: string) => {
        if (!currentSheetInfo) return;

        setChangingRow(rowIndex);
        console.log(`Changed row ${rowIndex} to ${tag}`);

        const nextSheetInfo = produce(currentSheetInfo, draft => {
            if (!draft.payload) {
                // Initialize payload if it doesn't exist
                draft.payload = {
                    structure: {
                        statement_type: "",
                        financial_items_column: 0,
                        date_columns: [],
                        groups: [],
                        validation_results: []
                    },
                    tags: []
                };
            }

            const existingTagIndex = draft.payload.tags.findIndex((t: SheetTag) => t.row === rowIndex);

            if (existingTagIndex !== -1) {
                draft.payload.tags[existingTagIndex].tag = tag;
            } else {
                draft.payload.tags.push({ row: rowIndex, tag });
            }
        });

        mutation.mutate(nextSheetInfo);
    }, [currentSheetInfo, mutation]);

    if (isLoading) {
        return (
            <Flex align="center" justify="center" style={{ height: 'calc(100vh - 60px)' }}>
                <Text>Loading file details...</Text>
            </Flex>
        );
    }

    if (isError || !sheet_names) {
        return (
            <Flex align="center" justify="center" style={{ height: 'calc(100vh - 60px)' }}>
                <Text color="red">Error loading file details.</Text>
            </Flex>
        );
    }

    console.log('currentSheetInfo', currentSheetInfo);

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
                    <Box px="3" py="3" style={{ borderBottom: '1px solid var(--gray-5)', backgroundColor: 'var(--gray-2)' }}>
                        <Flex align="center" gap="3">
                            <Box style={{
                                width: 28,
                                height: 28,
                                backgroundColor: 'var(--green-9)',
                                borderRadius: 6,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'white',
                                fontWeight: 'bold',
                                fontSize: 16,
                            }}>
                                X
                            </Box>
                            <Flex direction="column">
                                <Text size="3" weight="bold" style={{ lineHeight: '1.2' }}>
                                    {fileInfo?.original_filename}
                                </Text>
                                <Text size="1" color="gray">
                                    Created on {fileInfo && `${new Date(fileInfo.create_date).toLocaleDateString()} ${new Date(fileInfo.create_date).toLocaleTimeString()}`}
                                </Text>
                            </Flex>
                        </Flex>
                    </Box>
                    <Tabs.Root value={activeSheetIdx.toString()} onValueChange={handleTabChange} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                        <Tabs.List style={{ flexWrap: 'nowrap', width: 'fit-content', paddingLeft: 'var(--space-3)', paddingRight: 'var(--space-3)' }}>
                            {sheet_names?.map((sheet, index) => (
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
                                    <Table.Row key={rowIdx} style={{ height: '23px', backgroundColor: rowGroupColors[rowIdx + 1] }}>
                                        {row.map((cell, cellIdx) => (
                                            <Table.Cell key={cellIdx} style={{
                                                whiteSpace: 'pre',
                                                padding: '0px 4px',
                                                lineHeight: '22px',
                                                height: '22px',
                                                verticalAlign: 'middle',
                                                borderRight: '1px solid var(--gray-5)',
                                            }}>
                                                {cellIdx === 1 && rowTags[rowIdx + 1] && (
                                                    <TagCell
                                                        rowIndex={rowIdx + 1}
                                                        currentTag={rowTags[rowIdx + 1]}
                                                        onTagChange={handleTagChange}
                                                        isPending={mutation.isPending && changingRow === (rowIdx + 1)}
                                                    />
                                                )}
                                                {/* {cellIdx === 1 && rowGroupNames[rowIdx + 1] && (
                                                    <Text size="1" color="gray">
                                                        {rowGroupNames[rowIdx + 1]}
                                                    </Text>
                                                )} */}
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
            <ChatComponent
                isChatOpen={isChatOpen}
                setIsChatOpen={setIsChatOpen}
                fileId={file_id}
                sheetIdx={activeSheetIdx}
            />
        </Box >
    );
};

