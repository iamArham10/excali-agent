import type { UIMessage } from "ai";
import Message from "./Message";

type MessageListProps = {
    messages: UIMessage[];
    pendingToolCallIds?: Set<string>;
    toolDecisions?: Record<string, boolean>;
    onToolDecision?: (toolCallId: string, approved: boolean) => void;
    onToolApprovalResponse?: (options: { id: string; approved: boolean }) => void;
};

export default function MessageList({
    messages,
    pendingToolCallIds,
    toolDecisions,
    onToolDecision,
    onToolApprovalResponse,
}: MessageListProps) {
    return (
        <div className="flex flex-col gap-3">
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
        </div>
    );
}
