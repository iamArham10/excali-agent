import { openai } from "@ai-sdk/openai";
import {
    streamText,
    generateText,
    stepCountIs,
    type LanguageModel,
    type ModelMessage,
} from "ai";
import { type ProviderOptions } from "@ai-sdk/provider-utils";
import { tools } from "./tools";

const SYSTEM_INSTRUCTIONS = `
    You're a excali draw agent, your task is to draw using the given tools.
    Make sure to care about spacing and alignment. and make sure to adhere to the provided instructions.
    - To connect two shapes, create an arrow with only start.id and end.id. Never calculate or provide arrow
      x/y coordinates or points; the Excalidraw service calculates the path, spacing, and bindings.
    - Keep enough space between shapes for arrows and labels. The service automatically separates multiple
      arrows between the same pair of shapes.
    - Deleting an element also removes its attached labels and any arrows connected to it, so there is no need to delete those separately.
    - Please keep the diagrams as simple as possible, avoid unnecessary complexity.
    - Never create shape without adding label with it.
    - please use unique ids for shapes and labels and please reference them when connecting arrows.
        `;

const DEFAULT_MAX_STEPS = 5;

const DEFAULT_PROVIDER_OPTIONS: ProviderOptions = {
    openai: {
        reasoningSummary: "detailed",
    },
};

type AgentArgs = {
    model?: LanguageModel;
    messages: ModelMessage[];
    systemInstructions?: string;
    maxSteps?: number;
    providerOptions?: ProviderOptions;
};

export async function streamAgent({
    model = openai("gpt-5-mini"),
    messages,
    systemInstructions = SYSTEM_INSTRUCTIONS,
    maxSteps = DEFAULT_MAX_STEPS,
    providerOptions = DEFAULT_PROVIDER_OPTIONS,
}: AgentArgs) {
    return streamText({
        model: model,
        system: systemInstructions,
        messages,
        tools: tools,
        stopWhen: stepCountIs(maxSteps),
        providerOptions: providerOptions,
    });
}

// agent for testing
export async function runAgentForEval({
    model = openai("gpt-5-mini"),
    messages,
    systemInstructions = SYSTEM_INSTRUCTIONS,
    maxSteps = DEFAULT_MAX_STEPS,
    providerOptions = DEFAULT_PROVIDER_OPTIONS,
}: AgentArgs) {
    const result = await streamAgent({
        model,
        messages,
        systemInstructions,
        maxSteps,
        providerOptions,
    });

    return {
        text: await result.text,
        steps: await result.steps,
        toolResults: await result.toolResults,
        toolCalls: await result.toolCalls,
    };
}
