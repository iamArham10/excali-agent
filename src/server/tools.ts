import { tool } from "ai";
import { z } from "zod";
import { xid } from "zod/mini";

const strokeStyle = z.enum(["solid", "dashed", "dotted"]).optional();
const fillStyle = z.enum(["solid", "hachure", "cross-hatch"]).optional();

const baseStyleSchema = z.object({
  strokeColor: z.string().optional().describe("Hex color for outline/text, e.g. '#1e1e1e'"),
  backgroundColor: z
    .string()
    .optional()
    .describe("Hex color for background, e.g. '#ffffff' or transparent"),
  strokeWidth: z.number().optional().describe("1 = thin, 2 = bold, 4 = extra bold"),
  strokeStyle,
  roughness: z.number().optional().describe("0 = architect (clean), 1 = artist, 2 = cartoonist"),
  opacity: z.number().min(0).max(100).optional().describe("0 = transparent, 100 = opaque"),
  angle: z.number().optional().describe("Rotation in radians"),
});

const labelSchema = z
  .object({
    text: z.string().optional().describe("Text to render inside/on the element"),
    strokeColor: z.string().optional().describe("Hex color for outline/text, e.g. '#1e1e1e'"),
    fontSize: z.number().optional().describe("Font size in pixels"),
    textAlign: z.enum(["left", "center", "right"]).optional().describe("Text alignment"),
    verticalAlign: z.enum(["top", "middle", "bottom"]).optional().describe("Vertical alignment"),
  })
  .optional()
  .describe(
    "Optional inline label. For shapes this creates a bound text container. For arrows, a centered label is displayed.",
  );

const shapeItemSchema = z.object({
  id: z
    .string()
    .optional()
    .describe(
      "Short unique id (e.g. 'start-box', 'db'). REQUIRED if this shape will be connected by a connector or updated later — connectors bind by this exact id",
    ),
  type: z.enum(["rectangle", "ellipse", "diamond"]).describe("Shape type"),
  x: z.number().describe("X coordinate"),
  y: z.number().describe("Y coordinate"),
  width: z.number().optional().describe("Width"),
  height: z.number().optional().describe("Height"),
  label: labelSchema,
  ...baseStyleSchema.shape,
});

const textItemSchema = z.object({
  id: z.string().optional(),
  type: z.literal("text").default("text"),
  x: z.number().describe("X coordinate"),
  y: z.number().describe("Y coordinate"),
  text: z.string().describe("Text content"),
  fontSize: z.number().optional().describe("Font size, default 20"),
  strokeColor: z.string().optional().describe("Text color"),
  fontFamily: z.string().optional().describe("Font family"),
  textAlign: z.enum(["left", "center", "right"]).optional().describe("Text alignment"),
  verticalAlign: z.enum(["top", "middle", "bottom"]).optional().describe("Vertical alignment"),
});

const bindingSchema = z
  .union([
    z.object({ id: z.string().describe("Id of an existing element on the canvas to bind to") }),
    z.object({
      type: z.enum(["rectangle", "ellipse", "diamond", "text"]),
      strokeColor: z.string().optional().describe("Stroke color"),
      backgroundColor: z.string().optional().describe("Background color"),
    }),
  ])
  .describe(
    "Prefer {id} of an existing element (created earlier with an id set). {type} spawns a brand-new inline shape at that end instead.",
  );

const arrowHeadSchema = z.enum(["triangle", "circle", "bar", "dog"]).nullable().optional();

const connectorItemSchema = z.object({
  id: z.string().optional(),
  type: z.enum(["line", "arrow"]),
  x: z.number(),
  y: z.number(),
  width: z.number().optional(),
  height: z.number().optional(),
  points: z
    .array(z.tuple([z.number(), z.number()]))
    .optional()
    .describe(
      "Array of [x, y] points relative to (x, y). Omit if using width/height or binding for a straight connector",
    ),
  startArrowHead: arrowHeadSchema,
  endArrowHead: arrowHeadSchema,
  label: labelSchema,
  start: bindingSchema.optional(),
  end: bindingSchema.optional(),
  strokeColor: z.string().optional(),
  strokeWidth: z.number().optional(),
  strokeStyle,
});

const createShapeTool = tool({
  description:
    "Create one or more shapes (rectangle, ellipse, diamond) on the canvas. " +
    "Always set a unique id on every shape so connectors can bind to it and updateElementTool can target it later",
  inputSchema: z.object({
    elements: z.array(shapeItemSchema).min(1),
  }),
  execute: async ({ elements }) => {
    return {
      elements,
    };
  },
});

const createTextTool = tool({
  description: "Create one or more standalone text elements on the canvas (not bound to a shape)",
  inputSchema: z.object({
    elements: z.array(textItemSchema).min(1),
  }),
  execute: async ({ elements }) => {
    return {
      elements,
    };
  },
});

export const createConnectorTool = tool({
  description:
    "Create one or more lines or arrows, bound to existing shapes by id via start/end. " +
    "Use this whenever connecting boxes in a diagram or flowchart. " +
    "The shapes must already exist: create them first with createShapeTool (with ids set), then reference their exact ids as start: {id} / end: {id}. " +
    "Still provide x/y/width/height that visually line up with the bound shapes — the connector renders at its own coordinates",
  inputSchema: z.object({
    elements: z.array(connectorItemSchema).min(1),
  }),
  execute: async ({ elements }) => {
    return {
      elements,
    };
  },
});

export const updateElementTool = tool({
  description:
    "Modify properties of an existing element by id (position, size, color, text, etc). " +
    "Only include the fields you want to change; everything else is left as-is",
  inputSchema: z.object({
    id: z.string().describe("Id of the element to update"),
    changes: z.object({
      x: z.number().optional(),
      y: z.number().optional(),
      width: z.number().optional(),
      height: z.number().optional(),
      text: z.string().optional(),
      ...baseStyleSchema.shape,
    }),
  }),
  execute: async ({ id, changes }) => {
    return {
      id,
      changes,
    };
  },
});

const tools = {
  createShapeTool,
  createConnectorTool,
  createTextTool,
  updateElementTool,
};

export default tools;
