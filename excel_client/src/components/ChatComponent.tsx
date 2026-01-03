import { ChatBubbleIcon, Cross2Icon, PaperPlaneIcon, ChevronDownIcon, ChevronRightIcon } from "@radix-ui/react-icons";
import { Box, Flex, Heading, IconButton, ScrollArea, Text, TextArea, Card, Spinner } from "@radix-ui/themes";
import type { Part } from "../domain/googleAdkTypes";
import Markdown from 'react-markdown';
import { useState, useRef, useEffect, useMemo } from 'react';

import { useChatStream } from '../domain/ChatStreamProvider';

export interface ChatComponentProps {
    isChatOpen: boolean;
    setIsChatOpen: (isChatOpen: boolean) => void;
    fileId?: string;
    sheetIdx?: number;
}

const JsonAccordion = ({ data }: { data: unknown }) => {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <Card style={{ width: '100%', marginTop: '8px', marginBottom: '8px' }}>
            <Flex
                align="center"
                justify="between"
                onClick={() => setIsOpen(!isOpen)}
                style={{ cursor: 'pointer', padding: '8px' }}
            >
                <Text weight="bold">...json</Text>
                {isOpen ? <ChevronDownIcon /> : <ChevronRightIcon />}
            </Flex>
            {isOpen && (
                <Box p="2" style={{ backgroundColor: 'var(--gray-2)', overflowX: 'auto' }}>
                    <pre style={{ margin: 0, fontSize: '12px' }}>
                        {JSON.stringify(data, null, 2)}
                    </pre>
                </Box>
            )}
        </Card>
    );
};

