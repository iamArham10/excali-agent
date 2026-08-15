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
  const [excalidrawAPI, setExcalidrawAPI] = useState<ExcalidrawImperativeAPI | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const drawnToolsId = useRef<Set<string>>(new Set());

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

      const pendingSkeletons: ExcalidrawElementSkeleton[] = [];
      const pendingToolCallIds: string[] = [];

      for (const part of message.parts) {
        if (!isToolUIPart(part)) continue;
        const toolName = getToolName(part);
        if (part.state !== "output-available") continue;
        if (drawnToolsId.current.has(part.toolCallId)) continue;

        if (toolName === "createShapeTool" || toolName === "createConnectorTool") {
          const output = part.output as {
            elements: ExcalidrawElementSkeleton[];
          };
          pendingSkeletons.push(...output.elements);
          pendingToolCallIds.push(part.toolCallId);
        }
      }

      // Convert all shapes + connectors together so bindings resolve by ID
      if (pendingSkeletons.length > 0) {
        pendingToolCallIds.forEach((id) => drawnToolsId.current.add(id));

        const existingElements = excalidrawAPI.getSceneElements();
        const pendingIds = new Set(pendingSkeletons.map((s) => s.id));

        // Collect referenced element IDs for binding resolution
        const referencedIds = new Set<string>();
        for (const s of pendingSkeletons) {
          if (s.type !== "arrow" && s.type !== "line") continue;
          const { start, end } = s as {
            start?: { id?: string };
            end?: { id?: string };
          };
          for (const b of [start, end]) {
            const id = (b as { id?: string } | undefined)?.id;
            if (id && !pendingIds.has(id)) referencedIds.add(id);
          }
        }

        const referenced = existingElements.filter((el) => referencedIds.has(el.id));
        const missing = [...referencedIds].filter(
          (id) => !existingElements.some((el) => el.id === id),
        );

        if (missing.length > 0) {
          console.warn(
            "[ExcaliAgent] connector references unknown element ids (no such shape on canvas):",
            missing,
          );
        }

        const converted = convertToExcalidrawElements(
          [...referenced, ...pendingSkeletons] as ExcalidrawElementSkeleton[],
          { regenerateIds: false },
        );

        const convertedById = new Map(converted.map((el) => [el.id, el]));
        const existingIds = new Set(existingElements.map((el) => el.id));
        const newElements = converted.filter((el) => !existingIds.has(el.id));

        excalidrawAPI.updateScene({
          elements: [
            ...existingElements.map((el) => convertedById.get(el.id) ?? el),
            ...newElements,
          ],
        });
        excalidrawAPI.scrollToContent(newElements, {
          fitToContent: true,
        });
      }

      for (const part of message.parts) {
        if (!isToolUIPart(part)) continue;
        const toolName = getToolName(part);
        if (part.state !== "output-available") continue;
        if (drawnToolsId.current.has(part.toolCallId)) continue;

        if (toolName === "updateElementTool") {
          drawnToolsId.current.add(part.toolCallId);
          const { id, changes } = part.output as {
            id: string;
            changes: Record<string, unknown>;
          };
          const elements = excalidrawAPI.getSceneElements().map((el) =>
            el.id === id
              ? {
                  ...el,
                  ...changes,
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
        <Excalidraw excalidrawAPI={(api) => setExcalidrawAPI(api)} theme={theme} />
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
