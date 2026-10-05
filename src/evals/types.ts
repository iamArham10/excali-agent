import { z } from "zod";
import {
    ARCHITECTURE_NODE_KINDS,
    CLASS_NODE_KINDS,
    COLOR_NAMES,
    DiagramSpecSchema,
    ER_NODE_KINDS,
    FLOWCHART_NODE_KINDS,
} from "../shared/schemas/diagram-schema";
import { TOOL_NAMES } from "../shared/tool-names";

export const toolNameSchema = z.enum([
    TOOL_NAMES.CREATE_DIAGRAM,
    TOOL_NAMES.UPDATE_DIAGRAM,
    TOOL_NAMES.DELETE_DIAGRAM,
    TOOL_NAMES.CLEAR_CANVAS,
    TOOL_NAMES.GET_CANVAS_STATE,
    TOOL_NAMES.WEB_SEARCH,
    TOOL_NAMES.KNOWLEDGE_SEARCH,
]);

export const suiteNameSchema = z.enum([
    "routing",
    "creation",
    "editing",
    "research",
]);

const difficultySchema = z.enum(["easy", "medium", "hard"]);

/**
 * A label expectation: case-insensitive substring match. An array means
 * "any of these" (e.g. ["Postgres", "Database"]).
 */
const labelMatcherSchema = z.union([
    z.string().min(1),
    z.array(z.string().min(1)).min(1),
]);

/** A prior createDiagram interaction replayed before the eval input. */
const seedSchema = z.object({
    priorPrompt: z.string(),
    priorResponse: z.string(),
    diagram: DiagramSpecSchema,
});

const routingExpectationSchema = z.object({
    requiredTools: z.array(toolNameSchema),
    forbiddenTools: z.array(toolNameSchema).default([]),
    orderedTools: z.array(toolNameSchema).optional(),
    allowAdditionalTools: z.boolean().default(false),
});

const nodeExpectationSchema = z.object({
    label: labelMatcherSchema,
    kind: z
        .enum([
            ...ARCHITECTURE_NODE_KINDS,
            ...FLOWCHART_NODE_KINDS,
            ...ER_NODE_KINDS,
            ...CLASS_NODE_KINDS,
        ])
        .optional(),
});

/** Edge (architecture/flowchart) between nodes identified by label. */
const connectionExpectationSchema = z.object({
    from: labelMatcherSchema,
    to: labelMatcherSchema,
    label: labelMatcherSchema.optional(),
    style: z.enum(["solid", "dashed"]).optional(),
});

/** Sequence message between participants identified by label. */
const messageExpectationSchema = z.object({
    from: labelMatcherSchema,
    to: labelMatcherSchema,
    label: labelMatcherSchema.optional(),
    kind: z.enum(["sync", "async", "reply"]).optional(),
});

const groupExpectationSchema = z.object({
    label: labelMatcherSchema,
    /** Node labels that must sit in this group or one of its nested groups. */
    contains: z.array(labelMatcherSchema).default([]),
    /** Label of the enclosing group, when nesting is required. */
    parent: labelMatcherSchema.optional(),
});

const diagramExpectationSchema = z.object({
    diagramType: z.enum(["architecture", "flowchart", "sequence", "er", "class"]),
    direction: z.enum(["LR", "TB"]).optional(),
    /** Architecture/flowchart nodes. */
    nodes: z.array(nodeExpectationSchema).default([]),
    connections: z.array(connectionExpectationSchema).default([]),
    groups: z.array(groupExpectationSchema).default([]),
    /** Sequence participants. */
    participants: z.array(labelMatcherSchema).default([]),
    /** Sequence messages, matched in order (other messages may be interleaved). */
    messages: z.array(messageExpectationSchema).default([]),
    /** Upper bound on nodes/participants, to penalize invented components. */
    maxNodes: z.number().int().positive().optional(),
    /** validateDiagramSpec warnings (e.g. unlabeled decision branches) count as a failed check. */
    forbidWarnings: z.boolean().default(true),
});

const editingExpectationSchema = z.object({
    /** update = updateDiagram on the seeded diagram; delete = deleteDiagram; clear = clearCanvas. */
    action: z.enum(["update", "delete", "clear"]).default("update"),
    /** Diagram id that must be reused. Defaults to the seed's diagramId. */
    diagramId: z.string().optional(),
    /** Expected value of updateDiagram's relayout flag (absent counts as false). */
    relayout: z.boolean().default(false),
    /** Node/participant labels that must exist after the update. */
    nodesPresent: z.array(labelMatcherSchema).default([]),
    /** Node/participant labels that must no longer exist after the update. */
    nodesAbsent: z.array(labelMatcherSchema).default([]),
    /** Seed node/participant ids that must survive with the same id and label. */
    preservedIds: z.array(z.string()).default([]),
    /** Seed node ids whose properties must change to the given values (id kept). */
    changedNodes: z
        .array(
            z.object({
                id: z.string(),
                label: labelMatcherSchema.optional(),
                kind: z.string().optional(),
                color: z.enum(COLOR_NAMES).optional(),
            }),
        )
        .default([]),
    connectionsPresent: z.array(connectionExpectationSchema).default([]),
    /** Sequence messages that must appear, in order, after the update. */
    messages: z.array(messageExpectationSchema).default([]),
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
    research: researchExpectationSchema.optional(),
    response: responseExpectationSchema.optional(),
});

export const evalCaseSchema = z.object({
    id: z.string().min(1),
    suite: suiteNameSchema,
    input: z.string().min(1),
    difficulty: difficultySchema,
    tags: z.array(z.string()).default([]),
    seed: seedSchema.optional(),
    expected: expectationSchema,
});

export const evalDatasetSchema = z.array(evalCaseSchema).min(1);

export type ToolName = z.infer<typeof toolNameSchema>;
export type SuiteName = z.infer<typeof suiteNameSchema>;
export type LabelMatcher = z.infer<typeof labelMatcherSchema>;
export type ConnectionExpectation = z.infer<typeof connectionExpectationSchema>;
export type MessageExpectation = z.infer<typeof messageExpectationSchema>;
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
