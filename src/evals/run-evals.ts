import { Eval } from "braintrust";
import { runAgentForEval } from "../server/agent-core";
import { buildMessages } from "./lib/build-messages";
import { loadDataset } from "./lib/load-dataset";
import { diagramScorer } from "./scorers/diagram-scorer";
import { editingScorer } from "./scorers/editing-scorer";

import { researchScorer } from "./scorers/research-scorer";
import { responseScorer } from "./scorers/response-scorer";
import { routingScorer } from "./scorers/routing-scorer";
import { schemaScorer } from "./scorers/schema-scorer";

const suiteConfigurations = {
    routing: {
        dataset: "routing.json",
        scorers: [routingScorer, schemaScorer, responseScorer],
    },
    creation: {
        dataset: "creation.json",
        scorers: [routingScorer, schemaScorer, diagramScorer],
    },
    editing: {
        dataset: "editing.json",
        scorers: [routingScorer, schemaScorer, editingScorer],
    },

    research: {
        dataset: "research.json",
        scorers: [routingScorer, schemaScorer, researchScorer],
    },
} as const;

type SuiteName = keyof typeof suiteConfigurations;

const requestedSuite = process.env.EVAL_SUITE ?? "all";
const suiteNames = Object.keys(suiteConfigurations) as SuiteName[];
if (
    requestedSuite !== "all" &&
    !suiteNames.includes(requestedSuite as SuiteName)
) {
    throw new Error(
        `Unknown EVAL_SUITE '${requestedSuite}'. Expected one of: all, ${suiteNames.join(", ")}`,
    );
}

const selectedSuites =
    requestedSuite === "all" ? suiteNames : [requestedSuite as SuiteName];
const maxConcurrency = Number.parseInt(process.env.EVAL_CONCURRENCY ?? "3", 10);
const delayMs = Number.parseInt(process.env.EVAL_DELAY_MS ?? "0", 10);

for (const suiteName of selectedSuites) {
    const configuration = suiteConfigurations[suiteName];
    const testCases = loadDataset(configuration.dataset);

    Eval("excali-agent", {
        experimentName: `eval-${suiteName}`,
        maxConcurrency,
        data: testCases.map((testCase) => ({
            input: testCase,
            expected: testCase.expected,
            metadata: {
                id: testCase.id,
                suite: testCase.suite,
                difficulty: testCase.difficulty,
                tags: testCase.tags,
            },
        })),
        task: async (testCase) => {
            if (delayMs > 0) {
                await new Promise((resolve) => setTimeout(resolve, delayMs));
            }
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
        scores: [...configuration.scorers],
    });
}
