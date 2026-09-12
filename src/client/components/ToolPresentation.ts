export type ToolPresentation = {
    title: string;
    description: string;
    icon: string;
    destructive?: boolean;
};

export const TOOL_PRESENTATION: Record<string, ToolPresentation> = {
    drawElements: {
        title: "Draw elements",
        description: "Add new shapes and connections to the canvas.",
        icon: "+",
    },
    modifyElements: {
        title: "Update elements",
        description: "Apply the requested changes to the canvas.",
        icon: "↻",
    },
    deleteElements: {
        title: "Delete elements",
        description: "Remove selected elements and their connections.",
        icon: "−",
        destructive: true,
    },
    clearCanvas: {
        title: "Clear the canvas",
        description: "Remove every element from the current canvas.",
        icon: "!",
        destructive: true,
    },
    getCanvasState: {
        title: "Read the canvas",
        description: "Inspect the current elements to understand the diagram.",
        icon: "◇",
    },
    webSearchTool: {
        title: "Search the web",
        description: "Send this query to the web search provider.",
        icon: "↗",
    },
    knowledgeSearchTool: {
        title: "Search the knowledge base",
        description: "Look for relevant information in the connected documents.",
        icon: "⌕",
    },
    drawDiagramUsingMermaid: {
        title: "Draw Mermaid Diagram",
        description: "Converting Mermaid syntax to diagram",
        icon: "📊",
    },
};

export function getToolPresentation(toolName: string): ToolPresentation {
    return (
        TOOL_PRESENTATION[toolName] ?? {
            title: humanizeToolName(toolName),
            description: "Allow the assistant to perform this action.",
            icon: "◇",
        }
    );
}

export function humanizeToolName(value: string) {
    const words = value.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/Tool$/, "");
    return words.charAt(0).toUpperCase() + words.slice(1);
}

export function getToolDetail(
    toolName: string,
    input: Record<string, unknown> | undefined,
) {
    if (!input) return null;

    if (typeof input.query === "string") {
        return `“${input.query}”`;
    }

    if (Array.isArray(input.elements)) {
        const count = input.elements.length;
        return `${count} element${count === 1 ? "" : "s"}`;
    }

    if (toolName === "clearCanvas") {
        return "This action cannot be undone from the chat.";
    }

    return null;
}

export function getCompletedToolText(
    toolName: string,
    fallbackTitle: string,
    input: Record<string, unknown> | undefined,
) {
    const count = Array.isArray(input?.elements) ? input.elements.length : null;

    if (count !== null) {
        const noun = count === 1 ? "element" : "elements";
        if (toolName === "drawElements") return `Added ${count} ${noun}`;
        if (toolName === "modifyElements") return `Updated ${count} ${noun}`;
        if (toolName === "deleteElements") return `Removed ${count} ${noun}`;
    }

    if (toolName === "clearCanvas") return "Cleared canvas";
    if (toolName === "getCanvasState") return "Read canvas state";
    return `${fallbackTitle} completed`;
}
