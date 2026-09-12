import { useState } from "react";
import { isToolUIPart, getToolName, type UIMessage } from "ai";
import MarkdownRenderer from "./MarkdownRenderer";
import ToolApprovalCard from "./ToolApprovalCard";
import ToolReceipt from "./ToolReceipt";
import {
    getToolPresentation,
    getToolDetail,
    getCompletedToolText,
} from "./ToolPresentation";

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
                            <ToolApprovalCard
                                key={part.toolCallId || index}
                                presentation={presentation}
                                detail={detail}
                                isSubmitting={isSubmitting}
                                onDeny={() => {
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
                                onApprove={() => {
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
                            />
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
