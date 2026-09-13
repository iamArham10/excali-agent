import { z } from "zod";
import { TOOL_NAMES } from "../shared/tool-names";

export const toolNameSchema = z.enum([
    TOOL_NAMES.DRAW_ELEMENTS,
    TOOL_NAMES.MODIFY_ELEMENTS,
    TOOL_NAMES.DELETE_ELEMENTS,
    TOOL_NAMES.CLEAR_CANVAS,
    TOOL_NAMES.GET_CANVAS_STATE,
    TOOL_NAMES.DRAW_DIAGRAM_USING_MERMAID,
    TOOL_NAMES.WEB_SEARCH,
    TOOL_NAMES.KNOWLEDGE_SEARCH,
]);

const difficultySchema = z.enum(["easy", "medium", "hard"]);
const shapeTypeSchema = z.enum(["rectangle", "ellipse", "diamond", "text"]);

const seedSchema = z.object({
    priorPrompt: z.string(),
    priorResponse: z.string(),
    elements: z.array(z.record(z.string(), z.unknown())).min(1),
});

const routingExpectationSchema = z.object({
    requiredTools: z.array(toolNameSchema),
    forbiddenTools: z.array(toolNameSchema).default([]),
    orderedTools: z.array(toolNameSchema).optional(),
    allowAdditionalTools: z.boolean().default(false),
});

const diagramExpectationSchema = z.object({
    nodes: z.array(
        z.object({
            label: z.string(),
            type: shapeTypeSchema,
            count: z.number().int().positive().default(1),
        }),
    ),
    connections: z
        .array(
            z.object({
                from: z.string(),
                to: z.string(),
                label: z.string().optional(),
                count: z.number().int().positive().default(1),
            }),
        )
        .default([]),
    requireLabels: z.boolean().default(true),
    gridSize: z.number().int().positive().default(10),
    preventNodeOverlap: z.boolean().default(true),
});

const editingExpectationSchema = z.object({
    readCanvasFirst: z.boolean().default(false),
    mutations: z
        .array(
            z.object({
                id: z.string(),
                type: z.string(),
                changes: z.record(z.string(), z.unknown()),
            }),
        )
        .default([]),
    deletedIds: z.array(z.string()).default([]),
    clearCanvas: z.boolean().default(false),
    untouchedIds: z.array(z.string()).default([]),
});

const mermaidExpectationSchema = z.object({
    direction: z.enum(["TD", "TB", "BT", "RL", "LR"]).optional(),
    labels: z.array(z.string()).default([]),
    edgeCountAtLeast: z.number().int().nonnegative().default(0),
    requiresSubgraph: z.boolean().default(false),
});

const researchExpectationSchema = z.object({
    queryIncludes: z.array(z.string()).default([]),
    resultLimit: z
        .object({ min: z.number().int().min(1), max: z.number().int().max(10) })
        .optional(),
});

const responseExpectationSchema = z.object({
    maxWords: z.number().int().positive().default(40),
    requiredPhrases: z.array(z.string()).default([]),
    forbiddenPhrases: z.array(z.string()).default([]),
});

const expectationSchema = z.object({
    routing: routingExpectationSchema,
    diagram: diagramExpectationSchema.optional(),
    editing: editingExpectationSchema.optional(),
    mermaid: mermaidExpectationSchema.optional(),
    research: researchExpectationSchema.optional(),
    response: responseExpectationSchema.optional(),
});

export const evalCaseSchema = z.object({
    id: z.string().min(1),
    suite: z.enum(["routing", "creation", "editing", "mermaid", "research"]),
    input: z.string().min(1),
    difficulty: difficultySchema,
    tags: z.array(z.string()).default([]),
    seed: seedSchema.optional(),
    expected: expectationSchema,
});

export const evalDatasetSchema = z.array(evalCaseSchema).min(1);

export type ToolName = z.infer<typeof toolNameSchema>;
export type EvalCase = z.infer<typeof evalCaseSchema>;
export type EvalExpected = z.infer<typeof expectationSchema>;
export type EvalToolCall = { toolName: string; input: unknown };
export type EvalOutput = {
    text: string;
    steps: unknown[];
    toolCalls: EvalToolCall[];
    toolResults: unknown[];
};

export type EvalScorerArgs = {
    input: EvalCase;
    output: EvalOutput;
    expected: EvalExpected;
};
