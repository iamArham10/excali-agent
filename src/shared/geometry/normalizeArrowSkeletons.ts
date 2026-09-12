type Point = readonly [number, number];

type BindingTarget = {
    id: string;
    type: string;
    x: number;
    y: number;
    width?: number;
    height?: number;
};

type ArrowSkeletonLike = {
    id: string;
    type: "arrow";
    x: number;
    y: number;
    points?: readonly Point[];
    start?: { id: string };
    end?: { id: string };
};

function distanceFromElement(point: Point, element: BindingTarget | undefined) {
    if (
        !element ||
        element.width === undefined ||
        element.height === undefined
    ) {
        return 0;
    }

    const minX = Math.min(element.x, element.x + element.width);
    const maxX = Math.max(element.x, element.x + element.width);
    const minY = Math.min(element.y, element.y + element.height);
    const maxY = Math.max(element.y, element.y + element.height);
    const dx = Math.max(minX - point[0], 0, point[0] - maxX);
    const dy = Math.max(minY - point[1], 0, point[1] - maxY);

    return Math.hypot(dx, dy);
}

function bindingScore(
    points: readonly Point[],
    arrow: ArrowSkeletonLike,
    targets: Map<string, BindingTarget>,
) {
    const first = points[0];
    const last = points[points.length - 1];

    return (
        distanceFromElement(first, arrow.start && targets.get(arrow.start.id)) +
        distanceFromElement(last, arrow.end && targets.get(arrow.end.id))
    );
}

export function normalizeArrowSkeletons<T>(
    skeletons: readonly T[],
    existingTargets: readonly BindingTarget[] = [],
): T[] {
    const targets = new Map<string, BindingTarget>(
        existingTargets.map((element) => [element.id, element]),
    );

    for (const value of skeletons) {
        const element = value as Partial<BindingTarget>;
        if (
            element.type !== "arrow" &&
            element.id !== undefined &&
            element.type !== undefined &&
            element.x !== undefined &&
            element.y !== undefined
        ) {
            targets.set(element.id, element as BindingTarget);
        }
    }

    return skeletons.map((value) => {
        const element = value as Partial<ArrowSkeletonLike>;
        if (
            element.type !== "arrow" ||
            element.x === undefined ||
            element.y === undefined ||
            !element.points?.length
        ) {
            return value;
        }

        const arrow = element as ArrowSkeletonLike;
        // create relative points so point([px, py]) becomes [px + x, py + y]
        // considering px, py are offsets
        const relativePoints = arrow.points!.map(
            ([x, y]) => [arrow.x + x, arrow.y + y] as Point,
        );

        // create relative points so point([px, py]) becomes [px, py]
        // considering px, py are not offsets but absolute points on canvas
        const absolutePoints = arrow.points!.map(([x, y]) => [x, y] as Point);

        // check which points makes sence relative or absolute
        let canvasPoints =
            bindingScore(absolutePoints, arrow, targets) <
                bindingScore(relativePoints, arrow, targets)
                ? absolutePoints
                : relativePoints;

        // check if reverse points makes more sense
        const reversedPoints = [...canvasPoints].reverse();
        if (
            bindingScore(reversedPoints, arrow, targets) <
            bindingScore(canvasPoints, arrow, targets)
        ) {
            canvasPoints = reversedPoints;
        }

        const [originX, originY] = canvasPoints[0];
        const points = canvasPoints.map(
            ([x, y]) => [x - originX, y - originY] as Point,
        );

        return {
            ...arrow,
            x: originX,
            y: originY,
            points,
        } as T;
    });
}

export type { BindingTarget };
