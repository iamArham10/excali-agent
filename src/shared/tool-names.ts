export const TOOL_NAMES = {
    DRAW_ELEMENTS: 'drawElements',
    MODIFY_ELEMENTS: 'modifyElements',
    DELETE_ELEMENTS: 'deleteElements',
    CLEAR_CANVAS: 'clearCanvas',
    GET_CANVAS_STATE: 'getCanvasState',
    DRAW_DIAGRAM_USING_MERMAID: 'drawDiagramUsingMermaid',
    WEB_SEARCH: 'webSearchTool',
    KNOWLEDGE_SEARCH: 'knowledgeSearchTool',
} as const;

export type ToolName = (typeof TOOL_NAMES)[keyof typeof TOOL_NAMES];
