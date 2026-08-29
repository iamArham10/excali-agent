import { AIChatAgent } from "@cloudflare/ai-chat";
import {
    convertToModelMessages,
    createUIMessageStreamResponse,
    toUIMessageStream,
} from "ai";

import { streamAgent } from "./agent-core";

export class ExcaliAgent extends AIChatAgent {
    async onChatMessage(
        _onFinish: Parameters<AIChatAgent["onChatMessage"]>[0],
        options?: { body?: Record<string, unknown> },
    ) {
        const canvasState =
            typeof options?.body?.canvasState === "string"
                ? options.body.canvasState
                : "";

        const response = await streamAgent({
            messages: await convertToModelMessages(this.messages),
            canvasState,
        });

        return createUIMessageStreamResponse({
            stream: toUIMessageStream({
                stream: response.stream,
                sendReasoning: true,
            }),
        });
    }
}
