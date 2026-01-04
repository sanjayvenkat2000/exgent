import { createContext, useCallback, use, useState } from "react";
import type { ReactNode } from "react";
import { produce } from "immer";
import { NewMessage, type Event, type CodeExecutionResult, Outcome } from "./googleAdkTypes";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [messages, setMessages] = useState<Event[]>([]);
    const [isStreaming, setIsStreaming] = useState(false);
    const [streamingErrorMessage, setStreamingErrorMessage] = useState<string | null>(null);

    const [fileId, setFileId] = useState<string | null>(null);
    const [sheetIdx, setSheetIdx] = useState<number | null>(null);

    const service = useService();
    const queryClient = useQueryClient();

    const sheetInfoMutation = useMutation({
        mutationFn: async () => {
            if (!fileId || !sheetIdx) {
                return Promise.resolve();
            }
            return;
        },
        onSuccess: () => {
            if (fileId && sheetIdx !== null) {
                queryClient.invalidateQueries({
                    queryKey: ['sheetinfo', fileId, sheetIdx]
                });
            }
        }
    });

    const handleUiExecution = useCallback((codeExecutionResult: CodeExecutionResult) => {

        // Simple system to tell the UI to refresh when new data is available.
        // More complex systems like Ag-UI and A2UI should be considered.
        // We have only one action here, but you can trigger various UI actions in a similar manner
        // by switching on the content of the code execution result `codeExecutionResult.output`.
        console.log('codeExecutionResult', codeExecutionResult);
        if (codeExecutionResult.outcome === Outcome.OUTCOME_OK) {
            console.log('codeExecutionResult.outcome === Outcome.OUTCOME_OK');
            sheetInfoMutation.mutate()
        }
    }, [sheetInfoMutation]);

    const resetChatState = useCallback(() => {
        setSessionId(null);
        setMessages([]);
        setIsStreaming(false);
        setStreamingErrorMessage(null);
    }, [setSessionId, setMessages, setIsStreaming, setStreamingErrorMessage])


    const setChatSession = useCallback(async (fileid: string, sheetIdx: number) => {
        const sessionId = `${fileid}_${sheetIdx}`;

        setSessionId(sessionId);
        setFileId(fileid);
        setSheetIdx(sheetIdx);

        // Clear messages to show loading state or reset
        setMessages([]);

        // Fetch history and set messages
        try {
            const data = await queryClient.fetchQuery({
                queryKey: ['sessionMessages', fileid, sheetIdx],
                queryFn: () => service.getSheetChatHistory(fileid, sheetIdx),
            });
            setMessages(data || []);
        } catch (error) {
            console.error("Failed to fetch chat history:", error);
            setMessages([]);
        }
    }, [service, queryClient, setMessages, setSessionId, setFileId, setSheetIdx]);


    const onMessage = useCallback((chunk: Event, setState: React.Dispatch<React.SetStateAction<Event[]>>) => {

        chunk.content?.parts?.forEach(part => {
            if (part.codeExecutionResult) {
                handleUiExecution(part.codeExecutionResult);
                // @ts-expect-error - code_execution_result is a legacy field name from some backend versions
            } else if (part["code_execution_result"]) {
                // @ts-expect-error - code_execution_result is a legacy field name from some backend versions
                handleUiExecution(part["code_execution_result"]);
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
    }, [handleUiExecution]);

    const sendMessage = useCallback(async (userMessage: string) => {
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