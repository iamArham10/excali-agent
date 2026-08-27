import type { ExcalidrawElementSkeleton } from "@excalidraw/excalidraw/data/transform";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";

const DEFAULT_TARGET_SIZE = 100;
const ARROW_GAP = 8;
const PARALLEL_ARROW_SPACING = 24;

type Point = readonly [number, number];

type BindingTarget = Pick<
    ExcalidrawElement,
    "id" | "type" | "x" | "y" | "width" | "height"
>;

type Arrowhead = "circle" | "diamond" | "arrow" | "bar" | "dot";

export type ArrowConnectionSkeleton = {
    id: string;
    type: "arrow";
    start: { id: string };
    end: { id: string };
    label?: { text: string };
    startArrowhead?: Arrowhead;
    endArrowhead?: Arrowhead;
};

export type AgentElementSkeleton =
    ExcalidrawElementSkeleton | ArrowConnectionSkeleton;

export type ArrowBindingSpec = {
    arrowId: string;
    startId: string;
    endId: string;
    startFocus: number;
    endFocus: number;
};

type PositionedArrow = {
    skeleton: ExcalidrawElementSkeleton;
    binding: ArrowBindingSpec;
};

function isArrowSkeleton(
    skeleton: AgentElementSkeleton,
): skeleton is ArrowConnectionSkeleton {
    return skeleton.type === "arrow";
}

function targetCenter(target: BindingTarget): Point {
    return [target.x + target.width / 2, target.y + target.height / 2];
}

function isInsideTarget(point: Point, target: BindingTarget) {
    const [x, y] = point;
    const [centerX, centerY] = targetCenter(target);
    const halfWidth = Math.max(target.width / 2, 0.5);
    const halfHeight = Math.max(target.height / 2, 0.5);
    const normalizedX = Math.abs(x - centerX) / halfWidth;
    const normalizedY = Math.abs(y - centerY) / halfHeight;

    if (target.type === "ellipse") {
        return normalizedX ** 2 + normalizedY ** 2 <= 1;
    }
    if (target.type === "diamond") {
        return normalizedX + normalizedY <= 1;
    }
    return normalizedX <= 1 && normalizedY <= 1;
}

function clampPointInsideTarget(point: Point, target: BindingTarget): Point {
    if (isInsideTarget(point, target)) return point;

    const center = targetCenter(target);
    let low = 0;
    let high = 1;
    for (let index = 0; index < 32; index++) {
        const ratio = (low + high) / 2;
        const candidate: Point = [
            center[0] + (point[0] - center[0]) * ratio,
            center[1] + (point[1] - center[1]) * ratio,
        ];
        if (isInsideTarget(candidate, target)) low = ratio;
        else high = ratio;
    }
    return [
        center[0] + (point[0] - center[0]) * low,
        center[1] + (point[1] - center[1]) * low,
    ];
}

function boundaryPoint(
    target: BindingTarget,
    insidePoint: Point,
    direction: Point,
): Point {
    let low = 0;
    let high = Math.max(target.width, target.height, DEFAULT_TARGET_SIZE) * 4;

    for (let index = 0; index < 40; index++) {
        const distance = (low + high) / 2;
        const candidate: Point = [
            insidePoint[0] + direction[0] * distance,
            insidePoint[1] + direction[1] * distance,
        ];
        if (isInsideTarget(candidate, target)) low = distance;
        else high = distance;
    }

    return [
        insidePoint[0] + direction[0] * low,
        insidePoint[1] + direction[1] * low,
    ];
}

function bindingFocus(target: BindingTarget, point: Point) {
    const [centerX, centerY] = targetCenter(target);
    const normalizedX = (point[0] - centerX) / Math.max(target.width / 2, 0.5);
    const normalizedY = (point[1] - centerY) / Math.max(target.height / 2, 0.5);
    const focus =
        Math.abs(normalizedX) > Math.abs(normalizedY)
            ? normalizedY
            : normalizedX;
    return Math.max(-0.95, Math.min(0.95, focus));
}

