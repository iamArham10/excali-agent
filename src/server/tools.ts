import { tool } from "ai";
import { z } from "zod";

import { shapeSchema, textSchema } from "./tools-schema";

const drawShapeOnCanvas = tool({
    description: "Draw shapes on canvas",
    inputSchema: z.object({ elements: z.array(shapeSchema) }),
    execute: async ({ elements }) => {
        return { elements };
    },
});

const drawTextOnCanvas = tool({
    description: "Draw text on the canvas",
    inputSchema: z.object({ elements: z.array(textSchema) }),
    execute: async ({ elements }) => {
        // add type "text" with every element
        return {
            elements: elements.map((el) => {
                return { ...el, type: "text" as const };
            }),
        };
    },
});

export const tools = { drawShapeOnCanvas, drawTextOnCanvas };
