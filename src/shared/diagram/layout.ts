import ELK from "elkjs/lib/elk.bundled.js";
import type { ElkExtendedEdge, ElkNode } from "elkjs/lib/elk-api";

import type {
    ColorName,
    GraphSpec,
    SequenceSpec,
} from "../schemas/diagram-schema";
import {
    EDGE_FONT_SIZE,
    NODE_FONT_SIZE,
    nodeStyle,
    type NodeStyle,
} from "./theme";
import { lineHeight, measureText, sizeForLabel } from "./text";
import { resolveEdges, type ResolvedEdge } from "./validate";

export type Point = [number, number];
export type Box = { x: number; y: number; width: number; height: number };

export type LaidOutNode = {
    id: string;
    label: string;
    kind?: string;
    color?: ColorName;
    group?: string;
    order: number;
    style: NodeStyle;
    box: Box;
};

export type LaidOutGroup = {
    id: string;
    label: string;
    parent?: string;
    depth: number;
    order: number;
    box: Box;
};

export type LaidOutEdge = ResolvedEdge & {
    order: number;
    /** Absolute orthogonal route, or null when the renderer must route it. */
    route: Point[] | null;
};

export type GraphLayout = {
    nodes: LaidOutNode[];
    groups: LaidOutGroup[];
    edges: LaidOutEdge[];
    warnings: string[];
};

export type GraphLayoutOptions = {
    /** Top-left corner for the diagram content when laying out from scratch. */
    origin: { x: number; y: number };
    /**
     * Nodes whose final box must not change (existing nodes, including ones
     * the user moved by hand). Only the remaining nodes are placed.
     */
    pinned?: Map<string, Box>;
};

const GROUP_PADDING = { top: 50, left: 30, bottom: 30, right: 30 };
const NODE_MARGIN = 40;

const elk = new ELK();

const round = (value: number) => Math.round(value);

function spacingOptions(direction: "LR" | "TB"): Record<string, string> {
    return {
        "elk.algorithm": "layered",
        "elk.direction": direction === "LR" ? "RIGHT" : "DOWN",
        "elk.edgeRouting": "ORTHOGONAL",
        "elk.spacing.nodeNode": "60",
        "elk.layered.spacing.nodeNodeBetweenLayers": "100",
        "elk.spacing.edgeNode": "30",
        "elk.spacing.edgeEdge": "20",
        "elk.layered.spacing.edgeNodeBetweenLayers": "30",
        "elk.layered.spacing.edgeEdgeBetweenLayers": "20",
        "elk.spacing.edgeLabel": "8",
        "elk.edgeLabels.placement": "CENTER",
        "elk.layered.nodePlacement.strategy": "NETWORK_SIMPLEX",
        // Do NOT set elk.layered.considerModelOrder.strategy: with hierarchical
        // graphs (groups) elkjs 0.12 crashes with "Cannot read properties of
        // undefined (reading 'a')". See src/shared/diagram/check-layout.ts.
    };
}

function boxesOverlap(a: Box, b: Box, margin = 0) {
    return !(
        a.x + a.width + margin <= b.x ||
        b.x + b.width + margin <= a.x ||
        a.y + a.height + margin <= b.y ||
        b.y + b.height + margin <= a.y
    );
}

function contains(outer: Box, inner: Box) {
    return (
        inner.x >= outer.x &&
        inner.y >= outer.y &&
        inner.x + inner.width <= outer.x + outer.width &&
        inner.y + inner.height <= outer.y + outer.height
    );
}

