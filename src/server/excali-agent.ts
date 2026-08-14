import { AIChatAgent } from "@cloudflare/ai-chat";
import {
    convertToModelMessages,
    createGateway,
    createUIMessageStreamResponse,
    isStepCount,
    streamText,
    toUIMessageStream,
} from "ai";
import tools from "./tools";
import { groq } from "@ai-sdk/groq";

export class ExcaliAgent extends AIChatAgent<Env> {
    maxPersistedMessages: number | undefined = 5;
    async onChatMessage(): Promise<Response | undefined> {
        const result = streamText({
            model: groq("openai/gpt-oss-120b"),
            instructions:
                `You are ExcaliAgent, an AI assistant that chats with the user and draws diagrams on an Excalidraw canvas.

When to use tools:
- Call generateDiagram whenever the user asks to create, draw, or design a diagram. It replaces the entire canvas with the new diagram.
- Call modifyDiagram when the user asks to change part of a diagram that is already on the canvas (rename a label, recolor, move, or resize an element). Do not regenerate the whole diagram for a small change.
- Answer normal chat questions without tools.

Drawing quality rules:
- Connect every pair of related elements with an arrow — never leave related shapes floating.
- Use short labels (2-5 words) inside or beside shapes, never paragraphs of text on the canvas.
- After drawing, reply briefly (1-2 sentences) summarizing what you created.`,
            messages: await convertToModelMessages(this.messages),
            tools: tools,
            stopWhen: isStepCount(2),
        });

        return createUIMessageStreamResponse({
            stream: toUIMessageStream(result),
        });
    }

    async onRequest(request: Request): Promise<Response> {
        return new Response("Hello, world!", { status: 200 });
    }
}
