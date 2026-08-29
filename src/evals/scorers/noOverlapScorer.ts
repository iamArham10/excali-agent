type Element = Record<string, unknown>;

type EvalOutput = {
    toolCalls: {
        toolName: string;
        input: unknown;
    }[];
    testCaseCategory: "create" | "modify" | "delete" | "multi";
};

interface BoundingBox {
    id: string;
    x: number;
    y: number;
    w: number;
    h: number;
}

function boxesOverlap(a: BoundingBox, b: BoundingBox): boolean {
    return !(
        a.x + a.w <= b.x ||
        b.x + b.w <= a.x ||
        a.y + a.h <= b.y ||
        b.y + b.h <= a.y
    );
}

export function noOverlapScorer({
    output,
}: {
    output: EvalOutput;
}) {
    if (output.testCaseCategory === "delete") {
        return {
            name: "no-overlap",
            score: 1,
            metadata: { skipped: true },
        };
    }

    const allElements: Element[] = [];
    for (const call of output.toolCalls) {
        if (
            call.toolName === "drawElements" ||
            call.toolName === "modifyElements"
        ) {
            const input = call.input as { elements?: unknown[] } | undefined;
            if (Array.isArray(input?.elements)) {
                allElements.push(...(input.elements as Element[]));
            }
        }
    }

    const shapeTypes = new Set(["rectangle", "ellipse", "diamond"]);

    const boxes: BoundingBox[] = [];
    for (const el of allElements) {
        if (!shapeTypes.has(el.type as string)) continue;

        const x = el.x as number | undefined;
        const y = el.y as number | undefined;
        if (x === undefined || y === undefined) continue;

        boxes.push({
            id: (el.id as string) ?? "<unknown>",
            x,
            y,
            w: (el.width as number | undefined) ?? 200,
            h: (el.height as number | undefined) ?? 80,
        });
    }

    if (boxes.length < 2) {
        return {
            name: "no-overlap",
            score: 1,
            metadata: { shapeCount: boxes.length, overlaps: [] },
        };
    }

    const overlaps: string[] = [];
    const totalPairs = (boxes.length * (boxes.length - 1)) / 2;

    for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
            if (boxesOverlap(boxes[i], boxes[j])) {
                overlaps.push(`${boxes[i].id} ↔ ${boxes[j].id}`);
            }
        }
    }

    const cleanPairs = totalPairs - overlaps.length;

    return {
        name: "no-overlap",
        score: totalPairs === 0 ? 1 : cleanPairs / totalPairs,
        metadata: {
            shapeCount: boxes.length,
            totalPairs,
            overlaps,
        },
    };
}
