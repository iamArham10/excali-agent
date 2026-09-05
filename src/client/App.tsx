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
const AUTO_APPROVED_CLIENT_TOOLS = new Set([
    "drawElements",
    "modifyElements",
    "getCanvasState",
]);

export default function App() {
    const agent = useAgent({ agent: "ExcaliAgent", name: sessionId });
    const { bindApi, service, api } = useExcaliDrawHook();
    const chatScrollRef = useRef<HTMLDivElement>(null);
    const shouldAutoScrollRef = useRef(true);

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
            const approved = AUTO_APPROVED_CLIENT_TOOLS.has(toolCall.toolName)
                ? true
                : await new Promise<boolean>((resolve) => {
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
    const isBusy = status === "submitted" || status === "streaming";

    useEffect(() => {
        clearHistory();
    }, []);

    useEffect(() => {
        if (!shouldAutoScrollRef.current) return;
        chatScrollRef.current?.scrollTo({
            top: chatScrollRef.current.scrollHeight,
            behavior: status === "streaming" ? "auto" : "smooth",
        });
    }, [messages, pendingToolCallIds, status]);

    useEffect(
        () => () => {
            for (const resolve of pendingResolversRef.current.values()) {
                resolve(false);
            }
            pendingResolversRef.current.clear();
        },
        [],
    );

    return (
        <main className="app-shell">
            <section className="canvas-panel" aria-label="Drawing canvas">
                <Excalidraw excalidrawAPI={bindApi} />
            </section>
            <aside className="chat-panel" aria-label="Diagram assistant">
                <header className="chat-header">
                    <div className="assistant-mark" aria-hidden="true">
                        ✦
                    </div>
                    <div>
                        <h1>Diagram assistant</h1>
                        <p>Describe what you want to create</p>
                    </div>
                </header>

                <div
                    ref={chatScrollRef}
                    className="chat-scroll"
                    onScroll={(event) => {
                        const element = event.currentTarget;
                        const distanceFromBottom =
                            element.scrollHeight - element.scrollTop - element.clientHeight;
                        shouldAutoScrollRef.current = distanceFromBottom < 96;
                    }}
                >
                    <MessageList
                        messages={messages}
                        status={status}
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
                        shouldAutoScrollRef.current = true;
                    }}
                    busy={isBusy}
                />
            </aside>
        </main>
    );
}
