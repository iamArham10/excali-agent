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
    - when adding arrow bindings make sure there is enough space between the arrow and the shape to which
      it connects.
    - when you have two arrows between two shapes, make sure there is enough space between them, between
      the arrows as well as between the shapes.
    - Use space between shapes and arrows as much as you can to avoid overlapping.
    - Make sure to connect arrows in such a way it looks pleasing
    - Arrow x/y is the absolute canvas position of its first point. Arrow points are offsets relative to x/y,
      must begin with [0, 0], and must never contain absolute canvas coordinates.
    - An arrow path must travel from start.id to end.id. For a reverse arrow, put x/y at the reverse arrow's
      source and use a negative final point offset when needed.
    - Make sure to have as much space as possible between shapes if arrows are between them,
      otherwise arrows don't show nicely.
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
