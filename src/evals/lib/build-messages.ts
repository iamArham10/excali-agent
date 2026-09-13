import type { ModelMessage } from "ai";
import type { EvalCase } from "../types";

export function buildMessages(testCase: EvalCase): ModelMessage[] {
    if (!testCase.seed) {
        return [{ role: "user", content: testCase.input }];
    }

    const toolCallId = `seed-${testCase.id}`;

    return [
        { role: "user", content: testCase.seed.priorPrompt },
        {
            role: "assistant",
            content: [
                {
                    type: "tool-call",
                    toolCallId,
                    toolName: "drawElements",
                    input: { elements: testCase.seed.elements },
                },
            ],
        },
        {
            role: "tool",
            content: [
                {
                    type: "tool-result",
                    toolCallId,
                    toolName: "drawElements",
                    output: {
                        type: "json",
                        value: { created: testCase.seed.elements.length },
                    },
                },
            ],
        },
        { role: "assistant", content: testCase.seed.priorResponse },
        { role: "user", content: testCase.input },
    ];
}