export const ChatComponent = ({ isChatOpen, setIsChatOpen, fileId, sheetIdx }: ChatComponentProps) => {
    const [inputValue, setInputValue] = useState('');
    const scrollAreaRef = useRef<HTMLDivElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const { setChatSession, messages, sendMessage, isStreaming, streamingErrorMessage, clearStreamingErrorMessage } = useChatStream();

    useMemo(() => {
        if (fileId && sheetIdx) {
            setChatSession(fileId, sheetIdx);
        }
    }, [fileId, sheetIdx, setChatSession]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        if (isStreaming) {
            scrollToBottom();
        }
    }, [messages, isStreaming]);

    const handleSend = () => {
        if (inputValue.trim()) {
            sendMessage(inputValue);
            setInputValue('');
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const renderPart = (part: Part, index: number, role: string) => {
        if (part.text !== undefined) {
            let parsedJson = null;
            try {
                // simple heuristic to avoid parsing simple text as JSON (e.g. "123" or "true")
                if (part.text.trim().startsWith('{') || part.text.trim().startsWith('[')) {
                    parsedJson = JSON.parse(part.text);
                }
            } catch {
                // Not valid JSON
            }

            if (parsedJson) {
                return <JsonAccordion key={index} data={parsedJson} />;
            }

            if (role === 'user') {
                return <Text key={index} style={{ fontSize: '13px' }}>{part.text ? part.text : 'Primary Objective'}</Text>;
            } else {
                return (
                    <Box key={index} className="markdown-content">
                        <Markdown>{part.text}</Markdown>
                    </Box>
                );
            }
        }
        return null;
    };

    console.log('messages', messages);

    return (
        <Box style={{
            width: isChatOpen ? '40%' : '0%',
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            overflow: 'hidden',
            transition: 'width 0.3s ease-in-out',
            opacity: isChatOpen ? 1 : 0,
            pointerEvents: isChatOpen ? 'auto' : 'none',
            position: 'relative',
            borderLeft: '1px solid var(--gray-5)',
            backgroundColor: 'var(--color-background)'
        }}>
            <style>{`
                .markdown-content {
                    font-size: 14px;
                    line-height: 1.5;
                }
                .markdown-content p {
                    margin-top: 4px;
                    margin-bottom: 4px;
                }
                .markdown-content h1, 
                .markdown-content h2, 
                .markdown-content h3, 
                .markdown-content h4 {
                    margin-top: 8px;
                    margin-bottom: 4px;
                }
                .markdown-content ul, 
                .markdown-content ol {
                    margin-top: 4px;
                    margin-bottom: 4px;
                    padding-left: 20px;
                }
                .markdown-content li {
                    margin-bottom: 2px;
                }
                .markdown-content pre {
                    margin-top: 8px;
                    margin-bottom: 8px;
                    padding: 8px;
                    border-radius: 4px;
                    background-color: var(--gray-3);
                    overflow-x: auto;
                }
                .markdown-content code {
                    font-size: 12px;
                    background-color: var(--gray-3);
                    padding: 2px 4px;
                    border-radius: 4px;
                }
                .markdown-content > *:first-child {
                    margin-top: 0;
                }
                .markdown-content > *:last-child {
                    margin-bottom: 0;
                }
            `}</style>
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

            <ScrollArea style={{ flexGrow: 1 }} ref={scrollAreaRef}>
                <Flex direction="column" style={{ minHeight: '100%', padding: '20px', paddingBottom: '0px' }}>
                    {messages && messages.length === 0 && (
                        <Flex direction="column" align="center" justify="center" style={{ flexGrow: 1, height: '100%', marginTop: '50%' }} gap="4">
                            <Box p="4" style={{ backgroundColor: 'var(--gray-3)', borderRadius: '50%' }}>
                                <ChatBubbleIcon width="32" height="32" color="var(--gray-11)" />
                            </Box>
                            <Heading size="4" align="center" color="gray">Start a conversation</Heading>
                            <Text align="center" color="gray" style={{ maxWidth: 300 }}>
                                Ask questions about your data, analyze trends, or extract insights.
                            </Text>
                        </Flex>
                    )}
                    {messages && messages.map((message, msgIndex) => {
                        const role = message.content?.role || 'model'; // Default to model if undefined
                        const isUser = role === 'user';

                        return (
                            <Flex
                                key={message.id || msgIndex}
                                justify={isUser ? 'end' : 'start'}
                                style={{ marginBottom: '16px', width: '100%' }}
                            >
                                <Box
                                    style={{
                                        maxWidth: isUser ? '80%' : '100%',
                                        width: isUser ? 'auto' : '100%',
                                        padding: '8px 12px',
                                        borderRadius: '12px',
                                        backgroundColor: isUser ? 'var(--accent-9)' : 'transparent',
                                        color: isUser ? 'white' : 'inherit',
                                        borderBottomRightRadius: isUser ? '2px' : '12px',
                                        borderBottomLeftRadius: isUser ? '12px' : '2px',
                                    }}
                                >
                                    {message.content?.parts?.map((part, partIndex) => renderPart(part, partIndex, role))}
                                </Box>
                            </Flex>
                        );
                    })}
                    <div ref={messagesEndRef} />
                </Flex>
            </ScrollArea>

            {/* Chat Input */}
            <Box p="4" style={{ borderTop: '1px solid var(--gray-5)', position: 'relative' }}>
                {isStreaming && !streamingErrorMessage && (
                    <Flex gap="2" align="center" style={{ marginBottom: '8px', paddingLeft: '4px' }}>
                        <Spinner size="1" />
                        <Text size="1" color="gray" style={{ fontStyle: 'italic' }}>AI is thinking...</Text>
                    </Flex>
                )}
                {(streamingErrorMessage) && (
                    <Box
                        style={{
                            position: 'absolute',
                            bottom: '100%',
                            left: '20px',
                            right: '20px',
                            backgroundColor: 'var(--red-3)',
                            color: 'var(--red-11)',
                            padding: '8px 12px',
                            borderRadius: '6px',
                            marginBottom: '8px',
                            border: '1px solid var(--red-6)',
                            fontSize: '14px',
                            zIndex: 10,
                            boxShadow: 'var(--shadow-3)'
                        }}
                    >
                        <Flex justify="between" align="center">
                            <Flex gap="2" align="center">
                                <Text weight="bold">Error:</Text>
                                <Text>{streamingErrorMessage || "This is a dummy error message."}</Text>
                            </Flex>
                            <IconButton
                                size="1"
                                variant="ghost"
                                color="red"
                                onClick={clearStreamingErrorMessage}
                                style={{ marginLeft: '8px' }}
                            >
                                <Cross2Icon width="14" height="14" />
                            </IconButton>
                        </Flex>
                    </Box>
                )}
                <Flex gap="2" align="end">
                    <TextArea
                        placeholder="Type a message..."
                        style={{ flexGrow: 1, minHeight: '40px', maxHeight: '120px' }}
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        size="2"
                        disabled={isStreaming}
                    />
                    <IconButton
                        size="3"
                        variant="solid"
                        onClick={handleSend}
                        disabled={!inputValue.trim() || isStreaming}
                    >
                        <PaperPlaneIcon width="18" height="18" />
                    </IconButton>
                </Flex>
            </Box>
        </Box >
    );
};
