import { getDrawnElements, getLabel, isRecord } from "../lib/elements";
import { ratio, type ScoreResult } from "../lib/score";
import type { EvalScorerArgs } from "../types";

type Box = { id: string; x: number; y: number; width: number; height: number };

function asFiniteNumber(value: unknown): number | undefined {
    return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function boxesOverlap(a: Box, b: Box): boolean {
    return !(
        a.x + a.width <= b.x ||
        b.x + b.width <= a.x ||
        a.y + a.height <= b.y ||
        b.y + b.height <= a.y
    );
}

function isOnBoxBoundary(x: number, y: number, box: Box, tolerance = 20): boolean {
    const withinX = x >= box.x - tolerance && x <= box.x + box.width + tolerance;
    const withinY = y >= box.y - tolerance && y <= box.y + box.height + tolerance;
    const onVertical =
        Math.min(Math.abs(x - box.x), Math.abs(x - (box.x + box.width))) <=
        tolerance;
    const onHorizontal =
        Math.min(Math.abs(y - box.y), Math.abs(y - (box.y + box.height))) <=
        tolerance;
    return (withinY && onVertical) || (withinX && onHorizontal);
}

export function geometryScorer({ output, expected }: EvalScorerArgs): ScoreResult {
    const specification = expected.diagram;
    if (!specification) {
        return { name: "diagram-geometry", score: 1, metadata: { skipped: true } };
    }

    const elements = getDrawnElements(output);
    if (elements.length === 0) {
        return {
            name: "diagram-geometry",
            score: 0,
            metadata: { issues: ["no drawable elements to inspect"] },
        };
    }

    const checks: boolean[] = [];
    const issues: string[] = [];
    const ids = new Set<string>();
    const boxes = new Map<string, Box>();

    for (const element of elements) {
        const id = typeof element.id === "string" ? element.id : "<missing-id>";
        const unique = id !== "<missing-id>" && !ids.has(id);
        checks.push(unique);
        if (!unique) issues.push(`${id}: missing or duplicate id`);
        ids.add(id);

        for (const field of ["x", "y", "width", "height"] as const) {
            if (element[field] === undefined) continue;
            const value = asFiniteNumber(element[field]);
            const aligned = value !== undefined && value % specification.gridSize === 0;
            checks.push(aligned);
            if (!aligned) issues.push(`${id}.${field} is not aligned to ${specification.gridSize}px grid`);
        }

        if (["rectangle", "ellipse", "diamond"].includes(String(element.type))) {
            if (specification.requireLabels) {
                const labeled = Boolean(getLabel(element)?.trim());
                checks.push(labeled);
                if (!labeled) issues.push(`${id}: shape has no attached label`);
            }
            const x = asFiniteNumber(element.x);
            const y = asFiniteNumber(element.y);
            const width = asFiniteNumber(element.width) ?? 200;
            const height = asFiniteNumber(element.height) ?? 80;
            if (x !== undefined && y !== undefined) {
                boxes.set(id, { id, x, y, width, height });
            }
        }
    }

    const arrows = elements.filter((element) => element.type === "arrow");
    for (const arrow of arrows) {
        const id = typeof arrow.id === "string" ? arrow.id : "<missing-id>";
        const points = Array.isArray(arrow.points) ? arrow.points : [];
        const validPoints =
            points.length === 2 &&
            points.every(
                (point) =>
                    Array.isArray(point) &&
                    point.length === 2 &&
                    point.every((coordinate) => asFiniteNumber(coordinate) !== undefined),
            ) &&
            points[0][0] === 0 &&
            points[0][1] === 0;
        checks.push(validPoints);
        if (!validPoints) issues.push(`${id}: expected two relative points beginning at [0, 0]`);

        const startId = isRecord(arrow.start) ? arrow.start.id : undefined;
        const endId = isRecord(arrow.end) ? arrow.end.id : undefined;
        const validBindings =
            typeof startId === "string" &&
            typeof endId === "string" &&
            boxes.has(startId) &&
            boxes.has(endId) &&
            startId !== endId;
        checks.push(validBindings);
        if (!validBindings) issues.push(`${id}: invalid start/end bindings`);

        if (validPoints && validBindings) {
            const x = asFiniteNumber(arrow.x);
            const y = asFiniteNumber(arrow.y);
            const lastPoint = points[1] as [number, number];
            const boundaryAligned =
                x !== undefined &&
                y !== undefined &&
                isOnBoxBoundary(x, y, boxes.get(startId as string)!) &&
                isOnBoxBoundary(
                    x + lastPoint[0],
                    y + lastPoint[1],
                    boxes.get(endId as string)!,
                );
            checks.push(boundaryAligned);
            if (!boundaryAligned) issues.push(`${id}: endpoints are not on bound shape boundaries`);
        }
    }

    if (specification.preventNodeOverlap) {
        const boxList = [...boxes.values()];
        for (let left = 0; left < boxList.length; left++) {
            for (let right = left + 1; right < boxList.length; right++) {
                const passed = !boxesOverlap(boxList[left], boxList[right]);
                checks.push(passed);
                if (!passed) issues.push(`${boxList[left].id} overlaps ${boxList[right].id}`);
            }
        }
    }

    return {
        name: "diagram-geometry",
        score: ratio(checks.filter(Boolean).length, checks.length),
        metadata: { checkCount: checks.length, issues },
    };
}
