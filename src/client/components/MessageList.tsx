import type { UIMessage } from "ai";
import Message from "./Message";

type MessageListProps = {
    messages: UIMessage[];
    status: "submitted" | "streaming" | "ready" | "error";
    pendingToolCallIds?: Set<string>;
    toolDecisions?: Record<string, boolean>;
    onToolDecision?: (toolCallId: string, approved: boolean) => void;
    onToolApprovalResponse?: (options: { id: string; approved: boolean }) => void;
    onPromptSelect?: (prompt: string) => void;
};

const STARTERS = [
    {
        code: "ARC",
        title: "System architecture",
        description: "Services, queues, stores, and boundaries",
        prompt: "Create a system architecture diagram with services, data stores, external dependencies, and clearly labeled connections.",
    },
    {
        code: "SEQ",
        title: "Sequence diagram",
        description: "Requests across system boundaries",
        prompt: "Create a sequence diagram showing the actors, requests, responses, and failure paths.",
    },
    {
        code: "FLOW",
        title: "Request flow",
        description: "Inputs, decisions, and outcomes",
        prompt: "Create a technical request flow with inputs, processing steps, decision points, and outcomes.",
    },
];

export default function MessageList({
    messages,
    status,
    pendingToolCallIds,
    toolDecisions,
    onToolDecision,
    onToolApprovalResponse,
    onPromptSelect,
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
                    <span className="empty-eyebrow">New diagram</span>
                    <h2>Build a system diagram</h2>
                    <p>Describe the components, boundaries, and relationships.</p>
                    <div className="prompt-examples" aria-label="Diagram templates">
                        {STARTERS.map((starter) => (
                            <button
                                type="button"
                                key={starter.code}
                                onClick={() => onPromptSelect?.(starter.prompt)}
                            >
                                <span className="prompt-code">{starter.code}</span>
                                <span className="prompt-copy">
                                    <strong>{starter.title}</strong>
                                    <small>{starter.description}</small>
                                </span>
                                <span className="prompt-arrow" aria-hidden="true">
                                    →
                                </span>
                            </button>
                        ))}
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
            {isWorking && !isWaitingForApproval && <ActivityIndicator status={status} />}
            {status === "error" && (
                <div className="chat-error" role="alert">
                    <strong>Request failed</strong>
                    <span>Check the connection and send the instruction again.</span>
                </div>
            )}
        </div>
    );
}

function ActivityIndicator({
    status,
}: {
    status: "submitted" | "streaming" | "ready" | "error";
}) {
    return (
        <div className="activity-indicator" role="status">
            <span className="activity-pulse" aria-hidden="true" />
            <span>{status === "submitted" ? "Planning diagram" : "Updating canvas"}</span>
            <span className="thinking-dots" aria-hidden="true">
                <i />
                <i />
                <i />
            </span>
        </div>
    );
}
