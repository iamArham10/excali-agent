import { AIChatAgent } from "@cloudflare/ai-chat";
import {
    convertToModelMessages,
    createUIMessageStreamResponse,
    toUIMessageStream,
} from "ai";

import { streamAgent } from "./agent-core";

export class ExcaliAgent extends AIChatAgent {
    async onChatMessage() {
        const response = await streamAgent({
            messages: await convertToModelMessages(this.messages),
        });

        return createUIMessageStreamResponse({
            stream: toUIMessageStream({
                stream: response.stream,
                sendReasoning: true,
            }),
        });
    }
}
