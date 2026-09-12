import type { ExcalidrawElementSkeleton } from "@excalidraw/excalidraw/data/transform";
import type { ExcaliDrawService } from "../services/excalidrawService";
import { serializeCanvasState } from "../services/serializeCanvasState";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

export function useToolDispatcher(
    service: ExcaliDrawService,
    api: ExcalidrawImperativeAPI | null
) {
    const executeTool = async ({
        toolCall,
        addToolOutput,
    }: {
        toolCall: any;
        addToolOutput: (output: { toolCallId: string; output: string }) => void;
    }) => {
        if (toolCall.toolName === "drawDiagramUsingMermaid") {
            const { mermaidString } = toolCall.input as {
                mermaidString: string;
            };

            if (await service.drawMermaidDiagram(mermaidString)) {
                addToolOutput({
                    toolCallId: toolCall.toolCallId,
                    output: `Diagram drawn successfully`,
                });
            } else {
                addToolOutput({
                    toolCallId: toolCall.toolCallId,
                    output: `Error, diagram was not drawn successfully`,
                });
            }
        }

        if (toolCall.toolName === "clearCanvas") {
            addToolOutput({
                toolCallId: toolCall.toolCallId,
                output: `${service.clearCanvas() ? "Canvas Cleared" : "Could not clear the canvas"}`,
            });
        }

        if (toolCall.toolName === "getCanvasState") {
            addToolOutput({
                toolCallId: toolCall.toolCallId,
                output: `${api ? serializeCanvasState(service.getCanvasState()) : "canvas is empty"}`,
            });
        }

        if (toolCall.toolName === "drawElements") {
            const { elements } = toolCall.input as {
                elements: ExcalidrawElementSkeleton[];
            };
            service.createElements(elements);

            addToolOutput({
                toolCallId: toolCall.toolCallId,
                output: `created ${elements.length} new elements`,
            });
        }

        if (toolCall.toolName === "deleteElements") {
            const { elements } = toolCall.input as {
                elements: { id: string }[];
            };

            service.deleteElements(elements);

            addToolOutput({
                toolCallId: toolCall.toolCallId,
                output: `deleted ${elements.length} new elements`,
            });
        }

        if (toolCall.toolName === "modifyElements") {
            let elements = (
                toolCall.input as {
                    elements: ({
                        id: string;
                        label?: {
                            text?: string;
                            fontSize?: number;
                            fontFamily?: number;
                            textAlign?: "left" | "center" | "right";
                            verticalAlign?: "top" | "middle" | "bottom";
                        };
                    } & Partial<ExcalidrawElementSkeleton>)[];
                }
            ).elements;

            service.modifyElements(elements);

            addToolOutput({
                toolCallId: toolCall.toolCallId,
                output: `modified ${elements.length} new elements`,
            });
        }
    };

    return executeTool;
}
