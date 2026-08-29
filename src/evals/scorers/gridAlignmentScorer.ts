type Element = Record<string, unknown>;

type EvalOutput = {
    toolCalls: {
        toolName: string;
        input: unknown;
    }[];
    testCaseCategory: "create" | "modify" | "delete" | "multi";
};

export function gridAlignmentScorer({
    output,
}: {
    output: EvalOutput;
}) {
    if (output.testCaseCategory === "delete") {
        return {
            name: "grid-alignment",
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

    if (allElements.length === 0) {
        return {
            name: "grid-alignment",
            score: 1,
            metadata: { coordinateCount: 0 },
        };
    }

    let total = 0;
    let aligned = 0;
    const violations: string[] = [];

    function checkValue(id: string, field: string, value: unknown) {
        if (typeof value !== "number") return;
        total++;
        if (Number.isInteger(value) && value % 10 === 0) {
            aligned++;
        } else {
            violations.push(`${id}.${field} = ${value}`);
        }
    }

    for (const el of allElements) {
        const id = (el.id as string) ?? "<unknown>";

        checkValue(id, "x", el.x);
        checkValue(id, "y", el.y);
        checkValue(id, "width", el.width);
        checkValue(id, "height", el.height);

        if (el.type === "arrow" && Array.isArray(el.points)) {
            for (let i = 0; i < el.points.length; i++) {
                const point = el.points[i] as unknown;
                if (Array.isArray(point)) {
                    checkValue(id, `points[${i}][0]`, point[0]);
                    checkValue(id, `points[${i}][1]`, point[1]);
                }
            }
        }
    }

    return {
        name: "grid-alignment",
        score: total === 0 ? 1 : aligned / total,
        metadata: {
            totalCoordinates: total,
            alignedCount: aligned,
            violations,
        },
    };
}
