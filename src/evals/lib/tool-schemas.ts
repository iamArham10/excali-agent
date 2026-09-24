import { z } from "zod";
import {
    CreateDiagramToolSchema,
    DeleteDiagramToolSchema,
    UpdateDiagramToolSchema,
} from "../../shared/schemas/diagram-schema";
import { TOOL_NAMES } from "../../shared/tool-names";

const emptyInputSchema = z.object({}).strict();

export const evalToolSchemas: Record<string, z.ZodType> = {
    [TOOL_NAMES.CREATE_DIAGRAM]: CreateDiagramToolSchema,
    [TOOL_NAMES.UPDATE_DIAGRAM]: UpdateDiagramToolSchema,
    [TOOL_NAMES.DELETE_DIAGRAM]: DeleteDiagramToolSchema,
    [TOOL_NAMES.CLEAR_CANVAS]: emptyInputSchema,
    [TOOL_NAMES.GET_CANVAS_STATE]: emptyInputSchema,
    [TOOL_NAMES.WEB_SEARCH]: z.object({
        query: z.string().min(1),
        maxResults: z.number().int().min(1).max(10).optional(),
    }),
    [TOOL_NAMES.KNOWLEDGE_SEARCH]: z.object({
        query: z.string().min(1),
        topK: z.number().int().min(1).max(10).optional(),
    }),
};
