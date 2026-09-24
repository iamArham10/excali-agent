// Client-side tools (no execute handler — dispatched by the frontend)
import {
    createDiagram,
    updateDiagram,
    deleteDiagram,
    getCanvasState,
    clearCanvas,
} from "./client/canvas-tools";

// Server-side tools (with execute handler — run on the worker)
import { webSearchTool } from "./server/web-search-tool";
import { knowledgeSearchTool } from "./server/knowledge-tool";

export const tools = {
    createDiagram,
    updateDiagram,
    deleteDiagram,
    clearCanvas,
    getCanvasState,
    webSearchTool,
    knowledgeSearchTool,
};
