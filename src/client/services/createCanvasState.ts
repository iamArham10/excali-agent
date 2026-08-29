import { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import { encode } from "@toon-format/toon"

export function serializeCanvasState(elements: ExcalidrawElement[]): string {
    if (!elements.length) return "canvas is empty";

    const rows = elements.map((e) => {
        const row: Record<string, unknown> = {
            id: e.id,
            type: e.type,
            x: Math.round(e.x),
            y: Math.round(e.y),
            w: Math.round(e.width),
            h: Math.round(e.height),
        };

        if (e.type === "text") {
            row.label = e.text;
            if (e.containerId) row.containerId = e.containerId;
        }

        if (e.type === "arrow") {
            row.from = e.startBinding?.elementId ?? "";
            row.to = e.endBinding?.elementId ?? "";
        }

        return row;
    });

    return encode(
        { elements: rows },
        {
            indentSize: 2,
            delimiter: ",",
        },
    );
}
