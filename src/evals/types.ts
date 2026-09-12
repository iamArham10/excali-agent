import z from "zod";
import { TOOL_NAMES } from "../shared/tool-names";

export type Element = Record<string, unknown>;

export type EvalOutput = {
    toolCalls: {
        toolName: string;
        input: unknown;
    }[];
    testCaseCategory: "create" | "modify" | "delete" | "multi";
};

export type EvalExpected = {
    toolName: string;
    requiredArguments: Record<string, unknown>;
}[];

export const toolNameType = z.enum([
    TOOL_NAMES.DRAW_ELEMENTS,
    TOOL_NAMES.MODIFY_ELEMENTS,
    TOOL_NAMES.DELETE_ELEMENTS,
    TOOL_NAMES.CLEAR_CANVAS,
    TOOL_NAMES.GET_CANVAS_STATE,
    TOOL_NAMES.DRAW_DIAGRAM_USING_MERMAID,
    TOOL_NAMES.WEB_SEARCH,
    TOOL_NAMES.KNOWLEDGE_SEARCH,
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
