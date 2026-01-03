import { Flex, ScrollArea, Table } from "@radix-ui/themes";
import { RowGroupDisplay } from "./RowGroupDisplay";
import { TagCell } from "./TagCell";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { produce } from "immer";
import { useMemo, useState, useCallback } from "react";
import type { ReportGroup, ReportGroupValidationResult, SheetTag, SheetInfo, SheetData } from "../domain/domain";
import { useService } from "../domain/serviceProvider";

export interface ExcelViewProps {
    currentSheetData: SheetData;
    currentSheetInfo: SheetInfo;
    file_id: string;
    activeSheetIdx: number;
}


const rowGroupColorsOrange = ["#FFD19A", "#FFC182", "#F5AE73"];
const rowGroupColorsBlue = ["#D6EAF8", "#AED6F1", "#85C1E9"];

export const ExcelView = ({ currentSheetData, currentSheetInfo, file_id, activeSheetIdx }: ExcelViewProps) => {
    const service = useService();
    const queryClient = useQueryClient();

    const rowGroupsMap = useMemo(() => {
        const groups = currentSheetInfo?.payload?.structure?.groups || [];
        const validationResults = currentSheetInfo?.payload?.structure?.validation_results || [];

        const map: Record<number, { group: ReportGroup; validations: ReportGroupValidationResult[] }> = {};

        groups.forEach((group) => {
            const groupValidations = validationResults.filter(v => v.group_name === group.name);
            const firstRow = group.header_rows[0] ?? group.line_items[0];
            if (firstRow !== undefined) {
                map[firstRow] = {
                    group,
                    validations: groupValidations
                };
            }
        });

        return map;
    }, [currentSheetInfo]);

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

    if (!currentSheetData) {
        return null;
    }

    return (
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
                                    <Flex align="center" justify="between" style={{ width: '100%', height: '100%' }}>
                                        <Flex align="center">
                                            {cellIdx === 1 && rowTags[rowIdx + 1] && (
                                                <TagCell
                                                    rowIndex={rowIdx + 1}
                                                    currentTag={rowTags[rowIdx + 1]}
                                                    onTagChange={handleTagChange}
                                                    isPending={mutation.isPending && changingRow === (rowIdx + 1)}
                                                />
                                            )}
                                            {cell}
                                        </Flex>
                                        {cellIdx === 1 && rowGroupsMap[rowIdx + 1] && (
                                            <RowGroupDisplay
                                                group={rowGroupsMap[rowIdx + 1].group}
                                                validationResults={rowGroupsMap[rowIdx + 1].validations}
                                                columnHeaders={currentSheetData?.data[0] || []}
                                            />
                                        )}
                                    </Flex>
                                </Table.Cell>
                            ))}
                        </Table.Row>
                    ))}
                </Table.Body>
            </Table.Root>
        </ScrollArea>
    );
};