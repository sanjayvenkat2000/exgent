import { createContext, useCallback, use, useState } from "react";
import type { ReactNode } from "react";
import { produce } from "immer";
import { NewMessage, type Event, type CodeExecutionResult } from "./googleAdkTypes";
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

    const executeUiCode = useCallback((result: CodeExecutionResult) => {
        console.log("Executing UI code from result:", result);
        // This is where you would handle the specific instructions
        // like updating tags, sheet structures, etc.
    }, []);

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


    const setChatSession = useCallback((fileid: string, sheetIdx: number) => {
        const sessionId = `${fileid}_${sheetIdx}`;
        const appName = "excel_tag";
        setMessages([]);
        setSessionId(sessionId);
        setAppName(appName);
        setFileId(fileid);
        setSheetIdx(sheetIdx);
    }, [setMessages, setSessionId, setAppName, setFileId, setSheetIdx]);


    const onMessage = useCallback((chunk: Event, setState: React.Dispatch<React.SetStateAction<Event[]>>) => {
        // Prepend "LIVE: " to any code execution result output returned in stream.
        chunk.content?.parts?.forEach(part => {
            if (part.codeExecutionResult) {
                executeUiCode(part.codeExecutionResult);
            } else if (part["code_execution_result"]) {
                executeUiCode(part["code_execution_result"]);
            }
        });

        setState(produce((draft) => {
            if (draft.length === 0) {
                draft.push(chunk);
                return;
            }

            const lastMessage = draft[draft.length - 1];
            if (lastMessage && lastMessage.partial) {
                if (chunk.partial) {
                    const lastPart = lastMessage.content?.parts?.[0];
                    const chunkPart = chunk.content?.parts?.[0];

                    if (lastPart && chunkPart) {
                        if (chunkPart.text !== undefined) {
                            lastPart.text = (lastPart.text || "") + chunkPart.text;
                        }
                        if (chunkPart.codeExecutionResult) {
                            lastPart.codeExecutionResult = chunkPart.codeExecutionResult;
                        }
                    }
                } else {
                    draft[draft.length - 1] = chunk;
                }
            } else {
                draft.push(chunk);
            }
        }));
    }, [executeUiCode]);

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

        // const agentRunRequest: RunAgentRequest = {
        //     appName: appName,
        //     userId: "user",
        //     sessionId: sessionId,
        //     newMessage: {
        //         parts: [{ text: userMessage }],
        //         role: 'user'
        //     },
        //     streaming: true,
        // }
        // const buffer = ''
        fetch(`${apiUrl}/sheetchat/${fileId}/${sheetIdx}`, {
            method: "POST",
            headers,
            body: JSON.stringify({
                "user_input": userMessage,
            }),
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

    }, [apiUrl, onMessage, sessionId, fileId, sheetIdx])


    const clearStreamingErrorMessage = useCallback(() => {
        setStreamingErrorMessage(null);
    }, []);

    return {
        messages,
        isStreaming,
        streamingErrorMessage,
        setChatSession,
        sendMessage,
        resetChatState,    // createNewSession,
        clearStreamingErrorMessage,
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