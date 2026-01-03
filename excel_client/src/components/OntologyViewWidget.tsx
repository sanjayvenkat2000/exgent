import { useMemo } from "react";
import { Flex, ScrollArea, Table, Badge } from "@radix-ui/themes";
import type { SheetData } from "../domain/domain";
import { ontologyTags } from "../domain/domain";

export interface OntologyViewWidgetProps {
    ontologyViewData: SheetData;
}

const alternatingColors = ["#FFD19A", "#D6EAF8"];

export const OntologyViewWidget = ({ ontologyViewData }: OntologyViewWidgetProps) => {
    const rowColors = useMemo(() => {
        if (!ontologyViewData || !ontologyViewData.data) return [];
        let currentIdx = 0;
        return ontologyViewData.data.map((row) => {
            const isBlank = row.every(cell => !cell || cell.trim() === "");
            if (isBlank) {
                currentIdx = (currentIdx + 1) % alternatingColors.length;
                return 'transparent';
            }
            return alternatingColors[currentIdx];
        });
    }, [ontologyViewData]);

    if (!ontologyViewData || !ontologyViewData.data) return null;

    return (
        <ScrollArea style={{ flexGrow: 1, height: '100%' }}>
            <Table.Root variant="surface" size="1">
                <Table.Body>
                    {ontologyViewData.data.map((row, rowIdx) => {
                        const backgroundColor = rowColors[rowIdx];

                        return (
                            <Table.Row key={`row-${rowIdx}`} style={{ height: '23px', backgroundColor }}>
                                {row.map((cell, cellIdx) => {
                                    const isTag = cellIdx === 0 && ontologyTags.includes(cell);
                                    return (
                                        <Table.Cell key={`cell-${rowIdx}-${cellIdx}`} style={{
                                            whiteSpace: 'pre',
                                            padding: '0px 8px',
                                            lineHeight: '22px',
                                            height: '22px',
                                            verticalAlign: 'middle',
                                            borderRight: '1px solid var(--gray-5)',
                                        }}>
                                            <Flex align="center">
                                                {isTag ? (
                                                    <Badge variant="soft" radius="full" color="gray">
                                                        {cell}
                                                    </Badge>
                                                ) : (
                                                    <span style={{ fontWeight: cellIdx === 0 && cell ? 'bold' : 'normal' }}>
                                                        {cell}
                                                    </span>
                                                )}
                                            </Flex>
                                        </Table.Cell>
                                    );
                                })}
                            </Table.Row>
                        );
                    })}
                </Table.Body>
            </Table.Root>
        </ScrollArea>
    );
};

