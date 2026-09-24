export const TOOL_NAMES = {
    CREATE_DIAGRAM: "createDiagram",
    UPDATE_DIAGRAM: "updateDiagram",
    DELETE_DIAGRAM: "deleteDiagram",
    CLEAR_CANVAS: "clearCanvas",
    GET_CANVAS_STATE: "getCanvasState",
    WEB_SEARCH: "webSearchTool",
    KNOWLEDGE_SEARCH: "knowledgeSearchTool",
} as const;

export type ToolName = (typeof TOOL_NAMES)[keyof typeof TOOL_NAMES];
