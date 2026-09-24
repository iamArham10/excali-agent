import { TOOL_NAMES } from "../../shared/tool-names";
import {
    describeConnection,
    describeMatcher,
    getCalls,
    getSpecItems,
    getUpdatedSpec,
    hasConnection,
    hasItemLabeled,
    isRecord,
    matchesLabel,
    unmatchedMessages,
} from "../lib/elements";
import { ratio, type ScoreResult } from "../lib/score";
import type { EvalScorerArgs } from "../types";

const NAME = "stateful-editing";

export function editingScorer({
    input,
    output,
    expected,
}: EvalScorerArgs): ScoreResult {
    const specification = expected.editing;
    if (!specification) {
        return { name: NAME, score: 1, metadata: { skipped: true } };
    }

    const seed = input.seed?.diagram;
    const diagramId = specification.diagramId ?? seed?.diagramId;
    const checks: boolean[] = [];
    const issues: string[] = [];
    const check = (passed: boolean, issue: string) => {
        checks.push(passed);
        if (!passed) issues.push(issue);
    };

    const creates = getCalls(output, TOOL_NAMES.CREATE_DIAGRAM);
    const updates = getCalls(output, TOOL_NAMES.UPDATE_DIAGRAM);
    const deletes = getCalls(output, TOOL_NAMES.DELETE_DIAGRAM);
    const clears = getCalls(output, TOOL_NAMES.CLEAR_CANVAS);
    const deletedIds = deletes.map((call) =>
        isRecord(call.input) ? call.input.diagramId : undefined,
    );

    if (specification.action === "clear") {
        check(clears.length > 0, "clearCanvas was not called");
        check(
            deletes.length === 0,
            "deleted diagrams individually instead of clearing the canvas",
        );
        check(
            creates.length + updates.length === 0,
            "canvas was modified instead of cleared",
        );
        return finish();
    }

    if (specification.action === "delete") {
        check(
            deletedIds.includes(diagramId),
            `deleteDiagram was not called for '${diagramId}'`,
        );
        check(
            clears.length === 0,
            "clearCanvas was called when only one diagram should be deleted",
        );
        check(
            creates.length + updates.length === 0,
            "diagram was modified instead of deleted",
        );
        return finish();
    }

    // action === "update": one in-place updateDiagram on the same diagramId.
    check(
        deletes.length === 0 && clears.length === 0,
        "used deleteDiagram/clearCanvas for an edit; expected updateDiagram",
    );
    check(
        creates.length === 0,
        "recreated the diagram with createDiagram instead of updating it",
    );

    const updateCall = updates.at(-1);
    if (!updateCall) {
        check(false, "updateDiagram was not called");
        return finish();
    }

    const parsed = getUpdatedSpec(output)!;
    if (!parsed.ok || parsed.errors.length > 0) {
        check(false, `updated spec is invalid: ${parsed.errors.join("; ")}`);
        return finish();
    }
    const spec = parsed.spec;

    check(
        spec.diagramId === diagramId,
        `expected diagramId '${diagramId}' to be reused, got '${spec.diagramId}'`,
    );
    if (seed) {
        check(
            spec.type === seed.type,
            `diagram type changed from ${seed.type} to ${spec.type}`,
        );
    }

    const relayout =
        isRecord(updateCall.input) && updateCall.input.relayout === true;
    check(
        relayout === specification.relayout,
        specification.relayout
            ? "expected relayout: true for a layout tidy-up"
            : "relayout: true discards the user's node positions; it was not requested",
    );

    for (const label of specification.nodesPresent) {
        check(
            hasItemLabeled(spec, label),
            `missing node '${describeMatcher(label)}' after update`,
        );
    }
    for (const label of specification.nodesAbsent) {
        check(
            !hasItemLabeled(spec, label),
            `node '${describeMatcher(label)}' should have been removed`,
        );
    }

    const items = new Map(getSpecItems(spec).map((item) => [item.id, item]));
    const seedItems = new Map(
        seed ? getSpecItems(seed).map((item) => [item.id, item]) : [],
    );
    for (const id of specification.preservedIds) {
        const before = seedItems.get(id);
        const after = items.get(id);
        check(
            after !== undefined &&
                (before === undefined || after.label === before.label),
            after === undefined
                ? `untouched node '${id}' was removed or its id changed`
                : `untouched node '${id}' label changed from '${before?.label}' to '${after.label}'`,
        );
    }

    for (const change of specification.changedNodes) {
        const after = items.get(change.id);
        if (!after) {
            check(false, `node '${change.id}' is missing; its id must be kept`);
            continue;
        }
        if (change.label !== undefined) {
            check(
                matchesLabel(after.label, change.label),
                `node '${change.id}' label is '${after.label}', expected '${describeMatcher(change.label)}'`,
            );
        }
        if (change.kind !== undefined) {
            check(
                after.kind === change.kind,
                `node '${change.id}' kind is '${after.kind ?? "default"}', expected '${change.kind}'`,
            );
        }
        if (change.color !== undefined) {
            check(
                after.color === change.color,
                `node '${change.id}' color is '${after.color ?? "default"}', expected '${change.color}'`,
            );
        }
    }

    for (const connection of specification.connectionsPresent) {
        check(
            hasConnection(spec, connection),
            `missing connection ${describeConnection(connection)}`,
        );
    }

    if (specification.messages.length > 0) {
        const missing = unmatchedMessages(spec, specification.messages);
        for (const message of specification.messages) {
            check(
                !missing.includes(message),
                `missing or out-of-order message ${describeConnection(message)}`,
            );
        }
    }

    return finish();

    function finish(): ScoreResult {
        return {
            name: NAME,
            score: ratio(checks.filter(Boolean).length, checks.length),
            metadata: { action: specification!.action, diagramId, issues },
        };
    }
}
