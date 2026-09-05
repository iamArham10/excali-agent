import { isToolUIPart, getToolName, type UIMessage } from "ai";
import MarkdownRenderer from "./MarkdownRenderer";

type MessageProps = {
    message: UIMessage;
    pendingToolCallIds?: Set<string>;
    toolDecisions?: Record<string, boolean>;
    onToolDecision?: (toolCallId: string, approved: boolean) => void;
};

export default function Message({
    message,
    pendingToolCallIds,
    toolDecisions,
    onToolDecision,
}: MessageProps) {
    const isUser = message.role === "user";
    const hasText = message.parts.some(
        (p) => p.type === "text" && p.text.trim().length > 0,
    );
    return (
        <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
            <div
                className={`max-w-[75%] rounded-2xl px-4 py-2 ${isUser ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-900"}`}
            >
                {message.parts.map((part, index) => {
                    if (part.type === "text") {
                        return (
                            <MarkdownRenderer key={index} content={part.text} />
                        );
                    } else if (part.type === "reasoning") {
                        if (hasText) return null;
                        return (
                            <div key={index} className="flex flex-col gap-0.5">
                                <em className="text-blue-400">{part.text}</em>
                                <ThinkingDots />
                            </div>
                        );
                    } else if (isToolUIPart(part)) {
                        const toolName = getToolName(part);
                        const isPending = pendingToolCallIds?.has(part.toolCallId);
                        const decision = toolDecisions?.[part.toolCallId];

                        if (isPending) {
                            return (
                                <div
                                    key={part.toolCallId || index}
                                    className="my-2 p-3 bg-white rounded-xl border border-amber-300 shadow-sm text-gray-800"
                                >
                                    <div className="text-xs font-semibold uppercase tracking-wider text-amber-600 mb-1">
                                        Tool Approval Required
                                    </div>
                                    <div className="text-sm font-medium mb-2">
                                        Allow tool{" "}
                                        <code className="bg-amber-50 text-amber-900 px-1.5 py-0.5 rounded font-mono font-bold text-xs border border-amber-200">
                                            {toolName}
                                        </code>
                                        ?
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={() => onToolDecision?.(part.toolCallId, true)}
                                            className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded-md shadow-sm transition active:scale-95 cursor-pointer"
                                        >
                                            Yes
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => onToolDecision?.(part.toolCallId, false)}
                                            className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-md shadow-sm transition active:scale-95 cursor-pointer"
                                        >
                                            No
                                        </button>
                                    </div>
                                </div>
                            );
                        }

                        if (decision === true || part.state === "output-available") {
                            return (
                                <div
                                    key={part.toolCallId || index}
                                    className="my-1.5 px-2.5 py-1 text-xs text-green-800 bg-green-50 border border-green-200 rounded-lg flex items-center gap-1.5"
                                >
                                    <span className="font-bold">✓ Allowed:</span>
                                    <code className="font-mono">{toolName}</code>
                                </div>
                            );
                        }

                        if (
                            decision === false ||
                            part.state === "output-error" ||
                            part.state === "output-denied"
                        ) {
                            return (
                                <div
                                    key={part.toolCallId || index}
                                    className="my-1.5 px-2.5 py-1 text-xs text-red-800 bg-red-50 border border-red-200 rounded-lg flex items-center gap-1.5"
                                >
                                    <span className="font-bold">✕ Denied:</span>
                                    <code className="font-mono">{toolName}</code>
                                </div>
                            );
                        }

                        return null;
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
