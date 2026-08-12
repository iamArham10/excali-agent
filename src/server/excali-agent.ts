import { AIChatAgent } from "@cloudflare/ai-chat";
import {
    convertToModelMessages,
    createGateway,
    createUIMessageStreamResponse,
    streamText,
    toUIMessageStream,
} from "ai";
import { tools } from "./tools";
import { groq } from "@ai-sdk/groq";

export class ExcaliAgent extends AIChatAgent<Env> {
    maxPersistedMessages: number | undefined = 5;
    async onChatMessage(): Promise<Response | undefined> {
        const result = streamText({
            model: groq("openai/gpt-oss-120b"),
            instructions:
                "You are a conversationalist agent, only use the tools when necessary",
            messages: await convertToModelMessages(this.messages),
            tools: tools,
        });

        return createUIMessageStreamResponse({
            stream: toUIMessageStream(result),
        });
    }

    async onRequest(request: Request): Promise<Response> {
        return new Response("Hello, world!", { status: 200 });
    }
}
