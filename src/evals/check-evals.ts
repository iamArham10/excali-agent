import assert from "node:assert/strict";
import { DrawElementsToolSchema } from "../shared/schemas/excali-schema";
import { loadDataset } from "./lib/load-dataset";
import { diagramScorer } from "./scorers/diagram-scorer";
import { editingScorer } from "./scorers/editing-scorer";
import { geometryScorer } from "./scorers/geometry-scorer";
import { mermaidScorer } from "./scorers/mermaid-scorer";
import { researchScorer } from "./scorers/research-scorer";
import { responseScorer } from "./scorers/response-scorer";
import { routingScorer } from "./scorers/routing-scorer";
import { schemaScorer } from "./scorers/schema-scorer";
import type { EvalCase, EvalOutput } from "./types";

const suites = [
    "routing",
    "creation",
    "editing",
    "mermaid",
    "research",
] as const;
const cases = suites.flatMap((suite) => {
    const dataset = loadDataset(`${suite}.json`);
    for (const testCase of dataset) {
        assert.equal(
            testCase.suite,
            suite,
            `${testCase.id} is in the wrong dataset`,
        );
        if (testCase.seed) {
            DrawElementsToolSchema.parse({ elements: testCase.seed.elements });
        }
        if (suite === "creation") assert.ok(testCase.expected.diagram);
        if (suite === "editing") assert.ok(testCase.expected.editing);
        if (suite === "mermaid") assert.ok(testCase.expected.mermaid);
    }
    return dataset;
});

assert.equal(
    new Set(cases.map((testCase) => testCase.id)).size,
    cases.length,
    "eval ids must be globally unique",
);

const creationCase = cases.find(
    (testCase) => testCase.id === "creation-three-stage-flow",
) as EvalCase;
const goodCreationOutput: EvalOutput = {
    text: "Created the flow.",
    steps: [],
    toolResults: [],
    toolCalls: [
        {
            toolName: "drawElements",
            input: {
                elements: [
                    {
                        id: "input",
                        type: "rectangle",
                        x: 0,
                        y: 0,
                        width: 200,
                        height: 80,
                        label: { text: "Input" },
                    },
                    {
                        id: "process",
                        type: "rectangle",
                        x: 400,
                        y: 0,
                        width: 200,
                        height: 80,
                        label: { text: "Process" },
                    },
                    {
                        id: "output",
                        type: "rectangle",
                        x: 800,
                        y: 0,
                        width: 200,
                        height: 80,
                        label: { text: "Output" },
                    },
                    {
                        id: "input-process",
                        type: "arrow",
                        x: 200,
                        y: 40,
                        points: [
                            [0, 0],
                            [200, 0],
                        ],
                        startArrowhead: null,
                        endArrowhead: "arrow",
                        start: { id: "input" },
                        end: { id: "process" },
                    },
                    {
                        id: "process-output",
                        type: "arrow",
                        x: 600,
                        y: 40,
                        points: [
                            [0, 0],
                            [200, 0],
                        ],
                        startArrowhead: null,
                        endArrowhead: "arrow",
                        start: { id: "process" },
                        end: { id: "output" },
                    },
                ],
            },
        },
    ],
};

assert.equal(
    routingScorer({
        input: creationCase,
        output: goodCreationOutput,
        expected: creationCase.expected,
    }).score,
    1,
);
assert.equal(
    schemaScorer({
        input: creationCase,
        output: goodCreationOutput,
        expected: creationCase.expected,
    }).score,
    1,
);
assert.equal(
    diagramScorer({
        input: creationCase,
        output: goodCreationOutput,
        expected: creationCase.expected,
    }).score,
    1,
);
assert.equal(
    geometryScorer({
        input: creationCase,
        output: goodCreationOutput,
        expected: creationCase.expected,
    }).score,
    1,
);

const missingToolOutput: EvalOutput = {
    text: "",
    steps: [],
    toolResults: [],
    toolCalls: [],
};
assert.ok(
    routingScorer({
        input: creationCase,
        output: missingToolOutput,
        expected: creationCase.expected,
    }).score < 1,
);
assert.equal(
    diagramScorer({
        input: creationCase,
        output: missingToolOutput,
        expected: creationCase.expected,
    }).score,
    0,
);

const editingCase = cases.find(
    (testCase) => testCase.id === "editing-rename-shape",
) as EvalCase;
const editingOutput: EvalOutput = {
    text: "Renamed it.",
    steps: [],
    toolResults: [],
    toolCalls: [
        {
            toolName: "modifyElements",
            input: {
                elements: [
                    {
                        id: "worker",
                        type: "rectangle",
                        label: { text: "Queue Consumer" },
                    },
                ],
            },
        },
    ],
};
assert.equal(
    editingScorer({
        input: editingCase,
        output: editingOutput,
        expected: editingCase.expected,
    }).score,
    1,
);

const mermaidCase = cases.find(
    (testCase) => testCase.id === "mermaid-linear-flow",
) as EvalCase;
const mermaidOutput: EvalOutput = {
    text: "",
    steps: [],
    toolResults: [],
    toolCalls: [
        {
            toolName: "drawDiagramUsingMermaid",
            input: {
                mermaidString: "flowchart LR\nBrowser --> API --> Database",
            },
        },
    ],
};
assert.equal(
    mermaidScorer({
        input: mermaidCase,
        output: mermaidOutput,
        expected: mermaidCase.expected,
    }).score,
    1,
);

const researchCase = cases.find(
    (testCase) => testCase.id === "research-web-current-version",
) as EvalCase;
const researchOutput: EvalOutput = {
    text: "",
    steps: [],
    toolResults: [],
    toolCalls: [
        {
            toolName: "webSearchTool",
            input: { query: "current stable React version", maxResults: 5 },
        },
    ],
};
assert.equal(
    researchScorer({
        input: researchCase,
        output: researchOutput,
        expected: researchCase.expected,
    }).score,
    1,
);

const responseCase = cases.find(
    (testCase) => testCase.id === "routing-non-canvas-question",
) as EvalCase;
const responseOutput: EvalOutput = {
    text: "Horizontal scaling adds machines; vertical scaling adds resources to one machine.",
    steps: [],
    toolResults: [],
    toolCalls: [],
};
assert.equal(
    responseScorer({
        input: responseCase,
        output: responseOutput,
        expected: responseCase.expected,
    }).score,
    1,
);

const invalidSchemaOutput: EvalOutput = {
    text: "",
    steps: [],
    toolResults: [],
    toolCalls: [
        {
            toolName: "drawElements",
            input: { elements: [{ id: "bad", type: "arrow" }] },
        },
    ],
};
assert.equal(
    schemaScorer({
        input: creationCase,
        output: invalidSchemaOutput,
        expected: creationCase.expected,
    }).score,
    0,
);

console.log(
    `Validated ${cases.length} eval cases across ${suites.length} suites.`,
);
