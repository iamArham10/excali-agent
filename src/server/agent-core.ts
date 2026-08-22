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
    - use space between shapes and arrows as much as you can to avoid overlapping.
    - make sure to connect arrows in such a way it looks pleasing
    - deleting an element also removes its attached labels and any arrows connected to it, so there is no need to delete those separately.
    - please keep the diagrams as simple as possible, avoid unnecessary complexity.
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
    model = openai("gpt-4o-mini"),
    messages,
    systemInstructions = SYSTEM_INSTRUCTIONS,
    maxSteps = DEFAULT_MAX_STEPS,
    providerOptions,
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
    model = openai("gpt-4o-mini"),
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
        text: result.text,
        steps: result.steps,
        toolResults: result.toolResults,
        toolCalls: result.toolCalls,
    };
}
