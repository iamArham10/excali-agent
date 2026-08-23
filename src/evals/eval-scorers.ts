type EvalOutput = {
    toolCalls: { toolName: string }[];
};

type EvalExpected = {
    toolCalls: { toolName: string; requiredArguments: unknown }[];
};

// Check if the agent called the correct tools in the correct order.
export function toolSelectionScorer({
    output,
    expected,
}: {
    output: EvalOutput;
    expected: EvalExpected;
}) {
    const actualCalls = output.toolCalls.map((toolCall) => toolCall.toolName);

    const expectedCalls = expected.toolCalls.map(
        (toolCall) => toolCall.toolName,
    );

    const maxLen = Math.max(actualCalls.length, expectedCalls.length);

    if (maxLen === 0) {
        return {
            name: "tool-selection",
            score: 1,
            metadata: {
                mismatches: [],
                expectedCount: 0,
                actualCount: 0,
            },
        };
    }

    const mismatches: string[] = [];
    let correct = 0;

    for (let i = 0; i < maxLen; i++) {
        const actualTool = actualCalls[i];
        const expectedTool = expectedCalls[i];

        if (actualTool !== expectedTool) {
            mismatches.push(
                `Expected ${expectedTool ?? "<none>"}, got ${actualTool ?? "<none>"}`,
            );
        } else {
            correct++;
        }
    }

    return {
        name: "tool-selection",
        score: correct / maxLen,
        metadata: {
            mismatches,
            expectedCount: expectedCalls.length,
            actualCount: actualCalls.length,
        },
    };
}
