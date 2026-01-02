import { useState } from 'react';
import { Badge, Select } from '@radix-ui/themes';
import { ontologyTagsIncomeStatement, ontologyTagsBalanceSheet } from '../domain/domain';

interface TagCellProps {
    rowIndex: number;
    currentTag: string;
    onTagChange: (rowIndex: number, tag: string) => void;
    isPending?: boolean;
}

export const TagCell = ({ rowIndex, currentTag, onTagChange, isPending }: TagCellProps) => {
    const [isEditing, setIsEditing] = useState(false);

    if (isEditing && !isPending) {
        return (
            <Select.Root
                defaultValue={currentTag}
                defaultOpen={true}
                onOpenChange={(open) => {
                    if (!open) setIsEditing(false);
                }}
                onValueChange={(value) => {
                    console.log(`Changed row ${rowIndex} to ${value}`);
                    onTagChange(rowIndex, value);
                    // Logic handled by onOpenChange
                }}
            >
                <Select.Trigger placeholder="Select tag..." style={{ marginRight: '8px' }} />
                <Select.Content>
                    <Select.Group>
                        <Select.Label className="SelectLabel">Income Statement</Select.Label>
                        {ontologyTagsIncomeStatement.map((tag) => (
                            <Select.Item key={tag} value={tag}>
                                {tag}
                            </Select.Item>
                        ))}
                    </Select.Group>
                    <Select.Separator className="SelectSeparator" />
                    <Select.Group>
                        <Select.Label className="SelectLabel">Balance Sheet</Select.Label>
                        {ontologyTagsBalanceSheet.map((tag) => (
                            <Select.Item key={tag} value={tag}>
                                {tag}
                            </Select.Item>
                        ))}
                    </Select.Group>
                </Select.Content>
            </Select.Root>
        );
    }

    return (
        <Badge
            variant="soft"
            radius="full"
            color="gray"
            style={{
                marginRight: '8px',
                cursor: isPending ? 'not-allowed' : 'pointer',
                opacity: isPending ? 0.5 : 1
            }}
            onClick={() => !isPending && setIsEditing(true)}
        >
            {currentTag}
        </Badge>
    );
};

