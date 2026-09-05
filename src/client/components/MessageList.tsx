import type { UIMessage } from "ai";
import Message from "./Message";

type MessageListProps = {
    messages: UIMessage[];
    status: "submitted" | "streaming" | "ready" | "error";
    pendingToolCallIds?: Set<string>;
    toolDecisions?: Record<string, boolean>;
    onToolDecision?: (toolCallId: string, approved: boolean) => void;
    onToolApprovalResponse?: (options: { id: string; approved: boolean }) => void;
};

export default function MessageList({
    messages,
    status,
    pendingToolCallIds,
    toolDecisions,
    onToolDecision,
    onToolApprovalResponse,
}: MessageListProps) {
    const isWorking = status === "submitted" || status === "streaming";
    const isWaitingForApproval =
        (pendingToolCallIds?.size ?? 0) > 0 ||
        messages.some((message) =>
            message.parts.some(
                (part) =>
                    "state" in part && part.state === "approval-requested",
            ),
        );

    return (
        <div className="message-list" aria-live="polite">
            {messages.length === 0 && (
                <div className="empty-state">
                    <div className="empty-state-icon" aria-hidden="true">
                        ✦
                    </div>
                    <h2>What should we draw?</h2>
                    <p>
                        Ask for a flowchart, architecture diagram, mind map, or
                        changes to your canvas.
                    </p>
                    <div className="prompt-examples" aria-label="Example prompts">
                        <span>“Create a user login flow”</span>
                        <span>“Draw a three-tier architecture”</span>
                    </div>
                </div>
            )}
            {messages.map((message) => (
                <Message
                    key={message.id}
                    message={message}
                    pendingToolCallIds={pendingToolCallIds}
                    toolDecisions={toolDecisions}
                    onToolDecision={onToolDecision}
                    onToolApprovalResponse={onToolApprovalResponse}
                />
            ))}
            {isWorking && !isWaitingForApproval && <ActivityIndicator />}
            {status === "error" && (
                <div className="chat-error" role="alert">
                    <strong>Something went wrong.</strong>
                    <span>Please try sending your request again.</span>
                </div>
            )}
        </div>
    );
}

function ActivityIndicator() {
    return (
        <div className="activity-indicator" role="status">
            <span className="activity-spark" aria-hidden="true">
                ✦
            </span>
            <span>Thinking</span>
            <span className="thinking-dots" aria-hidden="true">
                <i />
                <i />
                <i />
            </span>
        </div>
    );
}
