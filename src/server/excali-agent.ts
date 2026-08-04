import { AIChatAgent } from "@cloudflare/ai-chat";
import {
    convertToModelMessages,
    createGateway,
    createUIMessageStreamResponse,
    streamText,
    toUIMessageStream,
} from "ai";

export class ExcaliAgent extends AIChatAgent<Env> {
    async onChatMessage(): Promise<Response | undefined> {
        const provider = createGateway({ apiKey: this.env.AI_GATEWAY_API_KEY });

        const result = streamText({
            model: provider("openai/gpt-4o-mini"),
            instructions: "",
            messages: await convertToModelMessages(this.messages),
        });

        return createUIMessageStreamResponse({
            stream: toUIMessageStream(result),
        });
    }

    async onRequest(request: Request): Promise<Response> {
        return new Response("Hello, world!", { status: 200 });
    }
}