function union(boxes: Box[]): Box {
    const minX = Math.min(...boxes.map((b) => b.x));
    const minY = Math.min(...boxes.map((b) => b.y));
    const maxX = Math.max(...boxes.map((b) => b.x + b.width));
    const maxY = Math.max(...boxes.map((b) => b.y + b.height));
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function simplifyRoute(points: Point[]): Point[] {
    const deduped = points.filter(
        (point, i) =>
            i === 0 ||
            point[0] !== points[i - 1][0] ||
            point[1] !== points[i - 1][1],
    );
    return deduped.filter((point, i) => {
        if (i === 0 || i === deduped.length - 1) return true;
        const [prev, next] = [deduped[i - 1], deduped[i + 1]];
        const collinear =
            (prev[0] === point[0] && point[0] === next[0]) ||
            (prev[1] === point[1] && point[1] === next[1]);
        return !collinear;
    });
}

function median(values: number[]) {
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

export async function layoutGraph(
    spec: GraphSpec,
    options: GraphLayoutOptions,
): Promise<GraphLayout> {
    const direction =
        spec.direction ?? (spec.type === "architecture" || spec.type === "er" ? "LR" : "TB");
    const fallbackKind =
        spec.type === "architecture" ? "service"
        : spec.type === "er" ? "entity"
        : spec.type === "class" ? "class"
        : "process";
    const pinned = options.pinned ?? new Map<string, Box>();
    const warnings: string[] = [];

    const specGroups = spec.type === "architecture" ? (spec.groups ?? []) : [];
    const groupById = new Map(specGroups.map((group) => [group.id, group]));

    // Only groups that (transitively) contain a node are drawn.
    const nonEmptyGroups = new Set<string>();
    for (const node of spec.nodes) {
        let group = "group" in node ? node.group : undefined;
        while (group && !nonEmptyGroups.has(group)) {
            nonEmptyGroups.add(group);
            group = groupById.get(group)?.parent;
        }
    }
    const groups = specGroups.filter((group) => nonEmptyGroups.has(group.id));
    const depthOf = (id: string): number => {
        const parent = groupById.get(id)?.parent;
        return parent ? depthOf(parent) + 1 : 0;
    };

    const nodes: LaidOutNode[] = spec.nodes.map((node, order) => {
        const style = nodeStyle(node.kind, fallbackKind);
        const size =
            pinned.get(node.id) ??
            sizeForLabel(node.label, style.shape, NODE_FONT_SIZE);
        return {
            id: node.id,
            label: node.label,
            kind: node.kind,
            color: node.color,
            group: "group" in node ? node.group : undefined,
            order,
            style,
            box: { x: 0, y: 0, width: size.width, height: size.height },
        };
    });

    const edges = resolveEdges(spec);

    // ---- build the ELK graph ----
    const layoutOptions = spacingOptions(direction);
    const root: ElkNode = {
        id: "root",
        layoutOptions: {
            ...layoutOptions,
            "elk.hierarchyHandling": "INCLUDE_CHILDREN",
            "elk.json.shapeCoords": "ROOT",
            "elk.json.edgeCoords": "ROOT",
        },
        children: [],
        edges: [],
    };
    const elkGroups = new Map<string, ElkNode>();
    for (const group of groups) {
        elkGroups.set(group.id, {
            id: `g:${group.id}`,
            layoutOptions: {
                ...layoutOptions,
                "elk.padding": `[top=${GROUP_PADDING.top},left=${GROUP_PADDING.left},bottom=${GROUP_PADDING.bottom},right=${GROUP_PADDING.right}]`,
            },
            children: [],
        });
    }
    for (const group of groups) {
        const parent = group.parent ? elkGroups.get(group.parent) : root;
        (parent ?? root).children!.push(elkGroups.get(group.id)!);
    }
    for (const node of nodes) {
        const parent = node.group ? elkGroups.get(node.group) : root;
        (parent ?? root).children!.push({
            id: `n:${node.id}`,
            width: node.box.width,
            height: node.box.height,
        });
    }
    root.edges = edges.map((edge): ElkExtendedEdge => {
        const labelSize = edge.label
            ? measureText(edge.label, EDGE_FONT_SIZE)
            : null;
        return {
            id: `e:${edge.id}`,
            sources: [`n:${edge.from}`],
            targets: [`n:${edge.to}`],
            labels: labelSize
                ? [
                      {
                          text: edge.label,
                          width: Math.ceil(labelSize.width + 12),
                          height: lineHeight(EDGE_FONT_SIZE) + 6,
                      },
                  ]
                : [],
        };
    });

    let result: ElkNode;
    try {
        result = await elk.layout(root);
    } catch (error) {
        // ELK occasionally crashes on specific option/graph combinations. Retry with
        // a minimal option set before giving up, so a layout quirk never blocks drawing.
        console.warn("ELK layout failed, retrying with minimal options", error);
        const minimal = {
            "elk.algorithm": "layered",
            "elk.direction": layoutOptions["elk.direction"],
            "elk.edgeRouting": "ORTHOGONAL",
        };
        const strip = (node: ElkNode): ElkNode => ({
            ...node,
            layoutOptions:
                node.id === "root"
                    ? {
                          ...minimal,
                          "elk.hierarchyHandling": "INCLUDE_CHILDREN",
                          "elk.json.shapeCoords": "ROOT",
                          "elk.json.edgeCoords": "ROOT",
                      }
                    : node.layoutOptions?.["elk.padding"]
                      ? {
                            ...minimal,
                            "elk.padding": node.layoutOptions["elk.padding"],
                        }
                      : undefined,
            children: node.children?.map(strip),
        });
        result = await elk.layout(strip(root));
        warnings.push(
            "layout engine fell back to basic settings; spacing may be less polished",
        );
    }

    const elkBoxes = new Map<string, Box>();
    const elkRoutes = new Map<string, Point[]>();
    const collect = (node: ElkNode) => {
        if (node.id !== "root") {
            elkBoxes.set(node.id, {
                x: node.x ?? 0,
                y: node.y ?? 0,
                width: node.width ?? 0,
                height: node.height ?? 0,
            });
        }
        for (const edge of node.edges ?? []) {
            const section = edge.sections?.[0];
            if (!section) continue;
            elkRoutes.set(edge.id, [
                [section.startPoint.x, section.startPoint.y],
                ...(section.bendPoints ?? []).map((p): Point => [p.x, p.y]),
                [section.endPoint.x, section.endPoint.y],
            ]);
        }
        node.children?.forEach(collect);
    };
    collect(result);

    const pinnedInSpec = nodes.filter((node) => pinned.has(node.id));
    const laidOutGroups: LaidOutGroup[] = groups.map((group, order) => ({
        id: group.id,
        label: group.label,
        parent: group.parent,
        depth: depthOf(group.id),
        order,
        box: { x: 0, y: 0, width: 0, height: 0 },
    }));

    if (pinnedInSpec.length === 0) {
        // ---- fresh layout: take ELK's result, translated to the origin ----
        const all = [...elkBoxes.values()];
        const bounds = all.length
            ? union(all)
            : { x: 0, y: 0, width: 0, height: 0 };
        const dx = options.origin.x - bounds.x;
        const dy = options.origin.y - bounds.y;
        const move = (box: Box): Box => ({
            x: round(box.x + dx),
            y: round(box.y + dy),
            width: round(box.width),
            height: round(box.height),
        });

        for (const node of nodes)
            node.box = move(elkBoxes.get(`n:${node.id}`)!);
        for (const group of laidOutGroups)
            group.box = move(elkBoxes.get(`g:${group.id}`)!);

        return {
            nodes,
            groups: laidOutGroups,
            edges: edges.map((edge, order) => {
                const route = elkRoutes.get(`e:${edge.id}`);
                return {
                    ...edge,
                    order,
                    route: route
                        ? simplifyRoute(
                              route.map(([x, y]): Point => [
                                  round(x + dx),
                                  round(y + dy),
                              ]),
                          )
                        : null,
                };
            }),
            warnings,
        };
    }

    // ---- incremental layout: keep pinned nodes, place new ones near their neighbours ----
    const finalBoxes = new Map<string, Box>();
    for (const node of pinnedInSpec)
        finalBoxes.set(node.id, pinned.get(node.id)!);

    const elkBoxOf = (id: string) => elkBoxes.get(`n:${id}`)!;
    const offsetOf = (id: string) => {
        const placed = finalBoxes.get(id)!;
        const ideal = elkBoxOf(id);
        return { dx: placed.x - ideal.x, dy: placed.y - ideal.y };
    };
    const fallbackOffset = {
        dx: median(pinnedInSpec.map((node) => offsetOf(node.id).dx)),
        dy: median(pinnedInSpec.map((node) => offsetOf(node.id).dy)),
    };

    const primary = (box: Box) => (direction === "LR" ? box.x : box.y);
    const secondary = (box: Box) => (direction === "LR" ? box.y : box.x);
    const newNodes = nodes
        .filter((node) => !pinned.has(node.id))
        .sort(
            (a, b) =>
                primary(elkBoxOf(a.id)) - primary(elkBoxOf(b.id)) ||
                secondary(elkBoxOf(a.id)) - secondary(elkBoxOf(b.id)),
        );

    const newlyPlaced = new Set<string>();
    for (const node of newNodes) {
        const neighbours = edges.flatMap((edge) =>
            edge.to === node.id
                ? [edge.from]
                : edge.from === node.id
                  ? [edge.to]
                  : [],
        );
        const placedNeighbours = neighbours.filter((id) => finalBoxes.has(id));
        const sameGroup = (id: string) =>
            nodes.find((candidate) => candidate.id === id)?.group ===
            node.group;
        const anchor =
            placedNeighbours.find(sameGroup) ??
            placedNeighbours[0] ??
            nodes.find(
                (candidate) =>
                    candidate.id !== node.id &&
                    node.group !== undefined &&
                    candidate.group === node.group &&
                    finalBoxes.has(candidate.id),
            )?.id;
        const offset = anchor ? offsetOf(anchor) : fallbackOffset;
        const ideal = elkBoxOf(node.id);

        const box: Box = {
            x: round(ideal.x + offset.dx),
            y: round(ideal.y + offset.dy),
            width: node.box.width,
            height: node.box.height,
        };

        // Nudge along the cross axis until the new node is clear of everything placed so far.
        for (let attempt = 0; attempt < 100; attempt++) {
            const obstacle = [...finalBoxes.values()].find((other) =>
                boxesOverlap(box, other, NODE_MARGIN),
            );
            if (!obstacle) break;
            if (direction === "LR")
                box.y = obstacle.y + obstacle.height + NODE_MARGIN;
            else box.x = obstacle.x + obstacle.width + NODE_MARGIN;
        }

        finalBoxes.set(node.id, box);
        newlyPlaced.add(node.id);
    }

    for (const node of nodes) node.box = finalBoxes.get(node.id)!;

    // Groups wrap their members, innermost first.
    const groupBoxes = new Map<string, Box>();
    for (const group of [...laidOutGroups].sort((a, b) => b.depth - a.depth)) {
        const members = [
            ...nodes
                .filter((node) => node.group === group.id)
                .map((node) => node.box),
            ...laidOutGroups
                .filter((child) => child.parent === group.id)
                .map((child) => groupBoxes.get(child.id)!),
        ];
        const inner = union(members);
        const box = {
            x: inner.x - GROUP_PADDING.left,
            y: inner.y - GROUP_PADDING.top,
            width: inner.width + GROUP_PADDING.left + GROUP_PADDING.right,
            height: inner.height + GROUP_PADDING.top + GROUP_PADDING.bottom,
        };
        groupBoxes.set(group.id, box);
        group.box = box;
    }

    // Report problems the automatic placement introduced (not ones the user created by dragging).
    for (const id of newlyPlaced) {
        const node = nodes.find((candidate) => candidate.id === id)!;
        for (const group of laidOutGroups) {
            const isAncestor = (() => {
                let current = node.group;
                while (current) {
                    if (current === group.id) return true;
                    current = groupById.get(current)?.parent;
                }
                return false;
            })();
            if (
                !isAncestor &&
                boxesOverlap(node.box, group.box) &&
                !contains(node.box, group.box)
            ) {
                warnings.push(
                    `new node '${id}' overlaps group '${group.id}'; use relayout: true if the user wants the diagram re-arranged`,
                );
            }
        }
    }

    return {
        nodes,
        groups: laidOutGroups,
        edges: edges.map((edge, order) => ({ ...edge, order, route: null })),
        warnings,
    };
}

// ---------------------------------------------------------------------------
// Sequence diagrams: deterministic columns (participants) and rows (messages).
// ---------------------------------------------------------------------------

export type LaidOutParticipant = {
    id: string;
    label: string;
    kind?: string;
    color?: ColorName;
    order: number;
    style: NodeStyle;
    box: Box;
    lifeline: { x: number; y1: number; y2: number };
};

export type LaidOutMessage = {
    index: number;
    from: string;
    to: string;
    label: string;
    kind?: "sync" | "async" | "reply";
    /** Absolute path: two points for normal messages, four for self-calls. */
    points: Point[];
    labelPosition: Point;
    labelAlign: "center" | "left";
};

export type SequenceLayout = {
    participants: LaidOutParticipant[];
    messages: LaidOutMessage[];
};

const SEQ_HEADER_HEIGHT = 60;
const SEQ_MIN_GAP = 200;
const SEQ_ROW = 60;
const SEQ_SELF_ROW = 80;
const SEQ_SELF_WIDTH = 50;
const SEQ_SELF_HEIGHT = 36;

const roundTo10 = (value: number) => Math.round(value / 10) * 10;

export function layoutSequence(
    spec: SequenceSpec,
    origin: { x: number; y: number },
): SequenceLayout {
    const participants = spec.participants.map((participant, order) => {
        const style = nodeStyle(participant.kind, "service");
        const size = sizeForLabel(
            participant.label,
            "rectangle",
            NODE_FONT_SIZE,
        );
        return {
            ...participant,
            order,
            style: { ...style, shape: "rectangle" as const },
            width: Math.min(size.width, 240),
            height: Math.max(SEQ_HEADER_HEIGHT, size.height),
        };
    });
    const indexOf = new Map(participants.map((p, i) => [p.id, i]));
    const headerHeight = Math.max(...participants.map((p) => p.height));

    // gaps[i] = distance between the centres of column i and i + 1
    const gaps = participants
        .slice(0, -1)
        .map((p, i) =>
            Math.max(
                SEQ_MIN_GAP,
                p.width / 2 + participants[i + 1].width / 2 + 60,
            ),
        );
    const labelWidth = (label: string) =>
        measureText(label, EDGE_FONT_SIZE).width;

    const spans = spec.messages
        .map((message) => ({
            a: indexOf.get(message.from)!,
            b: indexOf.get(message.to)!,
            width: labelWidth(message.label),
        }))
        .sort((m, n) => Math.abs(m.a - m.b) - Math.abs(n.a - n.b));
    for (const { a, b, width } of spans) {
        if (a === b) {
            if (a < gaps.length) {
                gaps[a] = Math.max(gaps[a], SEQ_SELF_WIDTH + width + 60);
            }
            continue;
        }
        const [lo, hi] = a < b ? [a, b] : [b, a];
        const need = width + 60;
        const current = gaps.slice(lo, hi).reduce((sum, gap) => sum + gap, 0);
        if (current < need) {
            const extra = (need - current) / (hi - lo);
            for (let i = lo; i < hi; i++) gaps[i] += extra;
        }
    }

    const centers: number[] = [];
    participants.forEach((p, i) => {
        centers.push(
            i === 0
                ? roundTo10(origin.x + p.width / 2)
                : roundTo10(centers[i - 1] + gaps[i - 1]),
        );
    });

    const labelHeight = lineHeight(EDGE_FONT_SIZE);
    let y = origin.y + headerHeight + 50 + labelHeight;
    const messages: LaidOutMessage[] = spec.messages.map((message, index) => {
        const a = indexOf.get(message.from)!;
        const b = indexOf.get(message.to)!;
        const rowY = y;
        if (a === b) {
            y += SEQ_SELF_ROW;
            const x = centers[a];
            return {
                index,
                ...message,
                points: [
                    [x, rowY],
                    [x + SEQ_SELF_WIDTH, rowY],
                    [x + SEQ_SELF_WIDTH, rowY + SEQ_SELF_HEIGHT],
                    [x, rowY + SEQ_SELF_HEIGHT],
                ],
                labelPosition: [
                    x + SEQ_SELF_WIDTH + 10,
                    rowY + SEQ_SELF_HEIGHT / 2 - labelHeight / 2,
                ],
                labelAlign: "left",
            };
        }
        y += SEQ_ROW;
        return {
            index,
            ...message,
            points: [
                [centers[a], rowY],
                [centers[b], rowY],
            ],
            labelPosition: [
                (centers[a] + centers[b]) / 2,
                rowY - labelHeight - 6,
            ],
            labelAlign: "center",
        };
    });

    const lifelineEnd = Math.max(y + 10, origin.y + headerHeight + 120);

    return {
        participants: participants.map((p, i) => ({
            id: p.id,
            label: p.label,
            kind: p.kind,
            color: p.color,
            order: p.order,
            style: p.style,
            box: {
                x: centers[i] - p.width / 2,
                y: origin.y + (headerHeight - p.height) / 2,
                width: p.width,
                height: p.height,
            },
            lifeline: {
                x: centers[i],
                y1: origin.y + headerHeight,
                y2: lifelineEnd,
            },
        })),
        messages,
    };
}
