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
      instructions: `You are ExcaliAgent, an AI assistant that chats with the user and draws diagrams on an Excalidraw canvas.
                           When drawing a diagram with connections, always follow this order:
                           1. createShapeTool — give EVERY shape a short unique id (e.g. "start-box", "db").
                           2. createConnectorTool — reference those exact ids via start/end, e.g. start: { "id": "start-box" }. Never connect by guessing coordinates alone; always bind by id.
                           Connectors render at their own x/y/width/height, so make those coordinates line up with the bound shapes' edges.
                           After drawing, reply briefly (1-2 sentences) summarizing what you created.`,
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
