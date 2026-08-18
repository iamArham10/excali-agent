import { AIChatAgent, OnChatMessageOptions } from "@cloudflare/ai-chat";
import { groq } from "@ai-sdk/groq";
import {
    convertToModelMessages,
    createUIMessageStreamResponse,
    isStepCount,
    streamText,
    toUIMessageStream,
} from "ai";
import { tools } from "./tools";

export class ExcaliAgent extends AIChatAgent {
    async onChatMessage() {
        const response = streamText({
            model: groq("openai/gpt-oss-120b"),
            messages: await convertToModelMessages(this.messages),
            instructions: "You're a drawing agent, draw",
            tools: tools,
            stopWhen: isStepCount(10),
        });

        return createUIMessageStreamResponse({
            stream: toUIMessageStream({ stream: response.stream }),
        });
    }
}
