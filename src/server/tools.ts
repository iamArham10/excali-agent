import z from "zod";
import { tool } from "ai";

import {
    drawArrowElementSchema,
    drawShapeElementSchema,
    drawTextElementSchema,
    modifyArrowElementSchema,
    modifyTextElementSchema,
    modifyShapeElementSchema,
} from "./excali-schema";

const drawElements = tool({
    description:
        "Draw one or more elements on the canvas. Supports shapes (rectangle, " +
        "ellipse, diamond) and text elements. Elements can reference each " +
        "other by id within the same call.",
    inputSchema: z.object({
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
    }),
    execute: async ({ elements }) => {
        return { elements };
    },
});

const modifyElements = tool({
    description:
        "modify one or more elements on the canvas. use id to reference elements, and make sure to include type as well.",
    inputSchema: z.object({
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
    }),
    execute: async ({ elements }) => {
        return {
            // strip out absent optional attributes so only actually-provided
            // fields are shipped to the client
            elements: elements.map((e) =>
                Object.fromEntries(
                    Object.entries(e).filter(
                        ([, value]) => value !== undefined,
                    ),
                ),
            ),
        };
    },
});

const tools = {
    drawElements,
    modifyElements,
};

export { tools };
