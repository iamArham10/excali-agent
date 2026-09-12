// Client-side tools (no execute handler — dispatched by the frontend)
import {
    drawElements,
    modifyElements,
    deleteElements,
    getCanvasState,
    clearCanvas,
} from "./client/canvas-tools";
import { drawDiagramUsingMermaid } from "./client/mermaid-tool";

// Server-side tools (with execute handler — run on the worker)
import { webSearchTool } from "./server/web-search-tool";
import { knowledgeSearchTool } from "./server/knowledge-tool";

export const tools = {
    drawElements,
    modifyElements,
    deleteElements,
    clearCanvas,
    getCanvasState,
    webSearchTool,
    knowledgeSearchTool,
    drawDiagramUsingMermaid,
};
