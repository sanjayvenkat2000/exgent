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
    Heading,
    Button,
    IconButton
} from '@radix-ui/themes';
import { ChatBubbleIcon, Cross2Icon } from '@radix-ui/react-icons';
import { TagCell } from '../components/TagCell';
import { useService } from '../domain/serviceProvider';
import type { SheetData, SheetInfo, ReportGroup, SheetTag } from '../domain/domain';
import { produce } from 'immer';

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
    const { data: sheet_names, isLoading: isLoadingSheets, isError: isErrorSheets } = useQuery<string[]>({
        queryKey: ['sheets', file_id],
        queryFn: async () => {
            if (!file_id) throw new Error('No file ID');
            return service.getSheets(file_id);
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
    const { data: currentSheetInfo, isLoading: isLoadingSheetInfo, isError: isErrorSheetInfo } = useQuery<SheetInfo | null>({
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

    const rowGroupNames = useMemo(() => {
        const rowGroupNames: Record<number, string> = {};
        (currentSheetInfo?.payload?.structure?.groups || []).forEach((g: ReportGroup) => {
            const idx = g.header_rows[0] ?? g.line_items[0];
            if (idx) {
                rowGroupNames[idx] = g.name;
            }
        });
        return rowGroupNames;
    }, [currentSheetInfo?.payload?.structure?.groups]);

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
                    <Tabs.Root value={activeSheetIdx.toString()} onValueChange={handleTabChange} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                        <Tabs.List style={{ flexWrap: 'nowrap', width: 'fit-content' }}>
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

