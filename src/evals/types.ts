import z from "zod";

export const toolNameType = z.enum([
    "drawElements",
    "modifyElements",
    "deleteElements",
]);

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
                toolName: toolNameType,
                requiredArguments: z.record(z.string(), z.unknown()),
            }),
        ),
    }),
    difficulty: z.enum(["easy", "medium", "hard"]),
    category: z.enum(["create", "modify", "delete", "multi"]),
});

export const toolSelectionGoldenDatasetType = z.array(
    toolSelectionGoldenDatasetItemType,
);
