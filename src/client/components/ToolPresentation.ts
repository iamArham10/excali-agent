import type { IconName } from "./Icons";

export type ToolPresentation = {
    title: string;
    description: string;
    icon: IconName;
    destructive?: boolean;
    /** Shown while the tool input streams in / while it runs. */
    runningText: string;
};

export const TOOL_PRESENTATION: Record<string, ToolPresentation> = {
    createDiagram: {
        title: "Create diagram",
        description: "Lay out and draw a new diagram on the canvas.",
        icon: "diagram",
        runningText: "Drawing diagram",
    },
    updateDiagram: {
        title: "Update diagram",
        description: "Apply the requested changes to an existing diagram.",
        icon: "update",
        runningText: "Updating diagram",
    },
    deleteDiagram: {
        title: "Delete diagram",
        description: "Remove an entire diagram from the canvas.",
        icon: "trash",
        destructive: true,
        runningText: "Deleting diagram",
    },
    clearCanvas: {
        title: "Clear the canvas",
        description:
            "Remove every element from the current canvas. This can be undone with Ctrl+Z.",
        icon: "eraser",
        destructive: true,
        runningText: "Clearing canvas",
    },
    getCanvasState: {
        title: "Read canvas",
        description: "Inspect the diagrams currently on the canvas.",
        icon: "eye",
        runningText: "Reading canvas",
    },
    webSearchTool: {
        title: "Search the web",
        description: "Send this query to the web search provider.",
        icon: "globe",
        runningText: "Searching the web",
    },
    knowledgeSearchTool: {
        title: "Search knowledge base",
        description:
            "Look for relevant information in the connected documents.",
        icon: "book",
        runningText: "Searching knowledge base",
    },
};

export function getToolPresentation(toolName: string): ToolPresentation {
    return (
        TOOL_PRESENTATION[toolName] ?? {
            title: humanizeToolName(toolName),
            description: "Allow the assistant to perform this action.",
            icon: "sparkle",
            runningText: humanizeToolName(toolName),
        }
    );
}

export function humanizeToolName(value: string) {
    const words = value
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .replace(/ Tool$/, "");
    return words.charAt(0).toUpperCase() + words.slice(1).toLowerCase();
}

// ---------------------------------------------------------------------------
// Input / output interpretation
// ---------------------------------------------------------------------------

export type DiagramSummary = {
    type: string;
    diagramId: string;
    title?: string;
    labels: string[];
    counts: string[];
};

export function getDiagramSummary(input: unknown): DiagramSummary | null {
    if (!input || typeof input !== "object") return null;
    const diagram = (input as { diagram?: unknown }).diagram;
    if (!diagram || typeof diagram !== "object") return null;
    const d = diagram as Record<string, unknown>;
    const list = (key: string) =>
        Array.isArray(d[key]) ? (d[key] as Record<string, unknown>[]) : [];
    const plural = (n: number, noun: string) =>
        `${n} ${noun}${n === 1 ? "" : "s"}`;

    const isSequence = d.type === "sequence";
    const items = isSequence ? list("participants") : list("nodes");
    const counts = isSequence
        ? [
              plural(items.length, "participant"),
              plural(list("messages").length, "message"),
          ]
        : [
              plural(
                  items.length,
                  d.type === "er"
                      ? "entity"
                      : d.type === "class"
                        ? "class"
                        : "node",
              ),
              plural(
                  list("edges").length,
                  d.type === "er" || d.type === "class"
                      ? "relationship"
                      : "edge",
              ),
              ...(list("groups").length
                  ? [plural(list("groups").length, "group")]
                  : []),
          ];

    return {
        type: typeof d.type === "string" ? d.type : "diagram",
        diagramId: typeof d.diagramId === "string" ? d.diagramId : "",
        title: typeof d.title === "string" ? d.title : undefined,
        labels: items
            .map((item) => {
                if (typeof item?.label !== "string") return "";
                // For rich multi-line labels (ER/Class), extract the main name on line 1
                const firstLine = item.label.split("\n")[0].trim();
                return firstLine.replace(/\\n/g, " ");
            })
            .filter(Boolean),
        counts,
    };
}

export type ToolReport = {
    ok: boolean;
    message?: string;
    warnings: string[];
    errors: string[];
};

/** Client tools answer with a JSON ToolReport string (or plain text). */
export function parseToolReport(output: unknown): ToolReport | null {
    let value = output;
    if (typeof value === "string") {
        try {
            value = JSON.parse(value);
        } catch {
            return null;
        }
    }
    if (!value || typeof value !== "object" || !("ok" in value)) return null;
    const report = value as Record<string, unknown>;
    const strings = (key: string) =>
        Array.isArray(report[key])
            ? (report[key] as unknown[]).map(String)
            : [];
    return {
        ok: report.ok === true,
        message:
            typeof report.message === "string" ? report.message : undefined,
        warnings: strings("warnings"),
        errors: strings("errors"),
    };
}

export type SearchSource = { title: string; url?: string };

export function getSearchSources(output: unknown): SearchSource[] | null {
    if (Array.isArray(output)) {
        return output.map((item: Record<string, unknown>) => ({
            title: String(item?.source ?? "Document"),
        }));
    }
    if (
        output &&
        typeof output === "object" &&
        Array.isArray((output as { results?: unknown }).results)
    ) {
        return (output as { results: Record<string, unknown>[] }).results.map(
            (result) => ({
                title: String(result.title ?? result.url ?? "Result"),
                url: typeof result.url === "string" ? result.url : undefined,
            }),
        );
    }
    return null;
}

export function getToolDetail(input: Record<string, unknown> | undefined) {
    if (!input) return null;
    if (typeof input.query === "string") return `“${input.query}”`;
    const diagram = getDiagramSummary(input);
    if (diagram) return `${diagram.type} · ${diagram.diagramId}`;
    if (typeof input.diagramId === "string") return input.diagramId;
    return null;
}
