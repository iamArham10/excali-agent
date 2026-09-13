import { ratio, type ScoreResult } from "../lib/score";
import type { EvalScorerArgs } from "../types";

export function routingScorer({ output, expected }: EvalScorerArgs): ScoreResult {
    const actual = output.toolCalls.map((call) => call.toolName);
    const { requiredTools, forbiddenTools, orderedTools, allowAdditionalTools } =
        expected.routing;
    const checks: boolean[] = [];
    const issues: string[] = [];

    for (const tool of requiredTools) {
        const passed = actual.includes(tool);
        checks.push(passed);
        if (!passed) issues.push(`missing required tool: ${tool}`);
    }

    for (const tool of forbiddenTools) {
        const passed = !actual.includes(tool);
        checks.push(passed);
        if (!passed) issues.push(`called forbidden tool: ${tool}`);
    }

    if (!allowAdditionalTools) {
        const unexpected = actual.filter((tool) => !requiredTools.includes(tool as never));
        checks.push(unexpected.length === 0);
        if (unexpected.length > 0) {
            issues.push(`unexpected tools: ${[...new Set(unexpected)].join(", ")}`);
        }
    }

    if (orderedTools) {
        let cursor = -1;
        const inOrder = orderedTools.every((tool) => {
            cursor = actual.indexOf(tool, cursor + 1);
            return cursor >= 0;
        });
        checks.push(inOrder);
        if (!inOrder) issues.push(`expected order: ${orderedTools.join(" -> ")}`);
    }

    return {
        name: "routing",
        score: ratio(checks.filter(Boolean).length, checks.length),
        metadata: { actualTools: actual, issues },
    };
}
