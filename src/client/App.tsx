import "@excalidraw/excalidraw/index.css";
import {
    CaptureUpdateAction,
    convertToExcalidrawElements,
    Excalidraw,
} from "@excalidraw/excalidraw";
import { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import { useAgentChat } from "@cloudflare/ai-chat/react";
import { useAgent } from "agents/react";
import { useEffect, useRef, useState } from "react";
import { ChatInput } from "./components/ChatInput";
import MessageList from "./components/MessageList";
import { getToolName, isToolUIPart } from "ai";
import { ExcalidrawElementSkeleton } from "@excalidraw/excalidraw/data/transform";

const sessionId = crypto.randomUUID();

export default function App() {
    const agent = useAgent({
        agent: "ExcaliAgent",
        name: sessionId,
    });

    const { messages, sendMessage, status, clearHistory } = useAgentChat({
        agent,
    });

    const [input, setInput] = useState("");
    const [excalidrawAPI, setExcalidrawAPI] =
        useState<ExcalidrawImperativeAPI | null>(null);
    const [theme, setTheme] = useState<"light" | "dark">("light");
    const drawnToolsId = useRef<Set<string>>(new Set());

    const handleExcaliApi = (api: ExcalidrawImperativeAPI) => {
        setExcalidrawAPI(api);
    };

    useEffect(() => {
        clearHistory();
    }, []);

    useEffect(() => {
        if (!excalidrawAPI) {
            return;
        }

        for (const message of messages) {
            if (message.role !== "assistant") {
                continue;
            }

            for (const part of message.parts) {
                if (!isToolUIPart(part)) {
                    continue;
                }

                const toolName = getToolName(part);
                if (part.state !== "output-available") continue;
                if (drawnToolsId.current.has(part.toolCallId)) continue;

                drawnToolsId.current.add(part.toolCallId);

                if (toolName === "generateDiagram") {
                    const output = part.output as {
                        elements: ExcalidrawElementSkeleton[];
                    };
                    const elements = convertToExcalidrawElements(
                        output.elements,
                        { regenerateIds: false },
                    );
                    excalidrawAPI.updateScene({ elements });
                    excalidrawAPI.scrollToContent(elements, {
                        fitToContent: true,
                    });
                } else if (toolName === "modifyDiagram") {
                    const { elementId, updates } = part.output as {
                        elementId: string;
                        updates: Record<string, unknown>;
                    };
                    const elements = excalidrawAPI
                        .getSceneElements()
                        .map((el) =>
                            el.id === elementId
                                ? {
                                      ...el,
                                      ...updates,
                                      version: el.version + 1,
                                      versionNonce: el.versionNonce + 1,
                                  }
                                : el,
                        );
                    excalidrawAPI.updateScene({ elements });
                }
            }
        }
    }, [messages, excalidrawAPI]);

    return (
        <div className="flex h-screen">
            <div className="w-4/5 h-screen">
                <Excalidraw excalidrawAPI={handleExcaliApi} theme={theme} />
            </div>
            <div className="w-2/5 flex flex-col m-5 rounded-2xl bg-white shadow-xl">
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
                    disabled={status !== "ready"}
                />
            </div>
        </div>
    );
}
