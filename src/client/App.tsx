import "@excalidraw/excalidraw/index.css";
import { Excalidraw } from "@excalidraw/excalidraw";
import { useAgentChat } from "@cloudflare/ai-chat/react";
import { useAgent } from "agents/react";
import { useEffect, useState, useRef } from "react";
import { ChatInput } from "./components/ChatInput";
import MessageList from "./components/MessageList";
import type { ExcalidrawElementSkeleton } from "@excalidraw/excalidraw/data/transform";
import { useExcaliDrawHook } from "./hooks/useExcaliDrawHook";
import { serializeCanvasState } from "./services/createCanvasState";

const sessionId = crypto.randomUUID();

export default function App() {
    const agent = useAgent({ agent: "ExcaliAgent", name: sessionId });
    const { bindApi, service, api } = useExcaliDrawHook();

    const pendingResolversRef = useRef<Map<string, (approved: boolean) => void>>(new Map());
    const [pendingToolCallIds, setPendingToolCallIds] = useState<Set<string>>(new Set());
    const [toolDecisions, setToolDecisions] = useState<Record<string, boolean>>({});

    const handleToolDecision = (toolCallId: string, approved: boolean) => {
        const resolver = pendingResolversRef.current.get(toolCallId);
        if (resolver) {
            resolver(approved);
            pendingResolversRef.current.delete(toolCallId);
            setPendingToolCallIds((prev) => {
                const next = new Set(prev);
                next.delete(toolCallId);
                return next;
            });
            setToolDecisions((prev) => ({ ...prev, [toolCallId]: approved }));
        }
    };

    const { messages, sendMessage, status, clearHistory, addToolApprovalResponse } = useAgentChat({
        agent,
        onToolCall: async ({ toolCall, addToolOutput }) => {
            const approved = await new Promise<boolean>((resolve) => {
                pendingResolversRef.current.set(toolCall.toolCallId, resolve);
                setPendingToolCallIds((prev) => new Set(prev).add(toolCall.toolCallId));
            });

            if (!approved) {
                addToolOutput({
                    toolCallId: toolCall.toolCallId,
                    output: `Tool execution for "${toolCall.toolName}" was denied by user.`,
                });
                return;
            }

            if (toolCall.toolName === "clearCanvas") {
                addToolOutput({
                    toolCallId: toolCall.toolCallId,
                    output: `${service.clearCanvas() ? "Canvas Cleared" : "Could not clear the canvas"}`,
                });
            }

            if (toolCall.toolName === "getCanvasState") {
                addToolOutput({
                    toolCallId: toolCall.toolCallId,
                    output: `${api ? serializeCanvasState(service.getCanvasState()) : "canvas is empty"}`,
                });
            }

            if (toolCall.toolName === "drawElements") {
                const { elements } = toolCall.input as {
                    elements: ExcalidrawElementSkeleton[];
                };
                service.createElements(elements);

                addToolOutput({
                    toolCallId: toolCall.toolCallId,
                    output: `created ${elements.length} new elements`,
                });
            }

            if (toolCall.toolName === "deleteElements") {
                const { elements } = toolCall.input as {
                    elements: { id: string }[];
                };

                service.deleteElements(elements);

                addToolOutput({
                    toolCallId: toolCall.toolCallId,
                    output: `deleted ${elements.length} new elements`,
                });
            }

            if (toolCall.toolName === "modifyElements") {
                let elements = (
                    toolCall.input as {
                        elements: ({
                            id: string;
                            label?: {
                                text?: string;
                                fontSize?: number;
                                fontFamily?: number;
                                textAlign?: "left" | "center" | "right";
                                verticalAlign?: "top" | "middle" | "bottom";
                            };
                        } & Partial<ExcalidrawElementSkeleton>)[];
                    }
                ).elements;

                service.modifyElements(elements);

                addToolOutput({
                    toolCallId: toolCall.toolCallId,
                    output: `modified ${elements.length} new elements`,
                });
            }
        },
    });
    const [input, setInput] = useState("");

    useEffect(() => {
        clearHistory();
    }, []);

    return (
        <div className="flex h-screen">
            <div className="w-4/5 h-screen">
                <Excalidraw excalidrawAPI={bindApi} />
            </div>
            <div className="w-2/5 flex flex-col m-5 rounded-2xl bg-white shadow-xl">
                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                    <MessageList
                        messages={messages}
                        pendingToolCallIds={pendingToolCallIds}
                        toolDecisions={toolDecisions}
                        onToolDecision={handleToolDecision}
                        onToolApprovalResponse={addToolApprovalResponse}
                    />
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
