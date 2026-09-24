import { useState, type ReactNode } from "react";
import { isToolUIPart, getToolName, type UIMessage } from "ai";
import MarkdownRenderer from "./MarkdownRenderer";
import ReasoningBlock from "./ReasoningBlock";
import ToolApprovalCard from "./ToolApprovalCard";
import ToolCallCard, { deriveToolStatus } from "./ToolCallCard";
import { getToolDetail, getToolPresentation } from "./ToolPresentation";

type MessageProps = {
    message: UIMessage;
    isStreaming?: boolean;
    pendingToolCallIds?: Set<string>;
    toolDecisions?: Record<string, boolean>;
    onToolDecision?: (toolCallId: string, approved: boolean) => void;
    onToolApprovalResponse?: (options: {
        id: string;
        approved: boolean;
    }) => void;
};

type Part = UIMessage["parts"][number];
type Block =
    | { kind: "text"; text: string; key: string }
    | { kind: "reasoning"; text: string; streaming: boolean; key: string }
    | { kind: "tools"; parts: Part[]; key: string };

/** Merge the flat part stream into readable blocks: text, one thinking block, grouped tool steps. */
function toBlocks(parts: Part[]): Block[] {
    const blocks: Block[] = [];
    parts.forEach((part, index) => {
        const last = blocks[blocks.length - 1];
        if (part.type === "text") {
            if (part.text.trim())
                blocks.push({
                    kind: "text",
                    text: part.text,
                    key: `t${index}`,
                });
        } else if (part.type === "reasoning") {
            const streaming = "state" in part && part.state === "streaming";
            if (last?.kind === "reasoning") {
                last.text += `\n\n${part.text}`;
                last.streaming = last.streaming || streaming;
            } else {
                blocks.push({
                    kind: "reasoning",
                    text: part.text,
                    streaming,
                    key: `r${index}`,
                });
            }
        } else if (isToolUIPart(part)) {
            if (last?.kind === "tools") last.parts.push(part);
            else
                blocks.push({ kind: "tools", parts: [part], key: `k${index}` });
        }
    });
    return blocks;
}

export default function Message({
    message,
    isStreaming = false,
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

    if (isUser) {
        const text = message.parts
            .map((part) => (part.type === "text" ? part.text : ""))
            .join("")
            .trim();
        return (
            <article className="message message--user">
                <div className="message__bubble">{text}</div>
            </article>
        );
    }

    const renderTool = (part: Part, index: number): ReactNode => {
        if (!isToolUIPart(part)) return null;
        const toolName = getToolName(part);
        const presentation = getToolPresentation(toolName);
        const isClientPending = pendingToolCallIds?.has(part.toolCallId);
        const isServerPending =
            "approval" in part && part.state === "approval-requested";
        const input = "input" in part ? part.input : undefined;
        const key = part.toolCallId || index;

        if (isClientPending || isServerPending) {
            const decide = (approved: boolean) => {
                if (isClientPending)
                    onToolDecision?.(part.toolCallId, approved);
                if (
                    isServerPending &&
                    "approval" in part &&
                    part.approval?.id
                ) {
                    submitServerDecision(
                        part.toolCallId,
                        part.approval.id,
                        approved,
                    );
                }
            };
            return (
                <ToolApprovalCard
                    key={key}
                    presentation={presentation}
                    detail={getToolDetail(
                        input as Record<string, unknown> | undefined,
                    )}
                    isSubmitting={submittingIds.has(part.toolCallId)}
                    onDeny={() => decide(false)}
                    onApprove={() => decide(true)}
                />
            );
        }

        const status = deriveToolStatus(
            part.state,
            "output" in part ? part.output : undefined,
            toolDecisions?.[part.toolCallId],
        );
        return (
            <ToolCallCard
                key={key}
                toolName={toolName}
                status={status}
                input={input}
                output={"output" in part ? part.output : undefined}
                errorText={"errorText" in part ? part.errorText : undefined}
            />
        );
    };

    const blocks = toBlocks(message.parts);
    if (blocks.length === 0) return null;

    return (
        <article className="message message--assistant">
            <div className="message__avatar" aria-hidden="true">
                <span />
            </div>
            <div className="message__body">
                {blocks.map((block) => {
                    if (block.kind === "text") {
                        return (
                            <div className="message__text" key={block.key}>
                                <MarkdownRenderer content={block.text} />
                            </div>
                        );
                    }
                    if (block.kind === "reasoning") {
                        return (
                            <ReasoningBlock
                                key={block.key}
                                text={block.text}
                                streaming={block.streaming && isStreaming}
                            />
                        );
                    }
                    return (
                        <div className="tool-steps" key={block.key}>
                            {block.parts.map(renderTool)}
                        </div>
                    );
                })}
            </div>
        </article>
    );
}
