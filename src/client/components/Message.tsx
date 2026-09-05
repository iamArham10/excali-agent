import { useState } from "react";
import { isToolUIPart, getToolName, type UIMessage } from "ai";
import MarkdownRenderer from "./MarkdownRenderer";

type MessageProps = {
    message: UIMessage;
    pendingToolCallIds?: Set<string>;
    toolDecisions?: Record<string, boolean>;
    onToolDecision?: (toolCallId: string, approved: boolean) => void;
    onToolApprovalResponse?: (options: {
        id: string;
        approved: boolean;
    }) => void;
};

type ToolPresentation = {
    title: string;
    description: string;
    icon: string;
    destructive?: boolean;
};

const TOOL_PRESENTATION: Record<string, ToolPresentation> = {
    drawElements: {
        title: "Draw elements",
        description: "Add new shapes and connections to the canvas.",
        icon: "+",
    },
    modifyElements: {
        title: "Update elements",
        description: "Apply the requested changes to the canvas.",
        icon: "↻",
    },
    deleteElements: {
        title: "Delete elements",
        description: "Remove selected elements and their connections.",
        icon: "−",
        destructive: true,
    },
    clearCanvas: {
        title: "Clear the canvas",
        description: "Remove every element from the current canvas.",
        icon: "!",
        destructive: true,
    },
    getCanvasState: {
        title: "Read the canvas",
        description: "Inspect the current elements to understand the diagram.",
        icon: "◇",
    },
    webSearchTool: {
        title: "Search the web",
        description: "Send this query to the web search provider.",
        icon: "↗",
    },
    knowledgeSearchTool: {
        title: "Search the knowledge base",
        description: "Look for relevant information in the connected documents.",
        icon: "⌕",
    },
};

export default function Message({
    message,
    pendingToolCallIds,
    toolDecisions,
    onToolDecision,
    onToolApprovalResponse,
}: MessageProps) {
    const isUser = message.role === "user";
    const [submittingIds, setSubmittingIds] = useState<Set<string>>(new Set());

    const submitServerDecision = (
        toolCallId: string,
        approvalId: string,
        approved: boolean,
    ) => {
        if (submittingIds.has(toolCallId)) return;
        setSubmittingIds((current) => new Set(current).add(toolCallId));

        try {
            onToolApprovalResponse?.({ id: approvalId, approved });
        } catch {
            setSubmittingIds((current) => {
                const next = new Set(current);
                next.delete(toolCallId);
                return next;
            });
        }
    };

    return (
        <article className={`message ${isUser ? "message-user" : "message-assistant"}`}>
            <div className="message-role">{isUser ? "You" : "Excali"}</div>
            <div className="message-body">
                {message.parts.map((part, index) => {
                    if (part.type === "text") {
                        if (!part.text.trim()) return null;
                        return (
                            <div className="message-text" key={index}>
                                <MarkdownRenderer content={part.text} />
                            </div>
                        );
                    }

                    // Reasoning arrives as many stream parts. MessageList renders one
                    // status indicator for the active response instead of one per part.
                    if (part.type === "reasoning") return null;
                    if (!isToolUIPart(part)) return null;

                    const toolName = getToolName(part);
                    const presentation = getToolPresentation(toolName);
                    const isClientPending = pendingToolCallIds?.has(part.toolCallId);
                    const isServerPending =
                        "approval" in part &&
                        part.state === "approval-requested";
                    const isPending = isClientPending || isServerPending;
                    const isSubmitting = submittingIds.has(part.toolCallId);
                    const decision = toolDecisions?.[part.toolCallId];
                    const input =
                        "input" in part
                            ? (part.input as Record<string, unknown> | undefined)
                            : undefined;

                    if (isPending) {
                        const detail = getToolDetail(toolName, input);

                        return (
                            <section
                                key={part.toolCallId || index}
                                className={`approval-card ${presentation.destructive ? "approval-card-danger" : ""}`}
                                aria-label={`${presentation.title} approval`}
                            >
                                <div className="approval-heading">
                                    <span className="tool-icon" aria-hidden="true">
                                        {presentation.icon}
                                    </span>
                                    <div>
                                        <span className="approval-eyebrow">
                                            Permission requested
                                        </span>
                                        <h3>{presentation.title}</h3>
                                    </div>
                                </div>
                                <p>{presentation.description}</p>
                                {detail && <div className="tool-detail">{detail}</div>}
                                <div className="approval-actions">
                                    <button
                                        type="button"
                                        className="button-secondary"
                                        disabled={isSubmitting}
                                        onClick={() => {
                                            if (isClientPending) {
                                                onToolDecision?.(part.toolCallId, false);
                                            }
                                            if (
                                                isServerPending &&
                                                "approval" in part &&
                                                part.approval?.id
                                            ) {
                                                submitServerDecision(
                                                    part.toolCallId,
                                                    part.approval.id,
                                                    false,
                                                );
                                            }
                                        }}
                                    >
                                        Deny
                                    </button>
                                    <button
                                        type="button"
                                        className={
                                            presentation.destructive
                                                ? "button-danger"
                                                : "button-primary"
                                        }
                                        disabled={isSubmitting}
                                        onClick={() => {
                                            if (isClientPending) {
                                                onToolDecision?.(part.toolCallId, true);
                                            }
                                            if (
                                                isServerPending &&
                                                "approval" in part &&
                                                part.approval?.id
                                            ) {
                                                submitServerDecision(
                                                    part.toolCallId,
                                                    part.approval.id,
                                                    true,
                                                );
                                            }
                                        }}
                                    >
                                        {isSubmitting ? "Submitting…" : "Allow once"}
                                    </button>
                                </div>
                            </section>
                        );
                    }

                    if (decision === true || part.state === "output-available") {
                        return (
                            <ToolReceipt
                                key={part.toolCallId || index}
                                icon="✓"
                                text={getCompletedToolText(toolName, presentation.title, input)}
                            />
                        );
                    }

                    if (
                        decision === false ||
                        part.state === "output-error" ||
                        part.state === "output-denied"
                    ) {
                        return (
                            <ToolReceipt
                                key={part.toolCallId || index}
                                icon="×"
                                text={
                                    part.state === "output-error"
                                        ? `${presentation.title} failed`
                                        : `${presentation.title} denied`
                                }
                                error
                            />
                        );
                    }

                    return null;
                })}
            </div>
        </article>
    );
}

