import type { UIMessage } from "ai";
import Message from "./Message";

type MessageListProps = {
    messages: UIMessage[];
};

export default function MessageList({ messages }: MessageListProps) {
    return (
        <div className="flex flex-col gap-3">
            {messages.map((message, index) => (
                <Message key={index} message={message} />
            ))}
        </div>
    );
}
