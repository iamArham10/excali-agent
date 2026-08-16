import { z } from "zod";

const shapeSchema = z.object({
    id: z
        .string()
        .describe("Unique id for the shape, use this id so later you can refer to this object"),
    type: z.enum(["rectangle", "ellipse", "diamond"]).describe("Type of shape."),
    x: z.number().describe("top left x position"),
    y: z.number().describe("top left y position"),
    width: z.number().min(0).describe("width of the shape"),
    height: z.number().min(0).describe("height of the shape"),
});

const textSchema = z.object({
    id: z.string().describe("Unique id for the text, use this id so later you can refer to this"),
    x: z.number().describe("top left x position"),
    y: z.number().describe("top left y position"),
    text: z.string().optional().describe("text content"),
});

const lineSchema = z.object({
    id: z.string().describe("Unique id for the text, use this id so later you can refer to this"),
    type: z.enum(["arrow", "line"]).describe("type of the line arrow or line"),
    x: z.number().describe("top left x position"),
    y: z.number().describe("top left y position"),
});

export { shapeSchema, textSchema };
