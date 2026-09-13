import { evalToolSchemas } from "../lib/tool-schemas";
import { ratio, type ScoreResult } from "../lib/score";
import type { EvalScorerArgs } from "../types";

export function schemaScorer({ output }: EvalScorerArgs): ScoreResult {
    const issues: string[] = [];
    let valid = 0;

    for (const [index, call] of output.toolCalls.entries()) {
        const schema = evalToolSchemas[call.toolName];
        if (!schema) {
            issues.push(`call ${index + 1}: unknown tool '${call.toolName}'`);
            continue;
        }

        const result = schema.safeParse(call.input);
        if (result.success) {
            valid++;
        } else {
            issues.push(
                `call ${index + 1} (${call.toolName}): ${result.error.issues
                    .map((issue) => `${issue.path.join(".") || "input"}: ${issue.message}`)
                    .join("; ")}`,
            );
        }
    }

    return {
        name: "tool-schema-validity",
        score: ratio(valid, output.toolCalls.length),
        metadata: { callCount: output.toolCalls.length, validCalls: valid, issues },
    };
}
