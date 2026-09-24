import type {
    ExcalidrawElement,
    ExcalidrawTextElement,
} from "@excalidraw/excalidraw/element/types";

import type {
    ColorName,
    DiagramSpec,
    GraphSpec,
    SequenceSpec,
} from "../../shared/schemas/diagram-schema";
import type {
    Box,
    GraphLayout,
    Point,
    SequenceLayout,
} from "../../shared/diagram/layout";
import {
    EDGE_COLOR,
    EDGE_FONT_SIZE,
    FONT_FAMILY_CLEAN,
    GROUP_FONT_SIZE,
    GROUP_STROKE,
    INK,
    NODE_FONT_SIZE,
    PALETTE,
    TITLE_FONT_SIZE,
    type NodeStyle,
} from "../../shared/diagram/theme";

export const META_KEY = "excaliAgent";
export const TITLE_OFFSET = 60;

export type DiagramRole =
    | "title"
    | "group"
    | "node"
    | "edge"
    | "participant"
    | "lifeline"
    | "message"
    | "message-label";

export type DiagramMeta = {
    diagramId: string;
    diagramType: DiagramSpec["type"];
    direction?: "LR" | "TB";
    role: DiagramRole;
    key: string;
    order: number;
    data: Record<string, unknown>;
};

export type Skeleton = Record<string, unknown> & { id: string; type: string };

export const elementId = (diagramId: string, role: DiagramRole, key: string) =>
    `${diagramId}:${role}:${key}`;

export function getMeta(element: ExcalidrawElement): DiagramMeta | undefined {
    const meta = element.customData?.[META_KEY];
    return meta && typeof meta === "object" ? (meta as DiagramMeta) : undefined;
}

const clean = { roughness: 0, opacity: 100 } as const;

function nodeColors(style: NodeStyle, color: ColorName | undefined) {
    return PALETTE[color ?? style.color];
}

export type ReusedArrow = {
    x: number;
    y: number;
    points: Point[];
    fixedSegments: unknown;
};

export type PreservedStyle = Record<string, unknown>;

export type RenderResult = {
    skeletons: Skeleton[];
    /** Arrow ids whose route must be computed by Excalidraw after insertion. */
    routeLater: string[];
    /** Exact relative points to restore after conversion (it nudges endpoints). */
    exactPoints: Map<string, { x: number; y: number; points: Point[] }>;
    /** Text ids whose x should be centered on the given coordinate once measured. */
    centerTextOn: Map<string, number>;
    contentBounds: Box;
};

