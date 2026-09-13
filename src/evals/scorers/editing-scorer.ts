import { containsRequired, getCalls, getElements } from "../lib/elements";
import { ratio, type ScoreResult } from "../lib/score";
import type { EvalScorerArgs } from "../types";

export function editingScorer({ output, expected }: EvalScorerArgs): ScoreResult {
    const specification = expected.editing;
    if (!specification) {
        return { name: "stateful-editing", score: 1, metadata: { skipped: true } };
    }

    const checks: boolean[] = [];
    const issues: string[] = [];
    const modified = getCalls(output, "modifyElements").flatMap(getElements);
    const deleted = getCalls(output, "deleteElements")
        .flatMap(getElements)
        .map((element) => element.id)
        .filter((id): id is string => typeof id === "string");
    const toolNames = output.toolCalls.map((call) => call.toolName);

    if (specification.readCanvasFirst) {
        const readIndex = toolNames.indexOf("getCanvasState");
        const firstMutation = toolNames.findIndex((tool) =>
            ["modifyElements", "deleteElements", "clearCanvas"].includes(tool),
        );
        const passed = readIndex >= 0 && (firstMutation < 0 || readIndex < firstMutation);
        checks.push(passed);
        if (!passed) issues.push("canvas was not read before mutation");
    }

    for (const mutation of specification.mutations) {
        const passed = modified.some(
            (element) =>
                element.id === mutation.id &&
                element.type === mutation.type &&
                containsRequired(element, mutation.changes),
        );
        checks.push(passed);
        if (!passed) issues.push(`missing expected mutation for '${mutation.id}'`);
    }

    for (const id of specification.deletedIds) {
        const passed = deleted.includes(id);
        checks.push(passed);
        if (!passed) issues.push(`missing deletion for '${id}'`);
    }

    if (specification.clearCanvas) {
        const passed = toolNames.includes("clearCanvas");
        checks.push(passed);
        if (!passed) issues.push("clearCanvas was not called");
    }

    for (const id of specification.untouchedIds) {
        const passed =
            !modified.some((element) => element.id === id) && !deleted.includes(id);
        checks.push(passed);
        if (!passed) issues.push(`unrelated element '${id}' was changed`);
    }

    return {
        name: "stateful-editing",
        score: ratio(checks.filter(Boolean).length, checks.length),
        metadata: { issues },
    };
}
