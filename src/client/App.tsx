import "@excalidraw/excalidraw/index.css";
import { Excalidraw } from "@excalidraw/excalidraw";
import { getToolCallId, useAgentChat } from "@cloudflare/ai-chat/react";
import { useAgent } from "agents/react";
import { useEffect, useRef, useState } from "react";
import { ChatInput } from "./components/ChatInput";
import MessageList from "./components/MessageList";
import { getToolName, isToolUIPart } from "ai";
import type { ExcalidrawElementSkeleton } from "@excalidraw/excalidraw/data/transform";
import { useExcaliDrawHook } from "./hooks/useExcaliDrawHook";
import { serializeCanvasState } from "./services/createCanvasState";

const sessionId = crypto.randomUUID();

export default function App() {
    const agent = useAgent({ agent: "ExcaliAgent", name: sessionId });
    const { messages, sendMessage, status, clearHistory } = useAgentChat({
        agent,
        prepareSendMessagesRequest: async () => {
            return {
                body: {
                    canvasState: api
                        ? serializeCanvasState(service.getCanvasState())
                        : "canvas is empty",
                },
            };
        },
        onToolCall: async ({ toolCall, addToolOutput }) => {
            if (toolCall.toolName === "drawElements") {
                const { elements } = toolCall.input as { elements: ExcalidrawElementSkeleton[] }
                service.createElements(elements)

                addToolOutput({
                    toolCallId: toolCall.toolCallId, output: `created ${elements.length} new elements`
                })
            }

            if (toolCall.toolName === "deleteElements") {
                const { elements } = toolCall.input as {
                    elements: { id: string }[];
                };

                service.deleteElements(elements);

                addToolOutput({
                    toolCallId: toolCall.toolCallId, output: `deleted ${elements.length} new elements`
                })
            }


            if (toolCall.toolName === "modifyElements") {
                let elements = (
                    toolCall.input as {
                        elements: ({
                            id: string;
                            label?: { text: string };
                        } & Partial<ExcalidrawElementSkeleton>)[];
                    }
                ).elements;

                service.modifyElements(elements);

                addToolOutput({
                    toolCallId: toolCall.toolCallId, output: `modified ${elements.length} new elements`
                })
            }
        }
    });
    const [input, setInput] = useState("");
    const alreadyExecuted = useRef<Set<string>>(new Set());
    const { bindApi, service, api } = useExcaliDrawHook();

    useEffect(() => {
        clearHistory();
    }, []);

    useEffect(() => {
        if (!api) return;

        for (const message of messages) {
            if (message.role !== "assistant") continue;
            for (const part of message.parts) {
                if (!isToolUIPart(part)) continue;
                if (part.state !== "output-available") continue;
                const toolName = getToolName(part);
                const toolId = getToolCallId(part);
                if (alreadyExecuted.current.has(toolId)) continue;
                alreadyExecuted.current.add(toolId);


                if (toolName === "modifyElements") {
                    const elements = (
                        part.output as {
                            elements: ({
                                id: string;
                                label?: { text: string };
                            } & Partial<ExcalidrawElementSkeleton>)[];
                        }
                    ).elements;
                    service.modifyElements(elements);
                }

            }
        }
    }, [messages, api]);

    return (
        <div className="flex h-screen">
            <div className="w-4/5 h-screen">
                <Excalidraw excalidrawAPI={bindApi} />
            </div>
            <div className="w-2/5 flex flex-col m-5 rounded-2xl bg-white shadow-xl">
                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                    <MessageList messages={messages} />
                </div>
                <ChatInput
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onSubmit={(e) => {
                        e.preventDefault();
                        if (!input.trim()) return;
                        sendMessage({ text: input });
                        setInput("");
                    }}
                    disabled={status !== "ready"}
                />
            </div>
        </div>
    );
}
