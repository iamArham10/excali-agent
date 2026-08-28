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
    .min(2).max(2)
    .describe(
        "An ordered list of [x, y] coordinate points that defines the path of the line or arrow. " +
        "Coordinates MUST be relative to the arrow's x and y, never absolute canvas coordinates. " +
        "The first point MUST be [0, 0]. The last point is the offset from the start to the end. " +
        "The path must run from the shape in start.id toward the shape in end.id. " +
        "Do not create bends, always create straight lines, give only two points a start and end," +
        "Please make sure you arrow connects with the shapes both at starting and ending" +
        "For connecting them property think about the elements position and then what offset should i use," +
        "That will make arrow start-start from the edge of the start shape and arrow end-end to the end shape" +
        "For a straight 200px rightward arrow use x/y for its canvas start and points [[0, 0], [200, 0]].",
    );

const drawArrowElementSchema = z.object({
    type: z.literal("arrow"),
    id: z
        .string()
        .describe(
            "id of the arrow element, choose unique id so you can later refer to the element",
        ),
    x: z
        .number()
        .describe("canvas x coordinate of the arrow's first path point"),
    y: z
        .number()
        .describe("canvas y coordinate of the arrow's first path point"),
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
        .describe(
            "shape at the first path point; points must travel away from this shape",
        ),
    end: z
        .object({
            id: z
                .string()
                .describe("id of the shape to which to connect the arrow"),
        })
        .optional()
        .describe(
            "shape at the last path point; points must travel toward this shape",
        ),
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

const deleteElementSchema = z.object({
    id: z.string().describe("id of the element to delete"),
});

const DrawElementsToolSchema = z.object({
    elements: z
        .array(
            z.discriminatedUnion("type", [
                drawShapeElementSchema,
                drawTextElementSchema,
                drawArrowElementSchema,
            ]),
        )
        .min(1)
        .describe("elements to draw"),
});

const ModifyElementsToolSchema = z.object({
    elements: z
        .array(
            z.discriminatedUnion("type", [
                modifyShapeElementSchema,
                modifyTextElementSchema,
                modifyArrowElementSchema,
            ]),
        )
        .min(1)
        .describe("elements to modify"),
});

const DeleteElementsToolSchema = z.object({
    elements: z
        .array(deleteElementSchema)
        .min(1)
        .describe("elements to delete"),
});

export {
    DrawElementsToolSchema,
    ModifyElementsToolSchema,
    DeleteElementsToolSchema,
};
