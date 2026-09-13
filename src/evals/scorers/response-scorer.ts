import { ratio, type ScoreResult } from "../lib/score";
import type { EvalScorerArgs } from "../types";

export function responseScorer({ output, expected }: EvalScorerArgs): ScoreResult {
    const specification = expected.response;
    if (!specification) {
        return { name: "response-quality", score: 1, metadata: { skipped: true } };
    }

    const normalized = output.text.toLocaleLowerCase();
    const wordCount = output.text.trim() === "" ? 0 : output.text.trim().split(/\s+/).length;
    const checks = [wordCount <= specification.maxWords];
    const issues: string[] = [];

    if (wordCount > specification.maxWords) {
        issues.push(`response has ${wordCount} words; maximum is ${specification.maxWords}`);
    }

    for (const phrase of specification.requiredPhrases) {
        const passed = normalized.includes(phrase.toLocaleLowerCase());
        checks.push(passed);
        if (!passed) issues.push(`missing phrase: '${phrase}'`);
    }
    for (const phrase of specification.forbiddenPhrases) {
        const passed = !normalized.includes(phrase.toLocaleLowerCase());
        checks.push(passed);
        if (!passed) issues.push(`contains forbidden phrase: '${phrase}'`);
    }

    return {
        name: "response-quality",
        score: ratio(checks.filter(Boolean).length, checks.length),
        metadata: { wordCount, issues },
    };
}
