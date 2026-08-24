type EvalOutput = {
    toolCalls: {
        toolName: string;
        input: unknown;
    }[];
};

type EvalExpected = {
    toolName: string;
    requiredArguments: Record<string, unknown>;
}[];

type ExistsMatcher = {
    __matcher__: "exists";
};

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isExistsMatcher(value: unknown): value is ExistsMatcher {
    return (
        isRecord(value) &&
        value.__matcher__ === "exists" &&
        Object.keys(value).length === 1
    );
}

function matchesRequiredValue(actual: unknown, required: unknown): boolean {
    if (isExistsMatcher(required)) return actual !== undefined;

    if (Array.isArray(required)) {
        return (
            Array.isArray(actual) &&
            actual.length === required.length &&
            required.every((value, index) =>
                matchesRequiredValue(actual[index], value),
            )
        );
    }

    if (isRecord(required)) {
        return (
            isRecord(actual) &&
            Object.entries(required).every(([key, value]) =>
                matchesRequiredValue(actual[key], value),
            )
        );
    }

    return Object.is(actual, required);
}

// Check whether each tool call contains the required arguments.
export function argumentSelectionScorer({
    output,
    expected,
}: {
    output: EvalOutput;
    expected: EvalExpected;
}) {
    const maxLen = Math.max(output.toolCalls.length, expected.length);
    const mismatches: string[] = [];
    let correct = 0;

    for (let index = 0; index < maxLen; index++) {
        const actualCall = output.toolCalls[index];
        const expectedCall = expected[index];

        if (!expectedCall) {
            mismatches.push(
                `Call ${index + 1}: unexpected ${actualCall.toolName} call`,
            );
            continue;
        }

        if (!actualCall) {
            mismatches.push(
                `Call ${index + 1}: missing ${expectedCall.toolName} call`,
            );
            continue;
        }

        if (actualCall.toolName !== expectedCall.toolName) {
            mismatches.push(
                `Call ${index + 1}: expected ${expectedCall.toolName}, got ${actualCall.toolName}`,
            );
            continue;
        }

        if (
            matchesRequiredValue(
                actualCall.input,
                expectedCall.requiredArguments,
            )
        ) {
            correct++;
        } else {
            mismatches.push(`Call ${index + 1}: arguments did not match`);
        }
    }

    return {
        name: "argument-selection",
        score: maxLen === 0 ? 1 : correct / maxLen,
        metadata: {
            mismatches,
            expectedCount: expected.length,
            actualCount: output.toolCalls.length,
        },
    };
}
