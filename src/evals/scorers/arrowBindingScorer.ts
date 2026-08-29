type Element = Record<string, unknown>;

type EvalOutput = {
    toolCalls: {
        toolName: string;
        input: unknown;
    }[];
    testCaseCategory: "create" | "modify" | "delete" | "multi";
};

type EvalExpected = {
    toolName: string;
    requiredArguments: Record<string, unknown>;
}[];

export function arrowBindingScorer({
    output,
    expected,
}: {
    output: EvalOutput;
    expected: EvalExpected;
}) {
    if (output.testCaseCategory === "delete") {
        return { name: "arrow-binding", score: 1, metadata: { skipped: true } };
    }

    const allElements: Element[] = [];
    for (const call of output.toolCalls) {
        if (
            call.toolName === "drawElements" ||
            call.toolName === "modifyElements"
        ) {
            const input = call.input as { elements?: unknown[] } | undefined;
            const elements = input?.elements;
            if (Array.isArray(elements)) {
                allElements.push(...(elements as Element[]));
            }
        }
    }

    const shapeIds = new Set<string>();
    for (const el of allElements) {
        if (
            el.type !== "arrow" &&
            el.type !== "text" &&
            typeof el.id === "string"
        ) {
            shapeIds.add(el.id);
        }
    }

    for (const exp of expected) {
        const elements =
            (exp.requiredArguments?.elements as unknown[]) ?? [];
        for (const el of elements as Element[]) {
            if (
                el.type !== "arrow" &&
                el.type !== "text" &&
                typeof el.id === "string"
            ) {
                shapeIds.add(el.id);
            }
        }
    }

    const arrows = allElements.filter((el) => el.type === "arrow");
    if (arrows.length === 0) {
        return {
            name: "arrow-binding",
            score: 1,
            metadata: { arrowCount: 0 },
        };
    }

    let bound = 0;
    const issues: string[] = [];

    for (const arrow of arrows) {
        const id = (arrow.id as string) ?? "<unknown>";
        const start = arrow.start as { id?: string } | undefined;
        const end = arrow.end as { id?: string } | undefined;

        let arrowOk = true;

        if (!start?.id) {
            issues.push(`${id}: missing start binding`);
            arrowOk = false;
        } else if (shapeIds.size > 0 && !shapeIds.has(start.id)) {
            issues.push(
                `${id}: start.id '${start.id}' not found in shapes`,
            );
            arrowOk = false;
        }

        if (!end?.id) {
            issues.push(`${id}: missing end binding`);
            arrowOk = false;
        } else if (shapeIds.size > 0 && !shapeIds.has(end.id)) {
            issues.push(
                `${id}: end.id '${end.id}' not found in shapes`,
            );
            arrowOk = false;
        }

        if (arrowOk) bound++;
    }

    return {
        name: "arrow-binding",
        score: bound / arrows.length,
        metadata: {
            arrowCount: arrows.length,
            boundCount: bound,
            issues,
        },
    };
}
