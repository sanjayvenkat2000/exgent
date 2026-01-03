import { Popover, IconButton, Text, Badge, Flex, Box, Heading, Separator, ScrollArea } from '@radix-ui/themes';
import { InfoCircledIcon, CheckCircledIcon, ExclamationTriangleIcon } from '@radix-ui/react-icons';
import type { ReportGroup, ReportGroupValidationResult } from '../domain/domain';
import { useMemo, useState } from 'react';

interface RowGroupDisplayProps {
    group: ReportGroup;
    validationResults: ReportGroupValidationResult[];
    columnHeaders: string[];
}

export const RowGroupDisplay = ({ group, validationResults, columnHeaders }: RowGroupDisplayProps) => {
    const [showDetails, setShowDetails] = useState(false);
    const [filter, setFilter] = useState<'valid' | 'errors'>('errors');

    const { allMatch, hasFailures, matchCount, totalCount } = useMemo(() => {
        if (validationResults.length === 0) {
            return { allMatch: false, hasFailures: false, matchCount: 0, totalCount: 0 };
        }
        const matchCount = validationResults.filter(r => r.matches).length;
        const totalCount = validationResults.length;
        return {
            allMatch: matchCount === totalCount,
            hasFailures: matchCount < totalCount,
            matchCount,
            totalCount
        };
    }, [validationResults]);

    const statusColor = useMemo(() => {
        if (validationResults.length === 0) return 'gray';
        if (allMatch) return 'green';
        return 'red';
    }, [validationResults.length, allMatch]);

    return (
        <Popover.Root onOpenChange={(open) => !open && setShowDetails(false)}>
            <Popover.Trigger>
                <IconButton
                    size="1"
                    variant="ghost"
                    color={statusColor}
                    style={{ cursor: 'pointer' }}
                >
                    {allMatch ? <CheckCircledIcon /> : hasFailures ? <ExclamationTriangleIcon /> : <InfoCircledIcon />}
                </IconButton>
            </Popover.Trigger>
            <Popover.Content width="400px" style={{ maxHeight: '500px', display: 'flex', flexDirection: 'column', padding: '0' }}>
                <Box p="4" style={{ flexShrink: 0 }}>
                    <Heading size="3" mb="1">
                        {group.name} - Total row {group.total}
                    </Heading>
                    <Text size="2" color="gray" mb="2" as="div">
                        Date Column: {validationResults.length}
                    </Text>
                    <Flex gap="3" align="center">
                        <Badge
                            color="green"
                            variant={showDetails && filter === 'valid' ? 'solid' : 'soft'}
                            style={{ cursor: matchCount > 0 ? 'pointer' : 'default' }}
                            onClick={() => {
                                if (matchCount > 0) {
                                    if (showDetails && filter === 'valid') {
                                        setShowDetails(false);
                                    } else {
                                        setShowDetails(true);
                                        setFilter('valid');
                                    }
                                }
                            }}
                        >
                            {matchCount} Valid
                        </Badge>
                        <Badge
                            color="red"
                            variant={showDetails && filter === 'errors' ? 'solid' : 'soft'}
                            style={{ cursor: totalCount - matchCount > 0 ? 'pointer' : 'default' }}
                            onClick={() => {
                                if (totalCount - matchCount > 0) {
                                    if (showDetails && filter === 'errors') {
                                        setShowDetails(false);
                                    } else {
                                        setShowDetails(true);
                                        setFilter('errors');
                                    }
                                }
                            }}
                        >
                            {totalCount - matchCount} Errors
                        </Badge>
                        <Text size='1' color='gray'>Click to see details</Text>
                    </Flex>
                </Box>

                {showDetails && (
                    <>
                        <Separator size="4" />
                        <ScrollArea scrollbars="vertical" style={{ height: '300px' }}>
                            <Box px="4" pb="4">
                                <Flex direction="column" gap="2" pt="2">
                                    {validationResults.length === 0 ? (
                                        <Text size="1" color="gray" style={{ fontStyle: 'italic' }}>
                                            No validation results available for this group.
                                        </Text>
                                    ) : (
                                        validationResults
                                            .filter(r => filter === 'valid' ? r.matches : !r.matches)
                                            .length === 0 && (
                                            <Text size="1" color="gray" style={{ fontStyle: 'italic' }}>
                                                No {filter} results available for this group.
                                            </Text>
                                        )
                                    )}
                                    {validationResults
                                        .filter(r => filter === 'valid' ? r.matches : !r.matches)
                                        .map((result) => {
                                            const headerName = columnHeaders[result.date_column] || `Col ${result.date_column + 1}`;
                                            const variance = result.actual_total - result.calculated_total;

                                            return (
                                                <Box key={`${result.group_name}-${result.date_column}`} p="2" style={{
                                                    backgroundColor: result.matches ? 'var(--green-1)' : 'var(--red-1)',
                                                    borderRadius: 'var(--radius-2)',
                                                    border: `1px solid ${result.matches ? 'var(--green-4)' : 'var(--red-4)'}`
                                                }}>
                                                    <Flex justify="between" align="center" mb="1">
                                                        <Text size="2" weight="bold">
                                                            {headerName}
                                                        </Text>
                                                        {result.matches ? (
                                                            <Badge color="green" variant="soft">Match</Badge>
                                                        ) : (
                                                            <Badge color="red" variant="soft">Mismatch</Badge>
                                                        )}
                                                    </Flex>

                                                    <Flex direction="column" gap="1">
                                                        <Flex justify="between">
                                                            <Text size="1" color="gray">Actual Total:</Text>
                                                            <Text size="1" weight="medium">{result.actual_total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
                                                        </Flex>
                                                        <Flex justify="between">
                                                            <Text size="1" color="gray">Calculated Sum:</Text>
                                                            <Text size="1" weight="medium">{result.calculated_total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
                                                        </Flex>
                                                        <Separator size="4" />
                                                        <Flex justify="between">
                                                            <Text size="1" color={result.matches ? 'green' : 'red'} weight="bold">Variance:</Text>
                                                            <Text size="1" color={result.matches ? 'green' : 'red'} weight="bold">{variance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
                                                        </Flex>
                                                    </Flex>
                                                </Box>
                                            );
                                        })}
                                </Flex>
                            </Box>
                        </ScrollArea>
                    </>
                )}
            </Popover.Content>
        </Popover.Root>
    );
};

