import "@excalidraw/excalidraw/index.css";
import { Excalidraw } from "@excalidraw/excalidraw";
import { useAgentChat } from "@cloudflare/ai-chat/react";
import { useAgent } from "agents/react";
import { useEffect, useState, useRef } from "react";
import { ChatInput } from "./components/ChatInput";
import MessageList from "./components/MessageList";
import { useExcaliDrawHook } from "./hooks/useExcaliDrawHook";
import { useResizableSidebar } from "./hooks/useResizableSidebar";
import { useTheme } from "./hooks/useTheme";
import { useToolDispatcher } from "./hooks/useToolDispatcher";
import { Icon } from "./components/Icons";

const sessionId = crypto.randomUUID();
const AUTO_APPROVED_CLIENT_TOOLS = new Set([
    "createDiagram",
    "updateDiagram",
    "getCanvasState",
]);

export default function App() {
    const agent = useAgent({ agent: "ExcaliAgent", name: sessionId });
    const { bindApi, service, api } = useExcaliDrawHook();
    const { theme, toggleTheme } = useTheme();
    const chatScrollRef = useRef<HTMLDivElement>(null);
    const shouldAutoScrollRef = useRef(true);
    const [isAssistantCollapsed, setIsAssistantCollapsed] = useState(false);
    const [mobileView, setMobileView] = useState<"canvas" | "assistant">(
        "canvas",
    );

    const pendingResolversRef = useRef<
        Map<string, (approved: boolean) => void>
    >(new Map());
    const [pendingToolCallIds, setPendingToolCallIds] = useState<Set<string>>(
        new Set(),
    );
    const [toolDecisions, setToolDecisions] = useState<Record<string, boolean>>(
        {},
    );

    const { assistantWidth, workspaceStyle, beginResize, handleKeyDown } =
        useResizableSidebar();

    const executeTool = useToolDispatcher(service, api);

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

    const {
        messages,
        sendMessage,
        status,
        error,
        stop,
        regenerate,
        clearError,
        clearHistory,
        addToolApprovalResponse,
    } = useAgentChat({
        agent,
        throttle: 50,
        onToolCall: async ({ toolCall, addToolOutput }) => {
            const approved = AUTO_APPROVED_CLIENT_TOOLS.has(toolCall.toolName)
                ? true
                : await new Promise<boolean>((resolve) => {
                      pendingResolversRef.current.set(
                          toolCall.toolCallId,
                          resolve,
                      );
                      setPendingToolCallIds((prev) =>
                          new Set(prev).add(toolCall.toolCallId),
                      );
                  });

            if (!approved) {
                addToolOutput({
                    toolCallId: toolCall.toolCallId,
                    output: `Tool execution for "${toolCall.toolName}" was denied by user.`,
                });
                return;
            }

            await executeTool({ toolCall, addToolOutput });
        },
    });

    const [input, setInput] = useState("");
    const isBusy = status === "submitted" || status === "streaming";

    const startNewChat = () => {
        stop();
        for (const resolve of pendingResolversRef.current.values())
            resolve(false);
        pendingResolversRef.current.clear();
        setPendingToolCallIds(new Set());
        setToolDecisions({});
        clearError();
        clearHistory();
        setInput("");
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

    const sendPrompt = (text: string) => {
        if (!text.trim() || isBusy) return;
        clearError();
        sendMessage({ text });
        setInput("");
        shouldAutoScrollRef.current = true;
    };

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
                <Excalidraw excalidrawAPI={bindApi} theme={theme} />
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
                onKeyDown={handleKeyDown}
            />

            <aside className="chat-panel" aria-label="Diagram assistant">
                <header className="chat-header">
                    <div className="brand">
                        <div className="brand__mark" aria-hidden="true">
                            <Icon name="diagram" size={16} />
                        </div>
                        <div className="brand__copy">
                            <h1>Excali</h1>
                            <p className={isBusy ? "is-busy" : ""}>
                                <span className="status-dot" />
                                {isBusy ? "Working…" : "Diagram assistant"}
                            </p>
                        </div>
                    </div>
                    <div className="chat-header__actions">
                        <button
                            type="button"
                            className="icon-button hide-when-collapsed"
                            aria-label="New chat"
                            title="New chat"
                            onClick={startNewChat}
                            disabled={messages.length === 0}
                        >
                            <Icon name="plus" size={16} />
                        </button>
                        <button
                            type="button"
                            className="icon-button hide-when-collapsed"
                            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                            title={theme === "dark" ? "Light mode" : "Dark mode"}
                            onClick={toggleTheme}
                        >
                            <Icon name={theme === "dark" ? "sun" : "moon"} size={16} />
                        </button>
                        <button
                            type="button"
                            className="icon-button collapse-toggle"
                            aria-label={isAssistantCollapsed ? "Expand assistant panel" : "Collapse assistant panel"}
                            title={isAssistantCollapsed ? "Expand" : "Collapse"}
                            onClick={() => setIsAssistantCollapsed((collapsed) => !collapsed)}
                        >
                            <Icon name="sidebar" size={16} />
                        </button>
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
                        errorMessage={error?.message}
                        pendingToolCallIds={pendingToolCallIds}
                        toolDecisions={toolDecisions}
                        onToolDecision={handleToolDecision}
                        onToolApprovalResponse={addToolApprovalResponse}
                        onPromptSelect={(prompt) => {
                            setMobileView("assistant");
                            sendPrompt(prompt);
                        }}
                        onRetry={() => {
                            clearError();
                            regenerate();
                        }}
                    />
                </div>

                <ChatInput
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onSubmit={(e) => {
                        e.preventDefault();
                        sendPrompt(input);
                    }}
                    onStop={stop}
                    busy={isBusy}
                />
            </aside>
        </main>
    );
}
