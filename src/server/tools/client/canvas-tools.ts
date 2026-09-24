import { tool } from "ai";
import { z } from "zod";

import {
    CreateDiagramToolSchema,
    DeleteDiagramToolSchema,
    UpdateDiagramToolSchema,
} from "../../../shared/schemas/diagram-schema";

export const createDiagram = tool({
    description:
        "Create a new technical diagram (architecture, flowchart, or sequence) from a semantic spec. " +
        "Layout, sizing, styling, and arrow routing are computed automatically: never provide coordinates. " +
        "The new diagram is placed beside existing content without touching it.",
    inputSchema: CreateDiagramToolSchema,
});

export const updateDiagram = tool({
    description:
        "Change an existing diagram by sending its COMPLETE new spec (same diagramId). Nodes, edges, " +
        "and groups are matched by id: unchanged nodes keep their current position (including positions " +
        "the user dragged), new nodes are placed next to their neighbours, and omitted items are removed. " +
        "Use this for every edit, including renames, additions, removals, and recoloring.",
    inputSchema: UpdateDiagramToolSchema,
});

export const deleteDiagram = tool({
    description: "Delete an entire diagram from the canvas by diagramId.",
    inputSchema: DeleteDiagramToolSchema,
});

export const getCanvasState = tool({
    description:
        "Read the diagrams currently on the canvas as specs (including edits the user made by hand). " +
        "Call this before editing when you don't already know the current spec from this conversation.",
    inputSchema: z.object({}),
});

export const clearCanvas = tool({
    description:
        "Remove everything from the canvas. Only use when the user explicitly asks.",
    inputSchema: z.object({}),
});
