import { z } from "zod";

const drawShapeElementSchema = z.strictObject({
    id: z
        .string()
        .describe(
            "id of the element, choose unique id so you can later refer to the element",
        ),
    type: z
        .enum(["rectangle", "ellipse", "diamond"])
        .describe("type of shape to draw"),
    x: z.int().describe("top left x coordinate of the shape"),
    y: z.int().describe("top left y coordinate of the shape"),
    width: z.int().min(1).optional().describe("width of the shape"),
    height: z.int().min(1).optional().describe("height of the shape"),
});

const drawTextElementSchema = z.strictObject({
    type: z.literal("text"),
    id: z
        .string()
        .describe(
            "id of the text element, choose unique id so you can later refer to the element",
        ),
    text: z.string().min(1).describe("the text content to draw on the canvas"),
    x: z.int().describe("top left x coordinate of the text"),
    y: z.int().describe("top left y coordinate of the text"),
});

export { drawShapeElementSchema, drawTextElementSchema };
