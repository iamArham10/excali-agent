import { z } from "zod";

const idSchema = z
    .string()
    .min(1)
    .max(40)
    .regex(
        /^[a-z0-9][a-z0-9_-]*$/,
        "ids must be short lowercase slugs like 'auth-svc' or 'users_db'",
    );

const labelSchema = z
    .string()
    .min(1)
    .max(80)
    .describe(
        "Short visible text. Use \\n for a second line, e.g. 'Auth Service\\n(Node.js)'.",
    );

export const COLOR_NAMES = [
    "blue",
    "green",
    "red",
    "orange",
    "yellow",
    "purple",
    "teal",
    "gray",
] as const;

const colorSchema = z
    .enum(COLOR_NAMES)
    .optional()
    .describe(
        "Optional color override. Omit it to use the default color for the node kind.",
    );

const directionSchema = z
    .enum(["LR", "TB"])
    .optional()
    .describe("Main flow direction: LR = left to right, TB = top to bottom.");

const titleSchema = z
    .string()
    .min(1)
    .max(80)
    .optional()
    .describe("Optional heading drawn above the diagram.");

const edgeBase = {
    id: idSchema
        .optional()
        .describe(
            "Stable edge id. Omit to derive one from from/to. Keep ids stable across updates.",
        ),
    from: idSchema.describe("id of the source node"),
    to: idSchema.describe("id of the target node"),
    label: z
        .string()
        .min(1)
        .max(40)
        .optional()
        .describe("Short edge label, e.g. 'REST', 'publishes', 'yes'."),
    style: z
        .enum(["solid", "dashed"])
        .optional()
        .describe("solid (default) or dashed (async, optional, or secondary flow)."),
    arrow: z
        .enum(["forward", "both", "none"])
        .optional()
        .describe("Arrowheads: forward (default) from -> to, both, or none."),
};

export const ARCHITECTURE_NODE_KINDS = [
    "service",
    "database",
    "cache",
    "queue",
    "storage",
    "gateway",
    "client",
    "user",
    "external",
] as const;

export const FLOWCHART_NODE_KINDS = [
    "start",
    "end",
    "process",
    "decision",
    "io",
    "subprocess",
] as const;

export const SEQUENCE_PARTICIPANT_KINDS = [
    "actor",
    "service",
    "database",
    "external",
] as const;

const architectureSpec = z.object({
    type: z.literal("architecture"),
    diagramId: idSchema.describe("Unique id of this diagram on the canvas."),
    title: titleSchema,
    direction: directionSchema.describe("Defaults to LR."),
    groups: z
        .array(
            z.object({
                id: idSchema,
                label: labelSchema,
                parent: idSchema
                    .optional()
                    .describe("id of an enclosing group, for nesting (e.g. subnet inside VPC)"),
            }),
        )
        .optional()
        .describe(
            "Boundaries such as VPCs, clusters, regions, or bounded contexts. Drawn as dashed containers.",
        ),
    nodes: z
        .array(
            z.object({
                id: idSchema,
                label: labelSchema,
                kind: z
                    .enum(ARCHITECTURE_NODE_KINDS)
                    .optional()
                    .describe("Visual role of the node. Defaults to service."),
                group: idSchema.optional().describe("id of the group containing this node"),
                color: colorSchema,
            }),
        )
        .min(1),
    edges: z
        .array(z.object(edgeBase))
        .optional()
        .describe("Connections such as calls, reads/writes, or event flow."),
});

const flowchartSpec = z.object({
    type: z.literal("flowchart"),
    diagramId: idSchema.describe("Unique id of this diagram on the canvas."),
    title: titleSchema,
    direction: directionSchema.describe("Defaults to TB."),
    nodes: z
        .array(
            z.object({
                id: idSchema,
                label: labelSchema,
                kind: z
                    .enum(FLOWCHART_NODE_KINDS)
                    .optional()
                    .describe(
                        "start/end = terminator, process = step, decision = yes/no branch, io = input/output, subprocess = call into another flow. Defaults to process.",
                    ),
                color: colorSchema,
            }),
        )
        .min(1),
    edges: z
        .array(z.object(edgeBase))
        .optional()
        .describe("Flow between steps. Label every edge leaving a decision (e.g. yes/no)."),
});

const sequenceSpec = z.object({
    type: z.literal("sequence"),
    diagramId: idSchema.describe("Unique id of this diagram on the canvas."),
    title: titleSchema,
    participants: z
        .array(
            z.object({
                id: idSchema,
                label: labelSchema,
                kind: z
                    .enum(SEQUENCE_PARTICIPANT_KINDS)
                    .optional()
                    .describe("Defaults to service."),
                color: colorSchema,
            }),
        )
        .min(1)
        .describe("Participants in left-to-right order."),
    messages: z
        .array(
            z.object({
                from: idSchema,
                to: idSchema.describe("Use the same id as from for a self-call."),
                label: z.string().min(1).max(60),
                kind: z
                    .enum(["sync", "async", "reply"])
                    .optional()
                    .describe(
                        "sync = request (default), async = fire-and-forget, reply = response (dashed).",
                    ),
            }),
        )
        .describe("Messages in chronological order, top to bottom."),
});

export const DiagramSpecSchema = z.discriminatedUnion("type", [
    architectureSpec,
    flowchartSpec,
    sequenceSpec,
]);

export const CreateDiagramToolSchema = z.object({
    diagram: DiagramSpecSchema,
});

export const UpdateDiagramToolSchema = z.object({
    diagram: DiagramSpecSchema.describe(
        "The COMPLETE new spec for an existing diagramId (not a patch). Anything omitted is removed.",
    ),
    relayout: z
        .boolean()
        .optional()
        .describe(
            "Re-run automatic layout for every node. Default false keeps existing node positions (including ones the user moved by hand) and only places new nodes. Set true only when the user asks to tidy up or re-arrange.",
        ),
});

export const DeleteDiagramToolSchema = z.object({
    diagramId: idSchema,
});

export type DiagramSpec = z.infer<typeof DiagramSpecSchema>;
export type ArchitectureSpec = z.infer<typeof architectureSpec>;
export type FlowchartSpec = z.infer<typeof flowchartSpec>;
export type SequenceSpec = z.infer<typeof sequenceSpec>;
export type GraphSpec = ArchitectureSpec | FlowchartSpec;
export type EdgeSpec = GraphSpec["edges"] extends (infer E)[] | undefined ? E : never;
export type ColorName = (typeof COLOR_NAMES)[number];
export type CreateDiagramInput = z.infer<typeof CreateDiagramToolSchema>;
export type UpdateDiagramInput = z.infer<typeof UpdateDiagramToolSchema>;
export type DeleteDiagramInput = z.infer<typeof DeleteDiagramToolSchema>;
