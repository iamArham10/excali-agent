type Element = Record<string, unknown>;

type EvalOutput = {
    toolCalls: {
        toolName: string;
        input: unknown;
    }[];
    testCaseCategory: "create" | "modify" | "delete" | "multi";
};

export function duplicateIdScorer({
    output,
}: {
    output: EvalOutput;
}) {
    if (output.testCaseCategory === "delete") {
        return {
            name: "duplicate-id",
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
            name: "duplicate-id",
            score: 1,
            metadata: { elementCount: 0 },
        };
    }

    const seen = new Map<string, number>();
    const duplicates: string[] = [];

    for (const el of allElements) {
        const id = el.id as string | undefined;
        if (!id) continue;

        const count = (seen.get(id) ?? 0) + 1;
        seen.set(id, count);

        if (count === 2) {
            duplicates.push(id);
        }
    }

    const uniqueCount = seen.size;
    const totalWithIds = Array.from(seen.values()).reduce((a, b) => a + b, 0);

    return {
        name: "duplicate-id",
        score: duplicates.length === 0 ? 1 : uniqueCount / totalWithIds,
        metadata: {
            totalElements: totalWithIds,
            uniqueIds: uniqueCount,
            duplicates,
        },
    };
}
