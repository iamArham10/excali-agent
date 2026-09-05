import { tool } from "ai";
import { z } from "zod";
import { vectorIndex } from "./vector-client";

export const knowledgeSearchTool = tool({
    description:
        "Search the ingested knowledge base for relevant context before answering questions about the codebase, docs, or domain-specific information.",
    inputSchema: z.object({
        query: z.string().describe("What to search for"),
        topK: z
            .number()
            .min(1)
            .max(10)
            .optional()
            .default(4)
            .describe("How many related results you want, ranked by familiarity with given query."),
    }),
    execute: async ({ query, topK }) => {
        try {
            const results = await vectorIndex.query({
                data: query,
                topK: topK ?? 4,
                includeMetadata: true,
            });

            return results.map((r) => ({
                source: r.metadata?.source,
                text: r.metadata?.text,
                score: r.score,
            }));
        } catch (err) {
            console.error("Vector search failed:", err);
            return { error: "Knowledge search failed" };
        }
    },
});
