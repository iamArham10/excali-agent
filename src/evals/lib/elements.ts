import {
    DiagramSpecSchema,
    type DiagramSpec,
} from "../../shared/schemas/diagram-schema";
import {
    resolveEdges,
    validateDiagramSpec,
} from "../../shared/diagram/validate";
import { TOOL_NAMES } from "../../shared/tool-names";
import type {
    ConnectionExpectation,
    EvalOutput,
    EvalToolCall,
    LabelMatcher,
    MessageExpectation,
} from "../types";

export function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function getCalls(output: EvalOutput, toolName: string): EvalToolCall[] {
    return output.toolCalls.filter((call) => call.toolName === toolName);
}

export function normalizeText(value: string): string {
    return value
        .replace(/\\n|\n/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .toLocaleLowerCase();
}

/** Case-insensitive substring match against one or several accepted labels. */
export function matchesLabel(
    actual: string | undefined,
    matcher: LabelMatcher,
): boolean {
    if (actual === undefined) return false;
    const haystack = normalizeText(actual);
    const needles = Array.isArray(matcher) ? matcher : [matcher];
    return needles.some((needle) => haystack.includes(normalizeText(needle)));
}

export function describeMatcher(matcher: LabelMatcher): string {
    return Array.isArray(matcher) ? matcher.join("|") : matcher;
}

export type ParsedSpec =
    | { ok: true; spec: DiagramSpec; errors: string[]; warnings: string[] }
    | { ok: false; errors: string[] };

/** Parse `input.diagram` of a createDiagram/updateDiagram call and run semantic validation. */
export function parseSpecFromCall(call: EvalToolCall): ParsedSpec {
    const diagram = isRecord(call.input) ? call.input.diagram : undefined;
    const parsed = DiagramSpecSchema.safeParse(diagram);
    if (!parsed.success) {
        return {
            ok: false,
            errors: parsed.error.issues.map(
                (issue) => `diagram.${issue.path.join(".")}: ${issue.message}`,
            ),
        };
    }
    const { errors, warnings } = validateDiagramSpec(parsed.data);
    return { ok: true, spec: parsed.data, errors, warnings };
}

export function getLastCall(
    output: EvalOutput,
    toolName: string,
): EvalToolCall | undefined {
    return getCalls(output, toolName).at(-1);
}

/** The last createDiagram spec emitted by the model, if any. */
export function getCreatedSpec(output: EvalOutput): ParsedSpec | undefined {
    const call = getLastCall(output, TOOL_NAMES.CREATE_DIAGRAM);
    return call ? parseSpecFromCall(call) : undefined;
}

/** The last updateDiagram spec emitted by the model, if any. */
export function getUpdatedSpec(output: EvalOutput): ParsedSpec | undefined {
    const call = getLastCall(output, TOOL_NAMES.UPDATE_DIAGRAM);
    return call ? parseSpecFromCall(call) : undefined;
}

export type SpecItem = {
    id: string;
    label: string;
    kind?: string;
    color?: string;
};

/** Nodes (architecture/flowchart) or participants (sequence). */
export function getSpecItems(spec: DiagramSpec): SpecItem[] {
    return spec.type === "sequence" ? spec.participants : spec.nodes;
}

function idsMatching(spec: DiagramSpec, matcher: LabelMatcher): Set<string> {
    return new Set(
        getSpecItems(spec)
            .filter((item) => matchesLabel(item.label, matcher))
            .map((item) => item.id),
    );
}

export function hasItemLabeled(
    spec: DiagramSpec,
    matcher: LabelMatcher,
): boolean {
    return idsMatching(spec, matcher).size > 0;
}

export function hasConnection(
    spec: DiagramSpec,
    expected: ConnectionExpectation,
): boolean {
    if (spec.type === "sequence") return false;
    const from = idsMatching(spec, expected.from);
    const to = idsMatching(spec, expected.to);
    return resolveEdges(spec).some((edge) => {
        const forward = from.has(edge.from) && to.has(edge.to);
        const reverse =
            edge.arrow === "both" && from.has(edge.to) && to.has(edge.from);
        if (!forward && !reverse) return false;
        if (
            expected.label !== undefined &&
            !matchesLabel(edge.label, expected.label)
        ) {
            return false;
        }
        if (
            expected.style !== undefined &&
            (edge.style ?? "solid") !== expected.style
        ) {
            return false;
        }
        return true;
    });
}

export function describeConnection(
    expected: ConnectionExpectation | MessageExpectation,
): string {
    const label = expected.label ? ` '${describeMatcher(expected.label)}'` : "";
    return `${describeMatcher(expected.from)} -> ${describeMatcher(expected.to)}${label}`;
}

/**
 * Match expected sequence messages as an ordered subsequence of the spec's
 * messages. Returns the expected messages that could not be matched in order.
 */
export function unmatchedMessages(
    spec: DiagramSpec,
    expected: MessageExpectation[],
): MessageExpectation[] {
    if (spec.type !== "sequence") return expected;
    const labels = new Map(spec.participants.map((p) => [p.id, p.label]));
    const missing: MessageExpectation[] = [];
    let cursor = 0;
    for (const want of expected) {
        const index = spec.messages.findIndex(
            (message, i) =>
                i >= cursor &&
                matchesLabel(labels.get(message.from), want.from) &&
                matchesLabel(labels.get(message.to), want.to) &&
                (want.label === undefined ||
                    matchesLabel(message.label, want.label)) &&
                (want.kind === undefined ||
                    (message.kind ?? "sync") === want.kind),
        );
        if (index < 0) missing.push(want);
        else cursor = index + 1;
    }
    return missing;
}
