import { createContext, useCallback, use, useState } from "react";
import type { ReactNode } from "react";
import { NewMessage, type Event } from "./googleAdkTypes";
import { useQuery } from "@tanstack/react-query";
import { useService } from "./serviceProvider";


/**
 * This is the interface for a request to run an ADK Agent
 */
export interface RunAgentRequest {
    appName: string;
    userId: string;
    sessionId: string;
    newMessage: {
        parts: { text: string }[];
        role: string;
    };
    streaming: boolean;
}

// Define the context type based on the return value of useAgnoStream
type ChatStreamContextType = ReturnType<typeof useChatStreamLogic>;

// Create the context with a default undefined value
const ChatStreamContext = createContext<ChatStreamContextType | undefined>(undefined);

// Define props for the provider, including children and necessary config
interface ChatStreamProviderProps {
    children: ReactNode;
    apiUrl: string;
}

export interface SessionState {
    messages: Event[];
    isStreaming: boolean;
    streamingErrorMessage: string | null;
    user_id: string | null;
}

// Rename the original hook to avoid naming conflicts
const useChatStreamLogic = (apiUrl: string) => {
    const [appName, setAppName] = useState<string | null>(null);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [messages, setMessages] = useState<Event[]>([]);
    const [isStreaming, setIsStreaming] = useState(false);
    const [streamingErrorMessage, setStreamingErrorMessage] = useState<string | null>(null);

    const [fileId, setFileId] = useState<string | null>(null);
    const [sheetIdx, setSheetIdx] = useState<number | null>(null);
    const service = useService();


    const resetChatState = useCallback(() => {
        setSessionId(null);
        setMessages([]);
        setIsStreaming(false);
        setStreamingErrorMessage(null);
        setAppName(null);
    }, [setAppName, setSessionId, setMessages, setIsStreaming, setStreamingErrorMessage])

    //Load the chat history
    useQuery({
        queryKey: ['sessionMessages', sessionId, appName],
        queryFn: async (): Promise<Event[]> => {
            if (!fileId || !sheetIdx) {
                return Promise.resolve([]);
            }
            return service.getSheetChatHistory(fileId, sheetIdx)
                .then(data => {
                    setMessages(data || []);
                    return data;
                });
        },
        enabled: !!fileId && !!sheetIdx,
    })


    const setSession = useCallback((fileid: string, sheetIdx: number) => {
        const sessionId = `${fileid}_${sheetIdx}`;
        const appName = "excel_tag";
        setMessages([]);
        setSessionId(sessionId);
        setAppName(appName);
        setFileId(fileid);
        setSheetIdx(sheetIdx);
    }, [setMessages, setSessionId, setAppName, setFileId, setSheetIdx]);

    console.log('messages', messages);

    const onMessage = useCallback((chunk: Event, setState: React.Dispatch<React.SetStateAction<Event[]>>) => {
        setState((s) => {
            const newMessages = [...s];
            if (newMessages.length === 0) {
                newMessages.push(chunk);
                return newMessages;
            }

            const lastMessage = newMessages[newMessages.length - 1];
            if (lastMessage && lastMessage.partial) {
                if (chunk.partial) {
                    const lastMessageText = lastMessage.content?.parts?.[0]?.text;
                    const currentText = chunk.content?.parts?.[0]?.text;

                    if (lastMessageText !== undefined && currentText !== undefined) {
                        const newText = lastMessageText + currentText;

                        const updatedMessage = {
                            ...lastMessage,
                            content: {
                                ...lastMessage.content,
                                parts: [{ text: newText }],
                            },
                        };
                        newMessages[newMessages.length - 1] = updatedMessage;
                    }
                } else {
                    newMessages[newMessages.length - 1] = chunk;
                }
            } else {
                newMessages.push(chunk);
            }
            return newMessages;
        });
    }, []);

    const sendMessage = useCallback(async (userMessage: string, appName: string = "governor") => {
        if (sessionId === null) {
            console.error("No session id found. Set session id before sending messages.");
            return;
        }
        if (userMessage.trim() === '') {
            return;
        }
        setIsStreaming(true);
        setStreamingErrorMessage(null);
        setMessages(messages => [...messages, NewMessage(userMessage, 'user')]);

        const headers: Record<string, string> = {
            "Content-Type": "application/json",
        }

        const agentRunRequest: RunAgentRequest = {
            appName: appName,
            userId: "user",
            sessionId: sessionId,
            newMessage: {
                parts: [{ text: userMessage }],
                role: 'user'
            },
            streaming: true,
        }
        const urlEndpoint = 'run_sse'
        // const buffer = ''
        fetch(`${apiUrl}/${urlEndpoint}`, {
            method: "POST",
            headers,
            body: JSON.stringify(agentRunRequest),
            // body: JSON.stringify({ 'query': message, 'session_id': sessionId }),
        }).then((response) => {
            if (!response.ok) {
                throw new Error(`API request failed with status ${response.status}`);
            }
            if (!response.ok) {
                throw new Error(`API request failed with status ${response.status}`);
            }
            if (!response.body) {
                throw new Error("Response body is null");
            }
            // processStream()
            const reader = response.body?.getReader();
            const decoder = new TextDecoder('utf-8');
            let lastData = '';

            const read = () => {
                reader?.read()
                    .then(({ done, value }) => {
                        setIsStreaming(true);
                        if (done) {
                            setIsStreaming(false);
                            return;
                        }
                        const chunk = decoder.decode(value, { stream: true });
                        lastData += chunk;
                        try {
                            const lines = lastData.split(/\r?\n/).filter(
                                (line) => line.startsWith('data:'));
                            lines.forEach((line) => {
                                const data = line.replace(/^data:\s*/, '');
                                const parsedData = JSON.parse(data);
                                onMessage(parsedData, setMessages);
                            });
                            lastData = '';
                        } catch (e) {
                            // the data is not a valid json, it could be an incomplete
                            // chunk. we ignore it and wait for the next chunk.
                            if (e instanceof SyntaxError) {
                                read();
                            }
                        }
                        read();  // Read the next chunk
                    })
                    .catch((err) => {
                        setStreamingErrorMessage(err.message);
                        setIsStreaming(false);
                    });
            };

            read();
        })
            .catch((err) => {
                setStreamingErrorMessage(err.message);
                setIsStreaming(false);
            });

    }, [apiUrl, onMessage, sessionId])


    return {
        messages,
        isStreaming,
        streamingErrorMessage,
        setSession,
        sendMessage,
        resetChatState,    // createNewSession,
    }
}

// Create the provider component
export const ChatStreamProvider = ({ children, apiUrl }: ChatStreamProviderProps) => {
    const streamLogic = useChatStreamLogic(apiUrl);

    return (
        <ChatStreamContext value={streamLogic}>
            {children}
        </ChatStreamContext>
    );
};// Create the consumer hook
export const useChatStream = (): ChatStreamContextType => {
    const context = use(ChatStreamContext);
    if (context === undefined) {
        throw new Error('useChatStream must be used within an ChatStreamProvider');
    }
    return context;
};