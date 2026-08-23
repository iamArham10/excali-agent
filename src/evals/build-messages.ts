import type { ModelMessage } from "ai";
import z from "zod";

const seedData = z.object({
    userPrompt: z.string(),
    agentResponse: z.string(),
    elements: z.array(z.unknown()),
});

const goldenTestCase = z.object({
    id: z.string(),
    input: z.string(),
    seed: seedData.optional(),
});

export type GoldenTestCase = z.infer<typeof goldenTestCase>;

export function buildMessages(tc: GoldenTestCase): ModelMessage[] {
    if (!tc.seed)
        return [
            {
                role: "user",
                content: tc.input,
            },
        ];

    const callId = `seed_${tc.id}`;

    return [
        {
            role: "user",
            content: tc.seed.userPrompt,
        },
        {
            role: "assistant",
            content: [
                {
                    type: "tool-call",
                    toolCallId: callId,
                    toolName: "drawElements",
                    input: { elements: tc.seed.elements },
                },
            ],
        },
        {
            role: "tool",
            content: [
                {
                    type: "tool-result",
                    toolCallId: callId,
                    toolName: "drawElements",
                    output: {
                        type: "json",
                        value: { elements: tc.seed.elements as never },
                    },
                },
            ],
        },
        {
            role: "assistant",
            content: tc.seed.agentResponse,
        },
        {
            role: "user",
            content: tc.input,
        },
    ];
}
