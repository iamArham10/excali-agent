import z from "zod";

const toolSelectionGoldenDatasetItemType = z.object({
    id: z.string(),
    input: z.string(),
    seed: z
        .object({
            userPrompt: z.string(),
            agentResponse: z.string(),
            elements: z.array(z.any()),
        })
        .optional(),
    expectedCharacteristics: z.array(z.string()),
    expected: z.object({
        toolCalls: z.array(
            z.object({
                toolName: z.string(),
                requiredArguments: z.any(),
            }),
        ),
    }),
    difficulty: z.enum(["easy", "medium", "hard"]),
    category: z.enum(["create", "modify"]),
});

export const toolSelectionGoldenDatasetType = z.array(
    toolSelectionGoldenDatasetItemType,
);
