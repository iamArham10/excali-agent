// tools/web-search.ts
import { tool } from "ai";
import { z } from "zod";
import { tavily } from "@tavily/core";

const tavilyClient = tavily({ apiKey: process.env.TAVILY_API_KEY! });

export const webSearchTool = tool({
    description:
        "Use web-search for current information. Use this when the user asks about recent technology, frameworks, services or systems where you may not have the current knowledge",
    inputSchema: z.object({
        query: z.string().describe("The search query"),
        maxResults: z.number().min(1).max(10).optional().default(5),
    }),
    execute: async ({ query, maxResults }) => {
        try {
            const result = await tavilyClient.search(query, {
                maxResults: maxResults ?? 5,
                includeAnswer: true,
                searchDepth: "advanced",
            });

            return {
                answer: result.answer ?? null,
                results: result.results.map((r) => ({
                    title: r.title,
                    url: r.url,
                    content: r.content,
                })),
            };
        } catch (err) {
            console.error("Tavily search failed:", err);
            return { answer: null, results: [], error: "Search failed" };
        }
    },
});
