import { Eval } from "braintrust";
import { readFileSync } from "node:fs";
import { runAgentForEval } from "../server/agent-core";
import { argumentSelectionScorer } from "./scorers/argumentSelectionScorer";
import { arrowBindingScorer } from "./scorers/arrowBindingScorer";
import { duplicateIdScorer } from "./scorers/duplicateIdScorer";
import { gridAlignmentScorer } from "./scorers/gridAlignmentScorer";
import { labelCompletenessScorer } from "./scorers/labelCompletenessScorer";
import { noOverlapScorer } from "./scorers/noOverlapScorer";
import { toolSelectionScorer } from "./scorers/toolSelectionScorer";

import { toolSelectionGoldenDatasetType } from "./types";
import { buildMessages } from "./build-messages";

const datasetPath = new URL(
    "./dataset/tools-usage-golden-dataset.json",
    import.meta.url,
);

const rawData: unknown = JSON.parse(readFileSync(datasetPath, "utf-8"));
const toolSelectionTestCases = toolSelectionGoldenDatasetType.parse(rawData);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

Eval("excali-agent", {
    experimentName: "diagram-agent-bench",
    maxConcurrency: 3,
    data: toolSelectionTestCases.map((testCase) => {
        return {
            input: testCase,
            expected: testCase.expected.toolCalls,
            metadata: {
                id: testCase.id,
                difficulty: testCase.difficulty,
                category: testCase.category,
            },
        };
    }),
    task: async (testCase) => {
        await sleep(2000);
        const result = await runAgentForEval({
            messages: buildMessages(testCase),
            canvasState: "",
        });
        return {
            text: result.text,
            steps: result.steps,
            toolCalls: result.toolCalls,
            toolResults: result.toolResults,
            testCaseCategory: testCase.category,
        };
    },
    scores: [
        toolSelectionScorer,
        argumentSelectionScorer,
        arrowBindingScorer,
        gridAlignmentScorer,
        labelCompletenessScorer,
        duplicateIdScorer,
        noOverlapScorer,
    ],
});
