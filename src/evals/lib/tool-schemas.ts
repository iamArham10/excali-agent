import { z } from "zod";
import {
    DeleteElementsToolSchema,
    DrawElementsToolSchema,
    ModifyElementsToolSchema,
} from "../../shared/schemas/excali-schema";
import { TOOL_NAMES } from "../../shared/tool-names";

const emptyInputSchema = z.object({}).strict();

export const evalToolSchemas: Record<string, z.ZodType> = {
    [TOOL_NAMES.DRAW_ELEMENTS]: DrawElementsToolSchema,
    [TOOL_NAMES.MODIFY_ELEMENTS]: ModifyElementsToolSchema,
    [TOOL_NAMES.DELETE_ELEMENTS]: DeleteElementsToolSchema,
    [TOOL_NAMES.CLEAR_CANVAS]: emptyInputSchema,
    [TOOL_NAMES.GET_CANVAS_STATE]: emptyInputSchema,
    [TOOL_NAMES.DRAW_DIAGRAM_USING_MERMAID]: z.object({
        mermaidString: z.string().min(1),
    }),
    [TOOL_NAMES.WEB_SEARCH]: z.object({
        query: z.string().min(1),
        maxResults: z.number().int().min(1).max(10).optional(),
    }),
    [TOOL_NAMES.KNOWLEDGE_SEARCH]: z.object({
        query: z.string().min(1),
        topK: z.number().int().min(1).max(10).optional(),
    }),
};
