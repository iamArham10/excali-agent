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

const SYSTEM_INSTRUCTIONS = `
You're a excali draw agent, your task is to draw using the given tools.
Make sure to care about spacing and alignment. and make sure to adhere to the provided instructions.
- when adding arrow bindings make sure there is enough space between the arrow and the shape to which
  it connects.
- when you have two arrows between two shapes, make sure there is enough space between them, between
  the arrows as well as between the shapes.
- use space between shapes and arrows as much as you can to avoid overlapping.
- make sure to connect arrows in such a way it looks pleasing
- deleting an element also removes its attached labels and any arrows connected to it, so there is no need to delete those separately.
    `;

export class ExcaliAgent extends AIChatAgent {
    async onChatMessage() {
        const response = streamText({
            model: groq("openai/gpt-oss-120b"),
            messages: await convertToModelMessages(this.messages),
            instructions: SYSTEM_INSTRUCTIONS,
            tools: tools,
            stopWhen: isStepCount(10),
        });

        return createUIMessageStreamResponse({
            stream: toUIMessageStream({ stream: response.stream }),
        });
    }
}
