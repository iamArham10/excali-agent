import { getCalls, isRecord } from "../lib/elements";
import { ratio, type ScoreResult } from "../lib/score";
import type { EvalScorerArgs } from "../types";

export function researchScorer({ output, expected }: EvalScorerArgs): ScoreResult {
    const specification = expected.research;
    if (!specification) {
        return { name: "research-query", score: 1, metadata: { skipped: true } };
    }

    const calls = [
        ...getCalls(output, "webSearchTool"),
        ...getCalls(output, "knowledgeSearchTool"),
    ];
    if (calls.length === 0) {
        return {
            name: "research-query",
            score: 0,
            metadata: { issues: ["no research tool called"] },
        };
    }

    const input = isRecord(calls[0].input) ? calls[0].input : {};
    const query = typeof input.query === "string" ? input.query.toLocaleLowerCase() : "";
    const checks: boolean[] = [];
    const issues: string[] = [];

    for (const term of specification.queryIncludes) {
        const passed = query.includes(term.toLocaleLowerCase());
        checks.push(passed);
        if (!passed) issues.push(`query does not include '${term}'`);
    }

    if (specification.resultLimit) {
        const limit =
            typeof input.maxResults === "number"
                ? input.maxResults
                : typeof input.topK === "number"
                  ? input.topK
                  : undefined;
        const passed =
            limit !== undefined &&
            limit >= specification.resultLimit.min &&
            limit <= specification.resultLimit.max;
        checks.push(passed);
        if (!passed) issues.push("result limit is missing or outside the expected range");
    }

    return {
        name: "research-query",
        score: ratio(checks.filter(Boolean).length, checks.length),
        metadata: { query, issues },
    };
}
