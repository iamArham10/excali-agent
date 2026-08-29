type Element = Record<string, unknown>;

type EvalOutput = {
    toolCalls: {
        toolName: string;
        input: unknown;
    }[];
    testCaseCategory: "create" | "modify" | "delete" | "multi";
};

export function labelCompletenessScorer({
    output,
}: {
    output: EvalOutput;
}) {
    if (output.testCaseCategory === "delete") {
        return {
            name: "label-completeness",
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
            name: "label-completeness",
            score: 1,
            metadata: { shapeCount: 0 },
        };
    }

    const shapeTypes = new Set(["rectangle", "ellipse", "diamond"]);
    const shapes = allElements.filter((el) => shapeTypes.has(el.type as string));
    const textElements = allElements.filter((el) => el.type === "text");

    let checks = 0;
    let passed = 0;
    const issues: string[] = [];

    for (const shape of shapes) {
        checks++;
        const id = (shape.id as string) ?? "<unknown>";
        const label = shape.label as { text?: string } | undefined;

        if (label?.text && label.text.trim().length > 0) {
            passed++;
        } else {
            issues.push(`${id}: shape missing label`);
        }
    }

    // no text element should overlap box (fake label)
    for (const text of textElements) {
        const tx = text.x as number | undefined;
        const ty = text.y as number | undefined;

        if (tx === undefined || ty === undefined) continue;

        for (const shape of shapes) {
            const sx = shape.x as number | undefined;
            const sy = shape.y as number | undefined;
            const sw = (shape.width as number | undefined) ?? 200;
            const sh = (shape.height as number | undefined) ?? 80;

            if (sx === undefined || sy === undefined) continue;

            if (tx >= sx && tx <= sx + sw && ty >= sy && ty <= sy + sh) {
                checks++;
                const textId = (text.id as string) ?? "<unknown>";
                const shapeId = (shape.id as string) ?? "<unknown>";
                issues.push(
                    `${textId}: text element at (${tx},${ty}) overlaps shape ${shapeId} — possible fake label`,
                );
                break;
            }
        }
    }

    return {
        name: "label-completeness",
        score: checks === 0 ? 1 : passed / checks,
        metadata: {
            shapeCount: shapes.length,
            textCount: textElements.length,
            checks,
            passed,
            issues,
        },
    };
}
