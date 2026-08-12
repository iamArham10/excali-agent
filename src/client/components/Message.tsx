import type { UIMessage } from "ai";
import MarkdownRenderer from "./MarkdownRenderer";

type MessageProps = {
    message: UIMessage;
};

export default function Message({ message }: MessageProps) {
    const isUser = message.role === "user";
    const hasText = message.parts.some((p)  => p.type === "text" && p.text.trim().length > 0)
    return (
        <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
            <div
                className={`max-w-[75%] rounded-2xl px-4 py-2 ${isUser ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-900"}`}
            >
                {message.parts.map((part, index) => {
                    if (part.type === "text") {
                        return <MarkdownRenderer key={index} content={part.text}/>
                    } else if (part.type === "reasoning") {
                        if (hasText) return null;
                        return <ThinkingDots/>
                    }
                })}
            </div>
        </div>
    );
}

function ThinkingDots() {
    return (
        <div className="flex items-center gap-1 py-1">
            {[0, 1, 2].map((i) => (
                <span
                    key={i}
                    className="h-1.5 w-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:0.15s]"
                />
            ))}
        </div>
    );
}
