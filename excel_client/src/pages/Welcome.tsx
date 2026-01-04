import { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Flex, Text, Heading, Button, Card, Table, Box, Container, ScrollArea, Badge, Separator } from '@radix-ui/themes';
import { useService } from '../domain/serviceProvider';

interface UserFile {
    file_id: string;
    original_filename: string;
    user_id: string;
    create_date: string;
}

export const Welcome = () => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const service = useService();

    // Fetch Files
    const { data: files, isLoading, isError } = useQuery<UserFile[]>({
        queryKey: ['files'],
        queryFn: async () => {
            return service.listFiles();
        }
    });

    // Upload File
    const uploadMutation = useMutation({
        mutationFn: async (file: File) => {
            return service.uploadFile(file);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['files'] });
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        },
    });

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            uploadMutation.mutate(e.target.files[0]);
        }
    };

    const handleUploadClick = () => {
        fileInputRef.current?.click();
    };

    return (
        <Container size="4" p="5">
            {/* Top Section */}
            <Flex gap="6" direction={{ initial: 'column', md: 'row' }} mb="8" align="stretch">
                {/* Intro Message */}
                <Box flexGrow="1" p="4">
                    <Heading size="8" mb="4" style={{ color: 'var(--accent-9)' }}>Welcome to Exgent</Heading>
                    <Text size="4" as="p" mb="4" color="gray">
                        Your professional AI agent designed to handle <b>very large Excel files</b> with ease. <br />
                        Exgent's <b>Primary Objective</b> is to tag the data into your internal ontology.
                        You can also <b>converse</b> with Exgent about information in the files.
                    </Text>
                    <Flex gap="3" mt="6">
                        <Badge color="blue" size="2">Large File Support</Badge>
                        <Badge color="green" size="2">Internal Ontology Tagging</Badge>
                        <Badge color="orange" size="2">Instant Insights</Badge>
                    </Flex>
                </Box>

                {/* Vertical Separator for desktop */}
                <Box display={{ initial: 'none', md: 'block' }}>
                    <Separator orientation="vertical" size="4" style={{ height: '100%' }} />
                </Box>

                {/* Upload CTA */}
                <Card style={{ minWidth: '300px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: 'var(--space-6)', border: '2px dashed var(--gray-6)' }}>
                    <Flex direction="column" align="center" gap="4">
                        <Heading size="4">Upload Excel File</Heading>
                        <Text size="2" color="gray" align="center">
                            Drag & drop or click to upload
                        </Text>
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileChange}
                            style={{ display: 'none' }}
                            accept=".xlsx, .xls, .csv"
                        />
                        <Button size="3" onClick={handleUploadClick} disabled={uploadMutation.isPending} style={{ cursor: 'pointer' }}>
                            {uploadMutation.isPending ? 'Uploading...' : 'Select File'}
                        </Button>
                        {uploadMutation.isError && (
                            <Text color="red" size="1">Upload failed. Please try again.</Text>
                        )}
                    </Flex>
                </Card>
            </Flex>

            {/* File Listing Section */}
            <Box>
                <Heading size="5" mb="4">Existing Files</Heading>
                <Card>
                    <ScrollArea type="auto" scrollbars="vertical" style={{ height: 400 }}>
                        <Table.Root>
                            <Table.Header>
                                <Table.Row>
                                    <Table.ColumnHeaderCell>File Name</Table.ColumnHeaderCell>
                                    <Table.ColumnHeaderCell>Sheets</Table.ColumnHeaderCell>
                                    <Table.ColumnHeaderCell>Created Date</Table.ColumnHeaderCell>
                                    <Table.ColumnHeaderCell>Actions</Table.ColumnHeaderCell>
                                </Table.Row>
                            </Table.Header>

                            <Table.Body>
                                {isLoading && (
                                    <Table.Row>
                                        <Table.Cell colSpan={3}>Loading files...</Table.Cell>
                                    </Table.Row>
                                )}
                                {isError && (
                                    <Table.Row>
                                        <Table.Cell colSpan={3}><Text color="red">Error loading files</Text></Table.Cell>
                                    </Table.Row>
                                )}
                                {!isLoading && !isError && files?.length === 0 && (
                                    <Table.Row>
                                        <Table.Cell colSpan={3}><Text color="gray">No files found. Upload one to get started.</Text></Table.Cell>
                                    </Table.Row>
                                )}
                                {files?.map((file) => (
                                    <Table.Row key={file.file_id}>
                                        <Table.Cell>
                                            <Flex align="center" gap="2">
                                                <Box style={{ width: 20, height: 20, backgroundColor: 'var(--green-9)', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 10 }}>X</Box>
                                                <Text weight="bold">{file.original_filename}</Text>
                                            </Flex>
                                        </Table.Cell>
                                        <Table.Cell>
                                            <Text color="gray">-</Text> {/* Number of sheets not available in list API */}
                                        </Table.Cell>
                                        <Table.Cell>
                                            {new Date(file.create_date).toLocaleDateString()} {new Date(file.create_date).toLocaleTimeString()}
                                        </Table.Cell>
                                        <Table.Cell>
                                            <Button size="1" variant="soft" onClick={() => navigate(`/file/${file.file_id}/0`)}>
                                                View Details
                                            </Button>
                                        </Table.Cell>
                                    </Table.Row>
                                ))}
                            </Table.Body>
                        </Table.Root>
                    </ScrollArea>
                </Card>
            </Box>
        </Container >
    );
};
