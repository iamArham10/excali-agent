import {
    getDrawnElements,
    getLabel,
    isRecord,
    normalizeText,
} from "../lib/elements";
import { clampScore, ratio, type ScoreResult } from "../lib/score";
import type { EvalScorerArgs } from "../types";

export function diagramScorer({
    output,
    expected,
}: EvalScorerArgs): ScoreResult {
    const specification = expected.diagram;
    if (!specification) {
        return {
            name: "diagram-semantics",
            score: 1,
            metadata: { skipped: true },
        };
    }

    const elements = getDrawnElements(output);
    if (elements.length === 0) {
        return {
            name: "diagram-semantics",
            score: 0,
            metadata: { issues: ["no elements were drawn"] },
        };
    }

    const nodes = elements.filter((element) =>
        ["rectangle", "ellipse", "diamond", "text"].includes(
            String(element.type),
        ),
    );
    const idsToLabels = new Map<string, string>();
    for (const node of nodes) {
        if (typeof node.id === "string" && getLabel(node)) {
            idsToLabels.set(node.id, normalizeText(getLabel(node)!));
        }
    }

    const nodeScores: number[] = [];
    const issues: string[] = [];
    for (const expectedNode of specification.nodes) {
        const count = nodes.filter(
            (node) =>
                node.type === expectedNode.type &&
                getLabel(node) !== undefined &&
                normalizeText(getLabel(node)!) ===
                    normalizeText(expectedNode.label),
        ).length;
        nodeScores.push(Math.min(1, count / expectedNode.count));
        if (count < expectedNode.count) {
            issues.push(
                `expected ${expectedNode.count} ${expectedNode.type} node(s) labeled '${expectedNode.label}', found ${count}`,
            );
        }
    }

    const connectionScores: number[] = [];
    for (const connection of specification.connections) {
        const count = elements.filter((element) => {
            if (
                element.type !== "arrow" ||
                !isRecord(element.start) ||
                !isRecord(element.end)
            ) {
                return false;
            }
            const from =
                typeof element.start.id === "string"
                    ? idsToLabels.get(element.start.id)
                    : undefined;
            const to =
                typeof element.end.id === "string"
                    ? idsToLabels.get(element.end.id)
                    : undefined;
            const labelMatches =
                connection.label === undefined ||
                (getLabel(element) !== undefined &&
                    normalizeText(getLabel(element)!) ===
                        normalizeText(connection.label));
            return (
                from === normalizeText(connection.from) &&
                to === normalizeText(connection.to) &&
                labelMatches
            );
        }).length;
        connectionScores.push(Math.min(1, count / connection.count));
        if (count < connection.count) {
            issues.push(
                `expected ${connection.count} connection(s) ${connection.from} -> ${connection.to}${connection.label ? ` labeled '${connection.label}'` : ""}, found ${count}`,
            );
        }
    }

    const expectedNodeCount = specification.nodes.reduce(
        (sum, node) => sum + node.count,
        0,
    );
    const precision = Math.min(
        1,
        expectedNodeCount / Math.max(1, nodes.length),
    );
    const nodeRecall = ratio(
        nodeScores.reduce((sum, score) => sum + score, 0),
        nodeScores.length,
    );
    const connectionRecall = ratio(
        connectionScores.reduce((sum, score) => sum + score, 0),
        connectionScores.length,
    );
    const connectionWeight = specification.connections.length > 0 ? 0.3 : 0;
    const score =
        nodeRecall * (0.85 - connectionWeight) +
        connectionRecall * connectionWeight +
        precision * 0.15;

    return {
        name: "diagram-semantics",
        score: clampScore(score),
        metadata: { nodeRecall, connectionRecall, precision, issues },
    };
}
