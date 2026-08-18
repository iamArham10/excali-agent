import z from "zod";
import { tool } from "ai";

import {
    drawArrowElementSchema,
    drawShapeElementSchema,
    drawTextElementSchema,
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

const tools = {
    drawElements,
};

export { tools };
