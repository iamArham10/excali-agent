import { openai } from "@ai-sdk/openai";
import {
    streamText,
    stepCountIs,
    type LanguageModel,
    type ModelMessage,
} from "ai";
import { type ProviderOptions } from "@ai-sdk/provider-utils";
import { tools } from "./tools";

import { SYSTEM_INSTRUCTIONS } from "./prompts/system-prompt";

const DEFAULT_MAX_STEPS = 20;

const DEFAULT_PROVIDER_OPTIONS: ProviderOptions = {
    openai: {
        reasoningSummary: "detailed",
    },
};

const DEFAULT_MODEL = "gpt-5.6-luna";

type AgentArgs = {
    model?: LanguageModel;
    messages: ModelMessage[];
    systemInstructions?: string;
    maxSteps?: number;
    providerOptions?: ProviderOptions;
};

export async function streamAgent({
    model = openai(DEFAULT_MODEL),
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
    model = openai(DEFAULT_MODEL),
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
