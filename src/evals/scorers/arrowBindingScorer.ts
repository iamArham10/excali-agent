type EvalOutput = {
    toolCalls: {
        toolName: string;
        input: unknown;
    }[];
    textCaseCategory: "create" | "update" | "delete";
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
    if (output.textCaseCategory === "delete") {
        return {
            score: 1,
        };
    }

    // for create/update check arrow bindings
}
