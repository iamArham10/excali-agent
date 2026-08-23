import { Eval } from "braintrust";
import { readFileSync } from "node:fs";
import { runAgentForEval } from "../server/agent-core";
import { toolSelectionScorer } from "./eval-scorers";

import { toolSelectionGoldenDatasetType } from "./types";
import { buildMessages } from "./build-messages";

const datasetPath = new URL(
    "./dataset/tool-selection-golden-dataset.json",
    import.meta.url,
);

const rawData: unknown = JSON.parse(readFileSync(datasetPath, "utf-8"));
const toolSelectionTestCases = toolSelectionGoldenDatasetType.parse(rawData);

Eval("excali-agent", {
    experimentName: "tool-selection",
    data: toolSelectionTestCases.map((testCase) => {
        return {
            input: testCase,
            expected: testCase.expected,
            metadata: {
                id: testCase.id,
                difficulty: testCase.difficulty,
                category: testCase.category,
            },
        };
    }),
    task: async (testCase) => {
        const result = await runAgentForEval({
            messages: buildMessages(testCase),
        });
        return {
            text: result.text,
            steps: result.steps,
            toolCalls: result.toolCalls,
            toolResults: result.toolResults,
        };
    },
    scores: [toolSelectionScorer],
});
