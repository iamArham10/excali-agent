import "@excalidraw/excalidraw/index.css";
import { Excalidraw } from "@excalidraw/excalidraw";
import { useAgentChat } from "@cloudflare/ai-chat/react";
import { useAgent } from "agents/react";
import { useEffect, useState, useRef, type CSSProperties } from "react";
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
    const [assistantWidth, setAssistantWidth] = useState(400);
    const [isAssistantCollapsed, setIsAssistantCollapsed] = useState(false);
    const [mobileView, setMobileView] = useState<"canvas" | "assistant">("canvas");

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
    const workspaceStyle = {
        "--assistant-width": `${assistantWidth}px`,
    } as CSSProperties;

    const beginResize = (event: React.PointerEvent<HTMLDivElement>) => {
        event.preventDefault();
        const onPointerMove = (pointerEvent: PointerEvent) => {
            setAssistantWidth(
                Math.min(560, Math.max(340, window.innerWidth - pointerEvent.clientX)),
            );
        };
        const stopResize = () => {
            document.body.classList.remove("is-resizing");
            window.removeEventListener("pointermove", onPointerMove);
            window.removeEventListener("pointerup", stopResize);
        };

        document.body.classList.add("is-resizing");
        window.addEventListener("pointermove", onPointerMove);
        window.addEventListener("pointerup", stopResize);
    };

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
        <main
            className={`app-shell ${isAssistantCollapsed ? "assistant-collapsed" : ""}`}
            data-mobile-view={mobileView}
            style={workspaceStyle}
        >
            <nav className="mobile-switch" aria-label="Workspace view">
                <button
                    type="button"
                    className={mobileView === "canvas" ? "is-active" : ""}
                    onClick={() => setMobileView("canvas")}
                >
                    Canvas
                </button>
                <button
                    type="button"
                    className={mobileView === "assistant" ? "is-active" : ""}
                    onClick={() => setMobileView("assistant")}
                >
                    Assistant
                    {isBusy && <span className="mobile-activity-dot" aria-label="Working" />}
                </button>
            </nav>
            <section className="canvas-panel" aria-label="Drawing canvas">
                <Excalidraw excalidrawAPI={bindApi} />
            </section>
            <div
                className="panel-resize-handle"
                role="separator"
                aria-label="Resize assistant panel"
                aria-orientation="vertical"
                aria-valuemin={340}
                aria-valuemax={560}
                aria-valuenow={assistantWidth}
                tabIndex={0}
                onPointerDown={beginResize}
                onKeyDown={(event) => {
                    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
                    event.preventDefault();
                    const direction = event.key === "ArrowLeft" ? 16 : -16;
                    setAssistantWidth((width) =>
                        Math.min(560, Math.max(340, width + direction)),
                    );
                }}
            />
            <aside className="chat-panel" aria-label="Diagram assistant">
                <header className="chat-header">
                    <div className="brand-mark" aria-hidden="true">
                        <span />
                        <span />
                        <span />
                    </div>
                    <div className="header-copy">
                        <div className="header-title-row">
                            <h1>EXCALI</h1>
                            <span className={`agent-status ${isBusy ? "is-busy" : ""}`}>
                                <i aria-hidden="true" />
                                {isBusy ? "Working" : "Ready"}
                            </span>
                        </div>
                        <p>Diagram workspace</p>
                    </div>
                    <button
                        type="button"
                        className="panel-toggle"
                        aria-label={
                            isAssistantCollapsed
                                ? "Expand assistant panel"
                                : "Collapse assistant panel"
                        }
                        title={
                            isAssistantCollapsed
                                ? "Expand assistant panel"
                                : "Collapse assistant panel"
                        }
                        onClick={() => setIsAssistantCollapsed((collapsed) => !collapsed)}
                    >
                        <svg viewBox="0 0 20 20" aria-hidden="true">
                            <path
                                d={
                                    isAssistantCollapsed
                                        ? "m7.5 5 5 5-5 5"
                                        : "m12.5 5-5 5 5 5"
                                }
                            />
                        </svg>
                    </button>
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
                        onPromptSelect={(prompt) => {
                            setInput(prompt);
                            setMobileView("assistant");
                        }}
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