function boundsOf(boxes: Box[]): Box {
    const minX = Math.min(...boxes.map((b) => b.x));
    const minY = Math.min(...boxes.map((b) => b.y));
    const maxX = Math.max(...boxes.map((b) => b.x + b.width));
    const maxY = Math.max(...boxes.map((b) => b.y + b.height));
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function titleSkeleton(spec: DiagramSpec, bounds: Box): Skeleton[] {
    if (!spec.title) return [];
    return [
        {
            id: elementId(spec.diagramId, "title", "title"),
            type: "text",
            x: bounds.x,
            y: bounds.y - TITLE_OFFSET,
            text: spec.title,
            fontSize: TITLE_FONT_SIZE,
            fontFamily: FONT_FAMILY_CLEAN,
            strokeColor: INK,
            ...clean,
            customData: {
                [META_KEY]: meta(spec, "title", "title", 0, { text: spec.title }),
            },
        },
    ];
}

function meta(
    spec: DiagramSpec,
    role: DiagramRole,
    key: string,
    order: number,
    data: Record<string, unknown>,
): DiagramMeta {
    return {
        diagramId: spec.diagramId,
        diagramType: spec.type,
        direction: spec.type === "sequence" ? undefined : spec.direction,
        role,
        key,
        order,
        data,
    };
}

/** Pick facing sides of two boxes for a 2-point elbow arrow that Excalidraw will route. */
function facingPoints(a: Box, b: Box, direction: "LR" | "TB"): [Point, Point] {
    const hGap = Math.max(b.x - (a.x + a.width), a.x - (b.x + b.width));
    const vGap = Math.max(b.y - (a.y + a.height), a.y - (b.y + b.height));
    const horizontal =
        hGap > 0 && vGap > 0 ? hGap >= vGap : hGap > 0 ? true : vGap > 0 ? false : direction === "LR";
    const [acx, acy] = [a.x + a.width / 2, a.y + a.height / 2];
    const [bcx, bcy] = [b.x + b.width / 2, b.y + b.height / 2];
    if (horizontal) {
        return bcx >= acx
            ? [[a.x + a.width, acy], [b.x, bcy]]
            : [[a.x, acy], [b.x + b.width, bcy]];
    }
    return bcy >= acy
        ? [[acx, a.y + a.height], [bcx, b.y]]
        : [[acx, a.y], [bcx, b.y + b.height]];
}

export function renderGraph(
    spec: GraphSpec,
    layout: GraphLayout,
    options: {
        reusedArrows?: Map<string, ReusedArrow>;
        preservedStyles?: Map<string, PreservedStyle>;
    } = {},
): RenderResult {
    const { diagramId } = spec;
    const direction = spec.direction ?? (spec.type === "architecture" ? "LR" : "TB");
    const skeletons: Skeleton[] = [];
    const routeLater: string[] = [];
    const exactPoints: RenderResult["exactPoints"] = new Map();

    // Groups first (outermost first) so they sit behind nodes and arrows.
    for (const group of [...layout.groups].sort((a, b) => a.depth - b.depth)) {
        skeletons.push({
            id: elementId(diagramId, "group", group.id),
            type: "rectangle",
            ...group.box,
            strokeColor: GROUP_STROKE,
            backgroundColor: group.depth % 2 === 0 ? "#f8f9fa" : "#ffffff",
            fillStyle: "solid",
            strokeStyle: "dashed",
            strokeWidth: 1,
            roundness: { type: 3 },
            ...clean,
            label: {
                text: group.label,
                fontSize: GROUP_FONT_SIZE,
                fontFamily: FONT_FAMILY_CLEAN,
                textAlign: "left",
                verticalAlign: "top",
                strokeColor: "#495057",
            },
            customData: {
                [META_KEY]: meta(spec, "group", group.id, group.order, {
                    label: group.label,
                    parent: group.parent,
                }),
            },
        });
    }

    const nodeBoxes = new Map<string, Box>();
    for (const node of layout.nodes) {
        nodeBoxes.set(node.id, node.box);
        const colors = nodeColors(node.style, node.color);
        skeletons.push({
            id: elementId(diagramId, "node", node.id),
            type: node.style.shape,
            ...node.box,
            strokeColor: colors.stroke,
            backgroundColor: colors.fill,
            fillStyle: "solid",
            strokeStyle: node.style.strokeStyle ?? "solid",
            strokeWidth: node.style.strokeWidth ?? 1,
            roundness: node.style.shape === "rectangle" ? { type: 3 } : null,
            ...clean,
            ...(options.preservedStyles?.get(node.id) ?? {}),
            label: {
                text: node.label,
                fontSize: NODE_FONT_SIZE,
                fontFamily: FONT_FAMILY_CLEAN,
                strokeColor: INK,
            },
            customData: {
                [META_KEY]: meta(spec, "node", node.id, node.order, {
                    label: node.label,
                    kind: node.kind,
                    group: node.group,
                    color: node.color,
                }),
            },
        });
    }

    for (const edge of layout.edges) {
        const id = elementId(diagramId, "edge", edge.id);
        const reused = options.reusedArrows?.get(edge.id);
        let x: number;
        let y: number;
        let points: Point[];
        let fixedSegments: unknown = null;

        if (edge.route && edge.route.length >= 2) {
            [x, y] = edge.route[0];
            points = edge.route.map(([px, py]): Point => [px - x, py - y]);
            exactPoints.set(id, { x, y, points });
        } else if (reused) {
            ({ x, y, points, fixedSegments } = reused);
            exactPoints.set(id, { x, y, points });
        } else {
            const [start, end] = facingPoints(
                nodeBoxes.get(edge.from)!,
                nodeBoxes.get(edge.to)!,
                direction,
            );
            [x, y] = start;
            points = [
                [0, 0],
                [end[0] - x, end[1] - y],
            ];
            routeLater.push(id);
        }

        const arrow = edge.arrow ?? "forward";
        skeletons.push({
            id,
            type: "arrow",
            x,
            y,
            points,
            elbowed: true,
            ...(fixedSegments ? { fixedSegments } : {}),
            roundness: null,
            strokeColor: EDGE_COLOR,
            strokeWidth: 2,
            strokeStyle: edge.style === "dashed" ? "dashed" : "solid",
            ...clean,
            ...(options.preservedStyles?.get(`edge:${edge.id}`) ?? {}),
            startArrowhead: arrow === "both" ? "arrow" : null,
            endArrowhead: arrow === "none" ? null : "arrow",
            start: { id: elementId(diagramId, "node", edge.from) },
            end: { id: elementId(diagramId, "node", edge.to) },
            ...(edge.label
                ? {
                      label: {
                          text: edge.label,
                          fontSize: EDGE_FONT_SIZE,
                          fontFamily: FONT_FAMILY_CLEAN,
                          strokeColor: EDGE_COLOR,
                      },
                  }
                : {}),
            customData: {
                [META_KEY]: meta(spec, "edge", edge.id, edge.order, {
                    from: edge.from,
                    to: edge.to,
                    label: edge.label,
                    style: edge.style,
                    arrow: edge.arrow,
                }),
            },
        });
    }

    const contentBounds = boundsOf([
        ...layout.nodes.map((node) => node.box),
        ...layout.groups.map((group) => group.box),
    ]);

    return {
        skeletons: [...skeletons, ...titleSkeleton(spec, contentBounds)],
        routeLater,
        exactPoints,
        centerTextOn: new Map(),
        contentBounds,
    };
}

export function renderSequence(spec: SequenceSpec, layout: SequenceLayout): RenderResult {
    const { diagramId } = spec;
    const skeletons: Skeleton[] = [];
    const exactPoints: RenderResult["exactPoints"] = new Map();
    const centerTextOn = new Map<string, number>();

    for (const participant of layout.participants) {
        const colors = nodeColors(participant.style, participant.color);
        const groupIds = [`${diagramId}:column:${participant.id}`];
        const { lifeline } = participant;
        skeletons.push({
            id: elementId(diagramId, "lifeline", participant.id),
            type: "line",
            x: lifeline.x,
            y: lifeline.y1,
            points: [
                [0, 0],
                [0, lifeline.y2 - lifeline.y1],
            ],
            strokeColor: GROUP_STROKE,
            strokeStyle: "dashed",
            strokeWidth: 1,
            groupIds,
            ...clean,
            customData: {
                [META_KEY]: meta(spec, "lifeline", participant.id, participant.order, {}),
            },
        });
        skeletons.push({
            id: elementId(diagramId, "participant", participant.id),
            type: "rectangle",
            ...participant.box,
            strokeColor: colors.stroke,
            backgroundColor: colors.fill,
            fillStyle: "solid",
            strokeWidth: participant.kind === "actor" ? 2 : 1,
            strokeStyle: participant.style.strokeStyle ?? "solid",
            roundness: { type: 3 },
            groupIds,
            ...clean,
            label: {
                text: participant.label,
                fontSize: NODE_FONT_SIZE,
                fontFamily: FONT_FAMILY_CLEAN,
                strokeColor: INK,
            },
            customData: {
                [META_KEY]: meta(spec, "participant", participant.id, participant.order, {
                    label: participant.label,
                    kind: participant.kind,
                    color: participant.color,
                }),
            },
        });
    }

    for (const message of layout.messages) {
        const key = String(message.index);
        const id = elementId(diagramId, "message", key);
        const [x, y] = message.points[0];
        const points = message.points.map(([px, py]): Point => [px - x, py - y]);
        const groupIds = [`${diagramId}:msg:${key}`];
        exactPoints.set(id, { x, y, points });
        skeletons.push({
            id,
            type: "arrow",
            x,
            y,
            points,
            roundness: null,
            strokeColor: EDGE_COLOR,
            strokeWidth: 2,
            strokeStyle: message.kind === "reply" ? "dashed" : "solid",
            startArrowhead: null,
            endArrowhead: message.kind === "sync" || !message.kind ? "triangle" : "arrow",
            groupIds,
            ...clean,
            customData: {
                [META_KEY]: meta(spec, "message", key, message.index, {
                    from: message.from,
                    to: message.to,
                    label: message.label,
                    kind: message.kind,
                }),
            },
        });
        const labelId = elementId(diagramId, "message-label", key);
        skeletons.push({
            id: labelId,
            type: "text",
            x: message.labelPosition[0],
            y: message.labelPosition[1],
            text: message.label,
            fontSize: EDGE_FONT_SIZE,
            fontFamily: FONT_FAMILY_CLEAN,
            strokeColor: INK,
            groupIds,
            ...clean,
            customData: {
                [META_KEY]: meta(spec, "message-label", key, message.index, {}),
            },
        });
        if (message.labelAlign === "center") {
            centerTextOn.set(labelId, message.labelPosition[0]);
        }
    }

    const contentBounds = boundsOf([
        ...layout.participants.map((p) => p.box),
        ...layout.participants.map((p) => ({
            x: p.lifeline.x,
            y: p.lifeline.y1,
            width: 1,
            height: p.lifeline.y2 - p.lifeline.y1,
        })),
    ]);

    return {
        skeletons: [...skeletons, ...titleSkeleton(spec, contentBounds)],
        routeLater: [],
        exactPoints,
        centerTextOn,
        contentBounds,
    };
}

// ---------------------------------------------------------------------------
// Reading diagrams back from the canvas (source of truth, includes user edits)
// ---------------------------------------------------------------------------

export type CanvasDiagram = {
    spec: DiagramSpec;
    elements: ExcalidrawElement[];
    /** Current boxes of nodes/participants keyed by spec id. */
    boxes: Map<string, Box>;
    /** Current element per edge/node key, for reuse during updates. */
    byRoleKey: Map<string, ExcalidrawElement>;
    contentBounds: Box | null;
};

function definedEntries<T extends Record<string, unknown>>(value: T): T {
    return Object.fromEntries(
        Object.entries(value).filter(([, v]) => v !== undefined && v !== null),
    ) as T;
}

export function readDiagrams(sceneElements: readonly ExcalidrawElement[]) {
    const alive = sceneElements.filter((element) => !element.isDeleted);
    const boundText = new Map<string, string>();
    for (const element of alive) {
        if (element.type === "text" && element.containerId) {
            boundText.set(element.containerId, (element as ExcalidrawTextElement).originalText);
        }
    }

    const grouped = new Map<string, { meta: DiagramMeta; element: ExcalidrawElement }[]>();
    let otherElements = 0;
    for (const element of alive) {
        const elementMeta = getMeta(element);
        if (!elementMeta) {
            if (!(element.type === "text" && element.containerId)) otherElements++;
            continue;
        }
        const list = grouped.get(elementMeta.diagramId) ?? [];
        list.push({ meta: elementMeta, element });
        grouped.set(elementMeta.diagramId, list);
    }

    const diagrams = new Map<string, CanvasDiagram>();
    for (const [diagramId, entries] of grouped) {
        const first = entries[0].meta;
        const byRole = (role: DiagramRole) =>
            entries
                .filter((entry) => entry.meta.role === role)
                .sort((a, b) => a.meta.order - b.meta.order);
        const label = (entry: { meta: DiagramMeta; element: ExcalidrawElement }) =>
            boundText.get(entry.element.id) ?? String(entry.meta.data.label ?? "");
        const titleEntry = byRole("title")[0];
        const title =
            titleEntry && titleEntry.element.type === "text"
                ? (titleEntry.element as ExcalidrawTextElement).originalText
                : undefined;

        const boxes = new Map<string, Box>();
        const byRoleKey = new Map<string, ExcalidrawElement>();
        for (const entry of entries) {
            byRoleKey.set(`${entry.meta.role}:${entry.meta.key}`, entry.element);
            if (entry.meta.role === "node" || entry.meta.role === "participant") {
                const { x, y, width, height } = entry.element;
                boxes.set(entry.meta.key, { x, y, width, height });
            }
        }

        let spec: DiagramSpec;
        if (first.diagramType === "sequence") {
            const participants = byRole("participant").map((entry) =>
                definedEntries({
                    id: entry.meta.key,
                    label: label(entry),
                    kind: entry.meta.data.kind as never,
                    color: entry.meta.data.color as never,
                }),
            );
            const labels = new Map(
                byRole("message-label").map((entry) => [
                    entry.meta.key,
                    (entry.element as ExcalidrawTextElement).originalText,
                ]),
            );
            const known = new Set(participants.map((p) => p.id));
            const messages = byRole("message")
                .filter(
                    (entry) =>
                        known.has(String(entry.meta.data.from)) &&
                        known.has(String(entry.meta.data.to)),
                )
                .map((entry) =>
                    definedEntries({
                        from: String(entry.meta.data.from),
                        to: String(entry.meta.data.to),
                        label: labels.get(entry.meta.key) ?? String(entry.meta.data.label),
                        kind: entry.meta.data.kind as never,
                    }),
                );
            spec = definedEntries({
                type: "sequence",
                diagramId,
                title,
                participants,
                messages,
            }) as SequenceSpec;
        } else {
            const nodes = byRole("node").map((entry) =>
                definedEntries({
                    id: entry.meta.key,
                    label: label(entry),
                    kind: entry.meta.data.kind as never,
                    group: entry.meta.data.group as never,
                    color: entry.meta.data.color as never,
                }),
            );
            const known = new Set(nodes.map((node) => node.id));
            const edges = byRole("edge")
                .filter(
                    (entry) =>
                        known.has(String(entry.meta.data.from)) &&
                        known.has(String(entry.meta.data.to)),
                )
                .map((entry) =>
                    definedEntries({
                        id: entry.meta.key,
                        from: String(entry.meta.data.from),
                        to: String(entry.meta.data.to),
                        label: boundText.get(entry.element.id),
                        style: entry.meta.data.style as never,
                        arrow: entry.meta.data.arrow as never,
                    }),
                );
            const groups = byRole("group").map((entry) =>
                definedEntries({
                    id: entry.meta.key,
                    label: label(entry),
                    parent: entry.meta.data.parent as never,
                }),
            );
            spec = definedEntries({
                type: first.diagramType,
                diagramId,
                title,
                direction: first.direction,
                ...(first.diagramType === "architecture" && groups.length ? { groups } : {}),
                nodes,
                edges,
            }) as GraphSpec;
        }

        const contentBoxes = entries
            .filter((entry) => ["node", "group", "participant"].includes(entry.meta.role))
            .map(({ element }) => ({
                x: element.x,
                y: element.y,
                width: element.width,
                height: element.height,
            }));

        diagrams.set(diagramId, {
            spec,
            elements: entries.map((entry) => entry.element),
            boxes,
            byRoleKey,
            contentBounds: contentBoxes.length ? boundsOf(contentBoxes) : null,
        });
    }

    return { diagrams, otherElements };
}
