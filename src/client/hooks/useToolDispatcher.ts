import type {
    ExcaliDrawService,
    ToolReport,
} from "../services/excalidrawService";
import type {
    CreateDiagramInput,
    DeleteDiagramInput,
    UpdateDiagramInput,
} from "../../shared/schemas/diagram-schema";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

type ToolCall = { toolName: string; toolCallId: string; input: unknown };

export function useToolDispatcher(
    service: ExcaliDrawService,
    api: ExcalidrawImperativeAPI | null,
) {
    const run = async (
        toolCall: ToolCall,
    ): Promise<string | ToolReport | null> => {
        switch (toolCall.toolName) {
            case "createDiagram": {
                const { diagram } = toolCall.input as CreateDiagramInput;
                return service.createDiagram(diagram);
            }
            case "updateDiagram": {
                const { diagram, relayout } =
                    toolCall.input as UpdateDiagramInput;
                return service.updateDiagram(diagram, relayout);
            }
            case "deleteDiagram": {
                const { diagramId } = toolCall.input as DeleteDiagramInput;
                return service.deleteDiagram(diagramId);
            }
            case "getCanvasState":
                return api ? service.getCanvasState() : "canvas is empty";
            case "clearCanvas":
                service.clearCanvas();
                return "Canvas cleared";
            default:
                return null; // not a client tool
        }
    };

    const executeTool = async ({
        toolCall,
        addToolOutput,
    }: {
        toolCall: ToolCall;
        addToolOutput: (output: { toolCallId: string; output: string }) => void;
    }) => {
        let output: string | ToolReport | null;
        try {
            output = await run(toolCall);
        } catch (error) {
            // Always answer the tool call, otherwise the chat stalls waiting for it.
            console.error(`${toolCall.toolName} crashed`, error);
            output = {
                ok: false,
                message:
                    `${toolCall.toolName} failed with an internal canvas error (not a problem with the spec): ` +
                    `${error instanceof Error ? error.message : String(error)}. ` +
                    "Do not resend the same call; tell the user drawing failed.",
            };
        }
        if (output === null) return;
        addToolOutput({
            toolCallId: toolCall.toolCallId,
            output:
                typeof output === "string" ? output : JSON.stringify(output),
        });
    };

    return executeTool;
}
