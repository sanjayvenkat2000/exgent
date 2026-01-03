import type { SheetData, SheetInfoPayload } from './domain';
import { produce } from 'immer';

export const generate_ontology_view = (
    sheetData: SheetData | undefined,
    sheetInfoPayload: SheetInfoPayload | null | undefined
): SheetData => {
    if (!sheetData || !sheetInfoPayload) {
        return sheetData || { data: [] };
    }

    const { structure, tags: rowTagsList } = sheetInfoPayload;
    const { date_columns, groups } = structure;

    if (!date_columns || date_columns.length === 0) {
        return sheetData;
    }

    // Create a map for quick tag lookup by row index
    const rowTagsMap: Record<number, string> = {};
    rowTagsList.forEach(t => {
        rowTagsMap[t.row] = t.tag;
    });

    // Helper to parse numeric values from strings
    const parseValue = (val: string | number | null | undefined): number => {
        if (typeof val === 'number') return val;
        if (!val || typeof val !== 'string') return 0;
        let s = val.trim();
        let negative = false;
        if (s.startsWith('(') && s.endsWith(')')) {
            negative = true;
            s = s.substring(1, s.length - 1);
        } else if (s.startsWith('-')) {
            negative = true;
            s = s.substring(1);
        }
        // Remove commas and other non-numeric characters except decimal point
        const cleaned = s.replace(/[^0-9.]/g, '');
        const parsed = parseFloat(cleaned);
        const result = isNaN(parsed) ? 0 : parsed;
        return negative ? -result : result;
    };

    return produce(sheetData, draft => {
        //Lets drop the header row 

        const originalData = sheetData.data.slice(1);
        const newRows: string[][] = [];

        // B. Determine where row_groups start.
        // The start of a group is the minimum row index in that group (header, line items, or total).
        let minRow = originalData.length;
        groups.forEach(group => {
            const groupRows = [
                ...(group.header_rows || []),
                ...(group.line_items || []),
                group.total
            ].filter(r => r !== undefined && r !== null);

            if (groupRows.length > 0) {
                const groupMin = Math.min(...groupRows);
                if (groupMin < minRow) minRow = groupMin;
            }
        });

        // D.1 Include the header rows (rows up to minRow - 1)
        // Since originalData starts at Excel Row 1 (df index 1), 
        // the rows before index minRow are 0 to minRow - 2.
        for (let i = 0; i < minRow - 1; i++) {
            const originalRow = originalData[i] || [];
            const newRow = ["", ...date_columns.map(colIdx => String(originalRow[colIdx] || ""))];
            newRows.push(newRow);
        }

        // C. Process each row_group
        groups.forEach(group => {
            const lineItems = group.line_items || [];
            const totalRowIdx = group.total;

            const lineItemTags = lineItems.map(r => rowTagsMap[r]).filter(Boolean);
            const totalTag = rowTagsMap[totalRowIdx];

            let rowsToKeep: number[] = [];

            // Filtering logic based on instructions
            const allLineItemTagsSame = lineItemTags.length > 0 && lineItemTags.every(t => t === lineItemTags[0]);

            if (allLineItemTagsSame && lineItemTags[0] === totalTag) {
                // Case 1: All lineitem tags are same AND same as total row tag => Include only total row.
                rowsToKeep = [totalRowIdx];
            } else if (lineItems.length === 1 && lineItemTags[0] === totalTag) {
                // Case 2: Only one line item and one total, same tag => Only include total row.
                rowsToKeep = [totalRowIdx];
            } else {
                // Case 3: Else include line item and total rows.
                rowsToKeep = [...lineItems, totalRowIdx];
            }

            // 3. Perform group_by(tag), sum(date_columns) over the group
            const tagSums: Record<string, number[]> = {};
            const tagOrder: string[] = []; // To preserve tag appearance order

            rowsToKeep.forEach(rowIdx => {
                const tag = rowTagsMap[rowIdx];
                if (!tag) return;

                if (!tagSums[tag]) {
                    tagSums[tag] = new Array(date_columns.length).fill(0);
                    tagOrder.push(tag);
                }

                // rowIdx is 1-indexed Excel row number (matching df index)
                // originalData is 0-indexed starting from Excel Row 1.
                const row = originalData[rowIdx - 1] || [];
                date_columns.forEach((colIdx, i) => {
                    tagSums[tag][i] += parseValue(row[colIdx]);
                });
            });

            // D.2 Add an empty line before each row group.
            newRows.push(new Array(date_columns.length + 1).fill(""));
            // Add the group name as the header row
            const groupNameRow = [group.name, ...new Array(date_columns.length).fill("")];
            newRows.push(groupNameRow);

            // Add the summed results for each tag in this group
            tagOrder.forEach(tag => {
                const sums = tagSums[tag];
                newRows.push([
                    tag,
                    ...sums.map(s => {
                        // Round to 2 decimal places and remove trailing zeros if possible
                        return Number(s.toFixed(2)).toString();
                    })
                ]);
            });
        });

        draft.data = newRows;
    });
};

