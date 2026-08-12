import "@excalidraw/excalidraw/index.css";
import { Excalidraw } from "@excalidraw/excalidraw";
import { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import { useAgentChat } from "@cloudflare/ai-chat/react";
import { useAgent } from "agents/react";
import { useEffect, useState } from "react";
import { ChatInput } from "./components/ChatInput";
import MessageList from "./components/MessageList";
export default function App() {
    const agent = useAgent({
        agent: "ExcaliAgent",
        name: "default",
    });

    const { messages, sendMessage, status, isStreaming, clearHistory } =
        useAgentChat({
            agent,

            onToolCall: async ({ toolCall, addToolOutput }) => {
                if (toolCall.toolName === "getUserMood") {
                    addToolOutput({
                        toolCallId: toolCall.toolCallId,
                        output: "sad",
                    });
                }
                else if (toolCall.toolName === "getUserInfo") {
                    addToolOutput({
                        toolCallId: toolCall.toolCallId,
                        output: "Hi I'm Arham a recent BSCS graduate from UET lahore with cgpa 3.47. I like programming"
                    })
                }
                else {
                    addToolOutput({
                        toolCallId: toolCall.toolCallId,
                        output: "unknown",
                    });
                }
            },
        });
    const [input, setInput] = useState("");
    const [, setExcalidrawAPI] = useState<ExcalidrawImperativeAPI | null>(null);
    const [theme, setTheme] = useState<"light" | "dark">("light");

    const handleExcaliApi = (api: ExcalidrawImperativeAPI) => {
        setExcalidrawAPI(api);
    };

    useEffect(() => {
        clearHistory();
    }, []);

    return (
        <div className="flex h-screen">
            <div className="w-4/5 h-screen">
                <Excalidraw excalidrawAPI={handleExcaliApi} theme={theme} />
            </div>
            <div className="w-2/5 flex flex-col border-l">
                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                    <MessageList messages={messages} />
                </div>
                <ChatInput
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onSubmit={(e) => {
                        e.preventDefault();
                        if (!input.trim()) return;
                        sendMessage({ text: input });
                        setInput("");
                    }}
                    disabled={isStreaming}
                />
            </div>
        </div>
    );
}
