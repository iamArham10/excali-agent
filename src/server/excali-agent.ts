import { AIChatAgent } from "@cloudflare/ai-chat";
import {
    convertToModelMessages,
    createGateway,
    createUIMessageStreamResponse,
    isStepCount,
    streamText,
    toUIMessageStream,
} from "ai";
import { tools } from "./tools";
import { groq } from "@ai-sdk/groq";

export class ExcaliAgent extends AIChatAgent<Env> {
    maxPersistedMessages: number | undefined = 5;
    async onChatMessage(): Promise<Response | undefined> {
        const result = streamText({
            model: groq("llama-3.3-70b-versatile"),
            instructions:
                `You are ExcaliAgent, an AI assistant that chats with the user ` +
                `and draws diagrams on an Excalidraw canvas.`,
            messages: await convertToModelMessages(this.messages),
            tools: tools,
            stopWhen: isStepCount(50),
        });

        return createUIMessageStreamResponse({
            stream: toUIMessageStream(result),
        });
    }

    async onRequest(request: Request): Promise<Response> {
        return new Response("Hello, world!", { status: 200 });
    }
}
