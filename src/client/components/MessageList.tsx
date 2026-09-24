import type { UIMessage } from "ai";
import Message from "./Message";
import { Icon, type IconName } from "./Icons";

type ChatStatus = "submitted" | "streaming" | "ready" | "error";

type MessageListProps = {
    messages: UIMessage[];
    status: ChatStatus;
    errorMessage?: string;
    pendingToolCallIds?: Set<string>;
    toolDecisions?: Record<string, boolean>;
    onToolDecision?: (toolCallId: string, approved: boolean) => void;
    onToolApprovalResponse?: (options: {
        id: string;
        approved: boolean;
    }) => void;
    onPromptSelect?: (prompt: string) => void;
    onRetry?: () => void;
};

const STARTERS: {
    icon: IconName;
    title: string;
    description: string;
    prompt: string;
}[] = [
    {
        icon: "architecture",
        title: "Architecture",
        description: "Services, data stores and boundaries",
        prompt: "Draw the architecture of a URL shortener: web client, API gateway, shortener service, Redis cache, Postgres, and an analytics pipeline fed by a Kafka queue. Group the backend inside a VPC.",
    },
    {
        icon: "sequence",
        title: "Sequence",
        description: "Requests and responses over time",
        prompt: "Draw a sequence diagram of an OAuth 2.0 authorization code login between the user, the web app, the identity provider, and our API.",
    },
    {
        icon: "flowchart",
        title: "Flowchart",
        description: "Steps, decisions and outcomes",
        prompt: "Draw a flowchart for handling an incoming payment: validate the request, run a fraud check, retry the charge up to 3 times on failure, then either confirm or refund.",
    },
];

export default function MessageList({
    messages,
    status,
    errorMessage,
    pendingToolCallIds,
    toolDecisions,
    onToolDecision,
    onToolApprovalResponse,
    onPromptSelect,
    onRetry,
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
    const lastMessage = messages[messages.length - 1];
    // Show a placeholder until the assistant produces its first visible part.
    const showActivity =
        isWorking && !isWaitingForApproval && lastMessage?.role === "user";

    return (
        <div className="message-list" aria-live="polite">
            {messages.length === 0 && (
                <div className="empty-state">
                    <div className="empty-state__mark" aria-hidden="true">
                        <Icon name="sparkle" size={22} />
                    </div>
                    <h2>What should we diagram?</h2>
                    <p>
                        Describe a system, a process, or an interaction. I'll
                        lay it out on the canvas, and you can keep refining it
                        in plain language.
                    </p>
                    <div className="starters" aria-label="Examples">
                        {STARTERS.map((starter) => (
                            <button
                                type="button"
                                key={starter.title}
                                className="starter"
                                onClick={() => onPromptSelect?.(starter.prompt)}
                            >
                                <span className="starter__icon">
                                    <Icon name={starter.icon} size={18} />
                                </span>
                                <span className="starter__copy">
                                    <strong>{starter.title}</strong>
                                    <small>{starter.description}</small>
                                </span>
                                <span className="starter__arrow">
                                    <Icon name="chevron" size={14} />
                                </span>
                            </button>
                        ))}
                    </div>
                    <p className="empty-state__tip">
                        Tip: drag nodes on the canvas anytime. Edits keep your
                        layout.
                    </p>
                </div>
            )}

            {messages.map((message, index) => (
                <Message
                    key={message.id}
                    message={message}
                    isStreaming={isWorking && index === messages.length - 1}
                    pendingToolCallIds={pendingToolCallIds}
                    toolDecisions={toolDecisions}
                    onToolDecision={onToolDecision}
                    onToolApprovalResponse={onToolApprovalResponse}
                />
            ))}

            {showActivity && (
                <article className="message message--assistant" role="status">
                    <div
                        className="message__avatar message__avatar--busy"
                        aria-hidden="true"
                    >
                        <span />
                    </div>
                    <div className="message__body">
                        <span className="activity shimmer">Thinking</span>
                    </div>
                </article>
            )}

            {status === "error" && (
                <div className="chat-error" role="alert">
                    <span className="chat-error__icon">
                        <Icon name="alert" size={16} />
                    </span>
                    <div className="chat-error__copy">
                        <strong>Something went wrong</strong>
                        <span>
                            {errorMessage ||
                                "The request failed. Check your connection and try again."}
                        </span>
                    </div>
                    {onRetry && (
                        <button
                            type="button"
                            className="btn btn--ghost btn--sm"
                            onClick={onRetry}
                        >
                            <Icon name="retry" size={13} />
                            Retry
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
