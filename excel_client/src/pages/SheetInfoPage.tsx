import { useCallback, useMemo, useState } from 'react';
import { useSearchParams, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
    Flex,
    Box,
    Tabs,
    Text,
    IconButton
} from '@radix-ui/themes';
import { ChatBubbleIcon } from '@radix-ui/react-icons';
import { useService } from '../domain/serviceProvider';
import type { SheetData, SheetInfo, UserFile } from '../domain/domain';
import { ChatComponent } from '../components/ChatComponent';
import { generate_ontology_view } from '../domain/OntologyView';
import { ExcelView } from '../components/ExcelView';
import { OntologyViewWidget } from '../components/OntologyViewWidget';


export const SheetInfoPage = () => {
    const { file_id, sheet_idx } = useParams<{ file_id: string; sheet_idx?: string }>();
    const [searchParams, setSearchParams] = useSearchParams();
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [viewMode, setViewMode] = useState<'standard' | 'ontology'>('standard');
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

    const ontologyViewData = useMemo(() => {
        if (!currentSheetInfo) return null;
        return generate_ontology_view(currentSheetData, currentSheetInfo.payload);
    }, [currentSheetData, currentSheetInfo]);

    console.log('ontologyViewData', ontologyViewData);

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
                            <Box style={{ flexGrow: 1 }} />
                            {(currentSheetInfo?.payload?.tags?.length ?? 0) > 0 && (
                                <Tabs.Root value={viewMode} onValueChange={(v) => setViewMode(v as 'standard' | 'ontology')}>
                                    <Tabs.List>
                                        <Tabs.Trigger value="standard">Standard</Tabs.Trigger>
                                        <Tabs.Trigger value="ontology">Ontology</Tabs.Trigger>
                                    </Tabs.List>
                                </Tabs.Root>
                            )}
                        </Flex>
                    </Box>
                    <Flex justify="between" align="center" pr="3">
                        <Tabs.Root value={activeSheetIdx.toString()} onValueChange={handleTabChange}>
                            <Tabs.List style={{ flexWrap: 'nowrap', width: 'fit-content', paddingLeft: 'var(--space-3)' }}>
                                {sheet_names?.map((sheet, index) => (
                                    <Tabs.Trigger key={`sheet-tab-${index}`} value={index.toString()}>
                                        {sheet}
                                    </Tabs.Trigger>
                                ))}
                            </Tabs.List>
                        </Tabs.Root>
                    </Flex>
                </Box>
                <Box style={{ flexGrow: 1, overflow: 'hidden', position: 'relative' }}>
                    {viewMode === 'standard' ? (
                        currentSheetData && currentSheetInfo && file_id && activeSheetIdx !== undefined && activeSheetIdx !== null && (
                            <ExcelView currentSheetData={currentSheetData} currentSheetInfo={currentSheetInfo} file_id={file_id} activeSheetIdx={activeSheetIdx} />
                        )
                    ) : (
                        ontologyViewData && (
                            <OntologyViewWidget ontologyViewData={ontologyViewData} />
                        )
                    )}
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