function ToolReceipt({
    icon,
    text,
    error = false,
}: {
    icon: string;
    text: string;
    error?: boolean;
}) {
    return (
        <div className={`tool-receipt ${error ? "tool-receipt-error" : ""}`}>
            <span aria-hidden="true">{icon}</span>
            <span>{text}</span>
        </div>
    );
}

function getToolPresentation(toolName: string): ToolPresentation {
    return (
        TOOL_PRESENTATION[toolName] ?? {
            title: humanizeToolName(toolName),
            description: "Allow the assistant to perform this action.",
            icon: "◇",
        }
    );
}

function humanizeToolName(value: string) {
    const words = value.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/Tool$/, "");
    return words.charAt(0).toUpperCase() + words.slice(1);
}

function getToolDetail(
    toolName: string,
    input: Record<string, unknown> | undefined,
) {
    if (!input) return null;

    if (typeof input.query === "string") {
        return `“${input.query}”`;
    }

    if (Array.isArray(input.elements)) {
        const count = input.elements.length;
        return `${count} element${count === 1 ? "" : "s"}`;
    }

    if (toolName === "clearCanvas") {
        return "This action cannot be undone from the chat.";
    }

    return null;
}

function getCompletedToolText(
    toolName: string,
    fallbackTitle: string,
    input: Record<string, unknown> | undefined,
) {
    const count = Array.isArray(input?.elements) ? input.elements.length : null;

    if (count !== null) {
        const noun = count === 1 ? "element" : "elements";
        if (toolName === "drawElements") return `Added ${count} ${noun}`;
        if (toolName === "modifyElements") return `Updated ${count} ${noun}`;
        if (toolName === "deleteElements") return `Removed ${count} ${noun}`;
    }

    if (toolName === "clearCanvas") return "Cleared canvas";
    if (toolName === "getCanvasState") return "Read canvas state";
    return `${fallbackTitle} completed`;
}
