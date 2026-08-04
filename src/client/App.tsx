import "@excalidraw/excalidraw/index.css";
import { Excalidraw } from "@excalidraw/excalidraw";
import { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import { useAgentChat } from "@cloudflare/ai-chat/react";
import { useAgent } from "agents/react";
import { useState } from "react";
export default function App() {
    const agent = useAgent({
        agent: "ExcaliAgent",
        name: "default",
    });

    const { messages, sendMessage, status } = useAgentChat({ agent });
    const [input, setInput] = useState("");
    const [, setExcalidrawAPI] = useState<ExcalidrawImperativeAPI | null>(null);
    const [theme, setTheme] = useState<"light" | "dark">("light");

    const handleExcaliApi = (api: ExcalidrawImperativeAPI) => {
        setExcalidrawAPI(api);
    };

    return (
        <div className="flex h-screen">
            <div className="w-4/5 h-screen">
                <Excalidraw excalidrawAPI={handleExcaliApi} theme={theme} />
            </div>
            <div className="w-1/5 flex flex-col border-l">
                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                    {messages.map((msg) => (
                        <div key={msg.id}>
                            <strong>{msg.role}:</strong>
                            {msg.parts.map((part, i) =>
                                part.type === "text" ? (
                                    <span key={i}>{part.text}</span>
                                ) : null,
                            )}
                        </div>
                    ))}
                </div>
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        if (!input.trim()) return;
                        sendMessage({ text: input });
                        setInput("");
                    }}
                    className="flex gap-2 p-3 border-t"
                >
                    <input
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Type a message..."
                        className="flex-1 border rounded px-2 py-1"
                    />
                    <button
                        type="submit"
                        className="px-3 py-1 bg-black text-white rounded"
                    >
                        Send
                    </button>
                </form>
            </div>
        </div>
    );
}
