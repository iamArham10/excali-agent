import { tool } from "ai";
import { z } from "zod";

const baseFields = {
    id: z
        .string()
        .describe("unique readable id for the element, e.g. box-1 or arrow-1"),
    strokeColor: z
        .string()
        .default("#1e1e1e")
        .describe("stroke color (hex)"),
    strokeWidth: z.number().default(2),
    roughness: z
        .number()
        .default(1)
        .describe("0 for clean, 1 for sketchy"),
    opacity: z.number().default(100),
};

const shapeFields = {
    x: z.number().describe("x of the element's top-left corner (canvas units)"),
    y: z.number().describe("y of the element's top-left corner (canvas units)"),
    width: z.number().describe("element width in canvas units"),
    height: z.number().describe("element height in canvas units"),
    backgroundColor: z
        .string()
        .default("transparent")
        .describe(
            "fill color (hex) or transparent; use color to distinguish element types",
        ),
    fillStyle: z.enum(["solid", "hachure", "cross-hatch"]).default("solid"),
};

const bindingFields = {
    elementId: z
        .string()
        .describe("id of the element this arrow attaches to"),
    focus: z
        .number()
        .describe("0-1, where on the element edge the arrow connects (0.5 = middle)"),
    gap: z
        .number()
        .describe("distance between arrow tip and element edge in canvas units (0 = touching)"),
};

const elementSchema = z.discriminatedUnion("type", [
    z.object({
        type: z.literal("rectangle"),
        ...shapeFields,
        ...baseFields,
    }),
    z.object({
        type: z.literal("ellipse"),
        ...shapeFields,
        ...baseFields,
    }),
    z.object({
        type: z.literal("diamond"),
        ...shapeFields,
        ...baseFields,
    }),
    z.object({
        type: z.literal("text"),
        x: z.number().describe("x of the label's top-left corner (canvas units)"),
        y: z.number().describe("y of the label's top-left corner (canvas units)"),
        text: z.string().describe("short label content (2-5 words)"),
        fontSize: z.number().default(20),
        fontFamily: z
            .number()
            .default(1)
            .describe("1=Virgil, 2=Helvetica, 3=Cascadia"),
        textAlign: z.enum(["left", "center", "right"]).default("center"),
        ...baseFields,
    }),
    z.object({
        type: z.literal("arrow"),
        x: z
            .number()
            .describe("x of the arrow's origin — its points are offsets from here"),
        y: z
            .number()
            .describe("y of the arrow's origin — its points are offsets from here"),
        points: z
            .array(z.array(z.number()))
            .describe(
                "Path as [x,y] offsets from the arrow's x/y origin, e.g. [[0,0],[150,0]]",
            ),
        startBinding: z
            .object(bindingFields)
            .optional()
            .describe("Bind arrow start to an element"),
        endBinding: z
            .object(bindingFields)
            .optional()
            .describe("Bind arrow end to an element"),
        ...baseFields,
    }),
    z.object({
        type: z.literal("line"),
        x: z
            .number()
            .describe("x of the line's origin — its points are offsets from here"),
        y: z
            .number()
            .describe("y of the line's origin — its points are offsets from here"),
        points: z
            .array(z.array(z.number()))
            .describe(
                "Path as [x,y] offsets from the line's x/y origin, e.g. [[0,0],[150,0]]",
            ),
        ...baseFields,
    }),
]);

const generateDiagram = tool({
    description: `Generate a complete diagram as an array of Excalidraw elements. Use this when the user asks you to create, draw, or design a new diagram. Calling this tool replaces the entire canvas.

Layout:
- Arrange related shapes left-to-right or top-down following the logical flow, with consistent spacing (about 80-150 units apart) so the diagram reads clearly.
- Never overlap elements.

Element types:
- rectangle / ellipse / diamond: the shapes of the diagram. Use diamond for decisions, ellipse for start/end or emphasis, rectangle for everything else. Give every shape a unique readable id (e.g. box-1, box-2). Position with x/y (top-left corner), size with width/height.
- text: short labels (2-5 words) placed inside or beside the shape they describe, e.g. a box title. Text elements only need x, y, and text.
- arrow: connects two related shapes. Set x/y to the arrow's origin (e.g. the right edge of the source shape, vertically centered) and points to its path as [x,y] offsets from that origin, e.g. [[0,0],[150,0]] for a horizontal arrow pointing right.

Connecting arrows (do this for every arrow):
- startBinding: { elementId: <id of the shape the arrow leaves>, focus: 0.5, gap: 0 }
- endBinding: { elementId: <id of the shape the arrow enters>, focus: 0.5, gap: 0 }

Style (optional):
- Fill shapes with backgroundColor and vary colors between element types to make the diagram easier to scan.`,
    inputSchema: z.object({
        elements: z
            .array(elementSchema)
            .describe("Array of Excalidraw elements, that make up the diagram"),
    }),
    execute: async ({ elements }) => {
        return { elements };
    },
});

const modifyDiagram = tool({
    description: `Modify one existing element on the canvas. Use this when the user asks to change part of an already-drawn diagram: rename a label, or move, resize, recolor, or restyle a shape.

Rules:
- elementId must match the id of an element that already exists on the canvas (ids were assigned when the diagram was created, e.g. box-1).
- Pass only the fields you want to change; omit the rest (do not include unchanged fields).
- To change a label, update updates.text on the text element that holds the label.
- This tool cannot add or remove elements; it only changes one element's properties.`,
    inputSchema: z.object({
        elementId: z.string().describe("The id of the element to modify"),
        updates: z.object({
            x: z.number().nullish(),
            y: z.number().nullish(),
            width: z.number().nullish(),
            height: z.number().nullish(),
            text: z.string().nullish(),
            fontSize: z.number().nullish(),
            textAlign: z.enum(["left", "center", "right"]).nullish(),
            strokeColor: z.string().nullish(),
            backgroundColor: z.string().nullish(),
            fillStyle: z.enum(["solid", "hachure", "cross-hatch"]).nullish(),
            strokeWidth: z.number().nullish(),
            roughness: z.number().nullish(),
            opacity: z.number().nullish(),
        }),
    }),
    execute: async ({ elementId, updates }) => {
        // remove null fields
        const filtered: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(updates)) {
            if (value !== null) filtered[key] = value;
        }
        return { elementId, updates: filtered };
    },
});

const tools = {
    generateDiagram,
    modifyDiagram,
};

export default tools;
