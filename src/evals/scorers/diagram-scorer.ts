import { TOOL_NAMES } from "../../shared/tool-names";
import {
    describeConnection,
    describeMatcher,
    getCalls,
    getCreatedSpec,
    getSpecItems,
    hasConnection,
    hasItemLabeled,
    matchesLabel,
    unmatchedMessages,
} from "../lib/elements";
import { ratio, type ScoreResult } from "../lib/score";
import type { EvalScorerArgs } from "../types";

const NAME = "diagram-semantics";

export function diagramScorer({
    output,
    expected,
}: EvalScorerArgs): ScoreResult {
    const specification = expected.diagram;
    if (!specification) {
        return { name: NAME, score: 1, metadata: { skipped: true } };
    }

    const parsed = getCreatedSpec(output);
    if (!parsed) {
        return {
            name: NAME,
            score: 0,
            metadata: { issues: ["createDiagram was not called"] },
        };
    }
    // A spec that fails the schema or semantic validation is rejected by the
    // canvas, so nothing would be drawn.
    if (!parsed.ok || parsed.errors.length > 0) {
        return {
            name: NAME,
            score: 0,
            metadata: { issues: ["diagram spec is invalid", ...parsed.errors] },
        };
    }

    const { spec, warnings } = parsed;
    const checks: boolean[] = [];
    const issues: string[] = [];
    const check = (passed: boolean, issue: string) => {
        checks.push(passed);
        if (!passed) issues.push(issue);
    };

    const createCalls = getCalls(output, TOOL_NAMES.CREATE_DIAGRAM).length;
    const destructive = output.toolCalls.filter((call) =>
        [
            TOOL_NAMES.DELETE_DIAGRAM,
            TOOL_NAMES.CLEAR_CANVAS,
            TOOL_NAMES.UPDATE_DIAGRAM,
        ].includes(call.toolName as never),
    );
    check(
        createCalls === 1 && destructive.length === 0,
        `diagram should be built in a single createDiagram call (got ${createCalls} createDiagram, ${destructive.map((call) => call.toolName).join(", ") || "no"} other mutations)`,
    );

    check(
        spec.type === specification.diagramType,
        `expected a ${specification.diagramType} diagram, got ${spec.type}`,
    );

    if (specification.direction) {
        const direction =
            spec.type === "sequence"
                ? undefined
                : (spec.direction ??
                  (spec.type === "architecture" ? "LR" : "TB"));
        check(
            direction === specification.direction,
            `expected direction ${specification.direction}, got ${direction ?? "none"}`,
        );
    }

    const items = getSpecItems(spec);
    for (const node of specification.nodes) {
        const matches =
            spec.type === "sequence"
                ? []
                : spec.nodes.filter((candidate) =>
                      matchesLabel(candidate.label, node.label),
                  );
        const passed =
            matches.length > 0 &&
            (node.kind === undefined ||
                matches.some(
                    (candidate) =>
                        (candidate.kind ??
                            (spec.type === "flowchart"
                                ? "process"
                                : "service")) === node.kind,
                ));
        check(
            passed,
            `missing node '${describeMatcher(node.label)}'${node.kind ? ` of kind ${node.kind}` : ""}`,
        );
    }

    for (const connection of specification.connections) {
        check(
            hasConnection(spec, connection),
            `missing connection ${describeConnection(connection)}${connection.style ? ` (${connection.style})` : ""}`,
        );
    }

    for (const group of specification.groups) {
        if (spec.type !== "architecture") {
            check(
                false,
                `expected group '${describeMatcher(group.label)}' but diagram is ${spec.type}`,
            );
            continue;
        }
        const groups = spec.groups ?? [];
        const byId = new Map(groups.map((g) => [g.id, g]));
        const candidates = groups.filter((g) =>
            matchesLabel(g.label, group.label),
        );
        check(
            candidates.length > 0,
            `missing group '${describeMatcher(group.label)}'`,
        );
        if (candidates.length === 0) continue;

        const candidateIds = new Set(candidates.map((g) => g.id));
        const isInside = (groupId: string | undefined) => {
            const seen = new Set<string>();
            while (groupId && !seen.has(groupId)) {
                if (candidateIds.has(groupId)) return true;
                seen.add(groupId);
                groupId = byId.get(groupId)?.parent;
            }
            return false;
        };

        for (const member of group.contains) {
            check(
                spec.nodes.some(
                    (node) =>
                        matchesLabel(node.label, member) &&
                        isInside(node.group),
                ),
                `group '${describeMatcher(group.label)}' should contain '${describeMatcher(member)}'`,
            );
        }
        if (group.parent !== undefined) {
            const parentMatcher = group.parent;
            check(
                candidates.some((g) => {
                    const parent = g.parent ? byId.get(g.parent) : undefined;
                    return (
                        parent !== undefined &&
                        matchesLabel(parent.label, parentMatcher)
                    );
                }),
                `group '${describeMatcher(group.label)}' should be nested in '${describeMatcher(parentMatcher)}'`,
            );
        }
    }

    for (const participant of specification.participants) {
        check(
            spec.type === "sequence" && hasItemLabeled(spec, participant),
            `missing participant '${describeMatcher(participant)}'`,
        );
    }

    if (specification.messages.length > 0) {
        const missing = unmatchedMessages(spec, specification.messages);
        for (const message of specification.messages) {
            check(
                !missing.includes(message),
                `missing or out-of-order message ${describeConnection(message)}${message.kind ? ` (${message.kind})` : ""}`,
            );
        }
    }

    if (specification.maxNodes !== undefined) {
        check(
            items.length <= specification.maxNodes,
            `diagram has ${items.length} nodes; expected at most ${specification.maxNodes}`,
        );
    }

    if (specification.forbidWarnings) {
        check(
            warnings.length === 0,
            `validation warnings: ${warnings.join("; ")}`,
        );
    }

    return {
        name: NAME,
        score: ratio(checks.filter(Boolean).length, checks.length),
        metadata: {
            diagramType: spec.type,
            nodeCount: items.length,
            warnings,
            issues,
        },
    };
}
