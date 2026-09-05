import { tool } from "ai";
import { z } from "zod";
import { webSearchTool } from "./web-search-tool";
import { knowledgeSearchTool } from "./knowledge-tool";

import {
    DeleteElementsToolSchema,
    DrawElementsToolSchema,
    ModifyElementsToolSchema,
} from "./excali-schema";

const drawElements = tool({
    description:
        "Draw one or more elements on the canvas. Supports shapes (rectangle, " +
        "ellipse, diamond), text, straight lines, and arrows. Elements support " +
        "colors, fill and stroke styles, opacity, rotation, and typography. " +
        "Shapes, lines, and arrows can have styled labels; arrows can reference " +
        "shapes by id within the same call.",
    inputSchema: DrawElementsToolSchema,
});

const modifyElements = tool({
    description:
        "Modify the geometry, text, labels, colors, fill and stroke styles, " +
        "opacity, rotation, typography, or arrowheads of one or more existing " +
        "elements. Use id to reference each element and always include its type. " +
        "Only include properties that should change.",
    inputSchema: ModifyElementsToolSchema,
});

const deleteElements = tool({
    description:
        "delete one or more elements on the canvas. " +
        "Also deletes labels bound to the deleted elements and any arrows " +
        "connected to them.",
    inputSchema: DeleteElementsToolSchema,
});

const getCanvasState = tool({
    description: "Get Canvas State, the elements currently on the canvas",
    inputSchema: z.object({}),
});

const clearCanvas = tool({
    description: "Clear the canvas, remove all elements",
    inputSchema: z.object({}),
});

const tools = {
    drawElements,
    modifyElements,
    deleteElements,
    clearCanvas,
    getCanvasState,
    webSearchTool,
    knowledgeSearchTool,
};

export { tools };
