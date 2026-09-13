import { getCalls, isRecord } from "../lib/elements";
import { ratio, type ScoreResult } from "../lib/score";
import type { EvalScorerArgs } from "../types";

export function mermaidScorer({ output, expected }: EvalScorerArgs): ScoreResult {
    const specification = expected.mermaid;
    if (!specification) {
        return { name: "mermaid-quality", score: 1, metadata: { skipped: true } };
    }

    const call = getCalls(output, "drawDiagramUsingMermaid")[0];
    const source =
        call && isRecord(call.input) && typeof call.input.mermaidString === "string"
            ? call.input.mermaidString.trim()
            : "";
    if (!source) {
        return {
            name: "mermaid-quality",
            score: 0,
            metadata: { issues: ["no Mermaid source generated"] },
        };
    }

    const normalized = source.toLocaleLowerCase();
    const checks: boolean[] = [];
    const issues: string[] = [];
    const addCheck = (passed: boolean, issue: string) => {
        checks.push(passed);
        if (!passed) issues.push(issue);
    };

    addCheck(/^flowchart\s+(td|tb|bt|rl|lr)\b/i.test(source), "must use flowchart syntax");
    addCheck(!source.includes("```"), "must not include markdown fences");
    addCheck(
        !/^(sequenceDiagram|classDiagram|erDiagram|stateDiagram|gitGraph)\b/im.test(source),
        "contains a non-editable Mermaid diagram type",
    );

    if (specification.direction) {
        addCheck(
            new RegExp(`^flowchart\\s+${specification.direction}\\b`, "i").test(source),
            `expected ${specification.direction} direction`,
        );
    }
    for (const label of specification.labels) {
        addCheck(
            normalized.includes(label.toLocaleLowerCase()),
            `missing label '${label}'`,
        );
    }
    addCheck(
        (source.match(/-->/g) ?? []).length >= specification.edgeCountAtLeast,
        `expected at least ${specification.edgeCountAtLeast} standard arrows`,
    );
    if (specification.requiresSubgraph) {
        addCheck(/\bsubgraph\b/i.test(source) && /\bend\b/i.test(source), "missing subgraph");
    }

    return {
        name: "mermaid-quality",
        score: ratio(checks.filter(Boolean).length, checks.length),
        metadata: { issues },
    };
}