function parallelOffset(index: number) {
    if (index === 0) return 0;
    const lane = Math.ceil(index / 2);
    return (index % 2 === 1 ? 1 : -1) * lane * PARALLEL_ARROW_SPACING;
}

function connectionKey(startId: string, endId: string) {
    return [startId, endId].sort().join("\u0000");
}

function asBindingTarget(element: BindingTarget): BindingTarget {
    return {
        id: element.id,
        type: element.type,
        x: element.x,
        y: element.y,
        width: element.width || DEFAULT_TARGET_SIZE,
        height: element.height || DEFAULT_TARGET_SIZE,
    };
}

export function positionArrowSkeletons(
    arrows: readonly ArrowConnectionSkeleton[],
    targets: readonly BindingTarget[],
    existingElements: readonly ExcalidrawElement[] = [],
): PositionedArrow[] {
    const targetsById = new Map(
        targets.map((target) => [target.id, asBindingTarget(target)]),
    );
    const connectionCounts = new Map<string, number>();

    for (const element of existingElements) {
        if (element.type !== "arrow") continue;
        const startId = element.startBinding?.elementId;
        const endId = element.endBinding?.elementId;
        if (!startId || !endId) continue;
        const key = connectionKey(startId, endId);
        connectionCounts.set(key, (connectionCounts.get(key) ?? 0) + 1);
    }

    return arrows.map((arrow) => {
        const startTarget = targetsById.get(arrow.start.id);
        const endTarget = targetsById.get(arrow.end.id);
        if (!startTarget || !endTarget) {
            const missingId = !startTarget ? arrow.start.id : arrow.end.id;
            throw new Error(
                `Cannot connect arrow ${arrow.id}: shape ${missingId} was not found`,
            );
        }
        if (startTarget.id === endTarget.id) {
            throw new Error(
                `Cannot connect arrow ${arrow.id}: start and end must be different shapes`,
            );
        }

        const key = connectionKey(startTarget.id, endTarget.id);
        const connectionIndex = connectionCounts.get(key) ?? 0;
        connectionCounts.set(key, connectionIndex + 1);

        const startCenter = targetCenter(startTarget);
        const endCenter = targetCenter(endTarget);
        const deltaX = endCenter[0] - startCenter[0];
        const deltaY = endCenter[1] - startCenter[1];
        const length = Math.hypot(deltaX, deltaY) || 1;
        const direction: Point = [deltaX / length, deltaY / length];
        const perpendicular: Point = [-direction[1], direction[0]];
        const offset = parallelOffset(connectionIndex);

        const startInside = clampPointInsideTarget(
            [
                startCenter[0] + perpendicular[0] * offset,
                startCenter[1] + perpendicular[1] * offset,
            ],
            startTarget,
        );
        const endInside = clampPointInsideTarget(
            [
                endCenter[0] + perpendicular[0] * offset,
                endCenter[1] + perpendicular[1] * offset,
            ],
            endTarget,
        );
        const startBoundary = boundaryPoint(
            startTarget,
            startInside,
            direction,
        );
        const endBoundary = boundaryPoint(endTarget, endInside, [
            -direction[0],
            -direction[1],
        ]);
        const startPoint: Point = [
            startBoundary[0] + direction[0] * ARROW_GAP,
            startBoundary[1] + direction[1] * ARROW_GAP,
        ];
        const endPoint: Point = [
            endBoundary[0] - direction[0] * ARROW_GAP,
            endBoundary[1] - direction[1] * ARROW_GAP,
        ];

        const { start, end, ...arrowStyle } = arrow;
        return {
            skeleton: {
                ...arrowStyle,
                x: startPoint[0],
                y: startPoint[1],
                points: [
                    [0, 0],
                    [endPoint[0] - startPoint[0], endPoint[1] - startPoint[1]],
                ],
            } as ExcalidrawElementSkeleton,
            binding: {
                arrowId: arrow.id,
                startId: start.id,
                endId: end.id,
                startFocus: bindingFocus(startTarget, startBoundary),
                endFocus: bindingFocus(endTarget, endBoundary),
            },
        };
    });
}

export { ARROW_GAP, isArrowSkeleton };
