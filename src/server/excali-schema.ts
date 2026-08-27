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

const arrowEndpointSchema = z.object({
    id: z.string().describe("id of the shape to connect"),
});

const arrowStyleSchema = z.object({
    type: z.literal("arrow"),
    id: z
        .string()
        .describe(
            "id of the arrow element, choose unique id so you can later refer to the element",
        ),
    label: label.optional().describe("label to attach to the arrow"),
    startArrowhead: z
        .enum(["circle", "diamond", "arrow", "bar", "dot"])
        .optional()
        .describe("optional arrowhead shape at the start of the arrow"),
    endArrowhead: z
        .enum(["circle", "diamond", "arrow", "bar", "dot"])
        .optional()
        .describe("optional arrowhead shape at the end of the arrow"),
});

const drawArrowElementSchema = arrowStyleSchema.extend({
    start: arrowEndpointSchema.describe(
        "id of the shape from which the arrow starts",
    ),
    end: arrowEndpointSchema.describe(
        "id of the shape to which the arrow points",
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

const modifyArrowElementSchema = arrowStyleSchema.partial().required({
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
