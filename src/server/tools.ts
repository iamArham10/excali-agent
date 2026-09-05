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
        "ellipse, diamond) and text elements. Elements can reference each " +
        "other by id within the same call.",
    inputSchema: DrawElementsToolSchema,
});

const modifyElements = tool({
    description:
        "modify one or more elements on the canvas. use id to reference elements, and make sure to include type as well.",
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
    description:
        "Get Canvas State, the elements currently on the canvas",
    inputSchema: z.object({}),
})

const tools = {
    drawElements,
    modifyElements,
    deleteElements,
    getCanvasState,
    webSearchTool,
    knowledgeSearchTool,
};

export { tools };
