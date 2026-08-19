import { z } from "zod";

const label = z.object({
    text: z.string().describe("text of the label"),
});

const drawShapeElementSchema = z.object({
    id: z
        .string()
        .describe(
            "id of the element, choose unique id so you can later refer to the element",
        ),
    type: z
        .enum(["rectangle", "ellipse", "diamond"])
        .describe("type of shape to draw"),
    x: z.number().describe("top left x coordinate of the shape"),
    y: z.number().describe("top left y coordinate of the shape"),
    width: z.number().min(1).optional().describe("width of the shape"),
    height: z.number().min(1).optional().describe("height of the shape"),
    label: label.optional().describe("label to attach to the shape"),
});

const drawTextElementSchema = z.object({
    type: z.literal("text"),
    id: z
        .string()
        .describe(
            "id of the text element, choose unique id so you can later refer to the element",
        ),
    text: z.string().min(1).describe("the text content to draw on the canvas"),
    x: z.number().describe("top left x coordinate of the text"),
    y: z.number().describe("top left y coordinate of the text"),
});

const pointSchema = z
    .array(z.tuple([z.number(), z.number()]))
    .min(2)
    .describe(
        "An ordered list of [x, y] coordinate points that defines the path of the line or arrow. " +
            "Coordinates are relative to the element's x and y position. " +
            "The first point is the start of the path and the last point is the end. " +
            "Use additional points to create bends or multi-segment paths. " +
            "For a straight line, provide exactly two points such as [[0, 0], [200, 0]].",
    );

const drawArrowElementSchema = z.object({
    type: z.literal("arrow"),
    id: z
        .string()
        .describe(
            "id of the arrow element, choose unique id so you can later refer to the element",
        ),
    x: z.number().describe("top left x coordinate of the arrow"),
    y: z.number().describe("top left y coordinate of the arrow"),
    label: label.optional().describe("label to attach to the arrow"),
    points: pointSchema.optional(),
    startArrowhead: z
        .enum(["circle", "diamond", "arrow", "bar", "dot"])
        .describe("arrowhead shape at the start of the arrow"),
    endArrowhead: z
        .enum(["circle", "diamond", "arrow", "bar", "dot"])
        .describe("arrowhead shape at the end of the arrow"),
    start: z
        .object({
            id: z
                .string()
                .describe("id of the shape from which to start the arrow"),
        })
        .optional()
        .describe("shape from which to start the arrow"),
    end: z
        .object({
            id: z
                .string()
                .describe("id of the shape to which to connect the arrow"),
        })
        .optional()
        .describe("shape to which to connect the arrow"),
});

const modifyShapeElementSchema = drawShapeElementSchema.partial().required({
    id: true,
    type: true,
});

const modifyTextElementSchema = drawTextElementSchema.partial().required({
    id: true,
    type: true,
});

const modifyArrowElementSchema = drawArrowElementSchema.partial().required({
    id: true,
    type: true,
});

export {
    drawShapeElementSchema,
    drawTextElementSchema,
    drawArrowElementSchema,
    modifyArrowElementSchema,
    modifyTextElementSchema,
    modifyShapeElementSchema,
};
