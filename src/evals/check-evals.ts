import assert from "node:assert/strict";
import { validateDiagramSpec } from "../shared/diagram/validate";
import { CreateDiagramToolSchema } from "../shared/schemas/diagram-schema";
import { buildMessages } from "./lib/build-messages";
import { getSpecItems } from "./lib/elements";
import { loadDataset } from "./lib/load-dataset";
import { diagramScorer } from "./scorers/diagram-scorer";
import { editingScorer } from "./scorers/editing-scorer";
import { researchScorer } from "./scorers/research-scorer";
import { responseScorer } from "./scorers/response-scorer";
import { routingScorer } from "./scorers/routing-scorer";
import { schemaScorer } from "./scorers/schema-scorer";
import type { EvalCase, EvalOutput, EvalToolCall, SuiteName } from "./types";

const suites: SuiteName[] = ["routing", "creation", "editing", "research"];

const cases = suites.flatMap((suite) => {
    const dataset = loadDataset(`${suite}.json`);
    for (const testCase of dataset) {
        assert.equal(
            testCase.suite,
            suite,
            `${testCase.id} is in the wrong dataset`,
        );

        if (testCase.seed) {
            const { diagram } = CreateDiagramToolSchema.parse({
                diagram: testCase.seed.diagram,
            });
            const { errors, warnings } = validateDiagramSpec(diagram);
            assert.deepEqual(
                errors,
                [],
                `${testCase.id}: seed diagram has errors`,
            );
            assert.deepEqual(
                warnings,
                [],
                `${testCase.id}: seed diagram has warnings`,
            );
            assert.equal(
                buildMessages(testCase).length,
                5,
                `${testCase.id}: seed messages`,
            );
        }

        if (suite === "creation") {
            const diagram = testCase.expected.diagram;
            assert.ok(
                diagram,
                `${testCase.id}: creation cases need a diagram expectation`,
            );
            if (diagram.diagramType === "sequence") {
                assert.ok(
                    diagram.nodes.length +
                        diagram.connections.length +
                        diagram.groups.length ===
                        0,
                    `${testCase.id}: sequence expectations use participants/messages`,
                );
                assert.ok(
                    diagram.participants.length > 0,
                    `${testCase.id}: no participants`,
                );
            } else {
                assert.ok(
                    diagram.participants.length + diagram.messages.length === 0,
                    `${testCase.id}: graph expectations use nodes/connections`,
                );
                assert.ok(diagram.nodes.length > 0, `${testCase.id}: no nodes`);
            }
            if (diagram.groups.length > 0) {
                assert.equal(
                    diagram.diagramType,
                    "architecture",
                    `${testCase.id}: groups need architecture`,
                );
            }
        }

        if (suite === "editing") {
            const editing = testCase.expected.editing;
            assert.ok(
                editing,
                `${testCase.id}: editing cases need an editing expectation`,
            );
            assert.ok(
                testCase.seed,
                `${testCase.id}: editing cases need a seed diagram`,
            );
            const seedIds = new Set(
                getSpecItems(testCase.seed.diagram).map((item) => item.id),
            );
            for (const id of [
                ...editing.preservedIds,
                ...editing.changedNodes.map((change) => change.id),
            ]) {
                assert.ok(
                    seedIds.has(id),
                    `${testCase.id}: '${id}' is not in the seed diagram`,
                );
            }
        }
    }
    return dataset;
});

assert.equal(
    new Set(cases.map((testCase) => testCase.id)).size,
    cases.length,
    "eval ids must be globally unique",
);

function getCase(id: string): EvalCase {
    const testCase = cases.find((candidate) => candidate.id === id);
    assert.ok(testCase, `missing eval case '${id}'`);
    return testCase;
}

function output(toolCalls: EvalToolCall[], text = "Done."): EvalOutput {
    return { text, steps: [], toolResults: [], toolCalls };
}

type Scorer = typeof routingScorer;
function score(scorer: Scorer, testCase: EvalCase, result: EvalOutput): number {
    return scorer({
        input: testCase,
        output: result,
        expected: testCase.expected,
    }).score;
}

// --- creation: architecture ------------------------------------------------

const threeTierCase = getCase("creation-three-tier-web-app");
const threeTierSpec = {
    type: "architecture",
    diagramId: "three-tier",
    nodes: [
        { id: "web", label: "Web Client\\n(React)", kind: "client" },
        { id: "api", label: "API\\n(Node.js)" },
        { id: "db", label: "PostgreSQL", kind: "database" },
    ],
    edges: [
        { from: "web", to: "api", label: "HTTPS" },
        { from: "api", to: "db", label: "SQL" },
    ],
};
const goodThreeTier = output([
    { toolName: "createDiagram", input: { diagram: threeTierSpec } },
]);
for (const scorer of [routingScorer, schemaScorer, diagramScorer]) {
    assert.equal(
        score(scorer, threeTierCase, goodThreeTier),
        1,
        `good 3-tier: ${scorer.name}`,
    );
}

assert.ok(
    score(routingScorer, threeTierCase, output([])) < 1,
    "missing createDiagram fails routing",
);
assert.equal(
    score(diagramScorer, threeTierCase, output([])),
    0,
    "no createDiagram scores 0",
);

const missingDatabase = output([
    {
        toolName: "createDiagram",
        input: {
            diagram: {
                ...threeTierSpec,
                nodes: threeTierSpec.nodes.slice(0, 2),
                edges: threeTierSpec.edges.slice(0, 1),
            },
        },
    },
]);
assert.ok(
    score(diagramScorer, threeTierCase, missingDatabase) < 1,
    "missing node is penalized",
);

const danglingEdge = output([
    {
        toolName: "createDiagram",
        input: {
            diagram: {
                ...threeTierSpec,
                edges: [...threeTierSpec.edges, { from: "api", to: "cache" }],
            },
        },
    },
]);
assert.equal(
    schemaScorer({
        input: threeTierCase,
        output: danglingEdge,
        expected: threeTierCase.expected,
    }).score,
    1,
);
assert.equal(
    score(diagramScorer, threeTierCase, danglingEdge),
    0,
    "validateDiagramSpec errors fail",
);

const wrongType = output([
    {
        toolName: "createDiagram",
        input: {
            diagram: {
                type: "flowchart",
                diagramId: "three-tier",
                nodes: threeTierSpec.nodes.map(({ id, label }) => ({
                    id,
                    label,
                })),
                edges: threeTierSpec.edges,
            },
        },
    },
]);
assert.ok(
    score(diagramScorer, threeTierCase, wrongType) < 1,
    "wrong diagram type is penalized",
);

const splitAcrossCalls = output([
    {
        toolName: "createDiagram",
        input: { diagram: { ...threeTierSpec, diagramId: "part-1" } },
    },
    { toolName: "createDiagram", input: { diagram: threeTierSpec } },
]);
assert.ok(
    score(diagramScorer, threeTierCase, splitAcrossCalls) < 1,
    "multiple createDiagram calls penalized",
);

const clearedFirst = output([
    { toolName: "clearCanvas", input: {} },
    { toolName: "createDiagram", input: { diagram: threeTierSpec } },
]);
assert.ok(
    score(diagramScorer, threeTierCase, clearedFirst) < 1,
    "clearCanvas during creation penalized",
);
assert.ok(
    score(routingScorer, threeTierCase, clearedFirst) < 1,
    "clearCanvas is forbidden",
);

// --- creation: nested groups ---------------------------------------------------

const vpcCase = getCase("creation-aws-vpc-nested-groups");
const vpcSpec = {
    type: "architecture",
    diagramId: "aws-vpc",
    groups: [
        { id: "vpc", label: "VPC" },
        { id: "public", label: "Public Subnet", parent: "vpc" },
        { id: "private", label: "Private Subnet", parent: "vpc" },
    ],
    nodes: [
        { id: "users", label: "Users", kind: "user" },
        {
            id: "alb",
            label: "Application Load Balancer",
            kind: "gateway",
            group: "public",
        },
        { id: "app-1", label: "App Server 1\\n(EC2)", group: "private" },
        { id: "app-2", label: "App Server 2\\n(EC2)", group: "private" },
        { id: "rds", label: "RDS", kind: "database", group: "private" },
    ],
    edges: [
        { from: "users", to: "alb", label: "HTTPS" },
        { from: "alb", to: "app-1" },
        { from: "alb", to: "app-2" },
        { from: "app-1", to: "rds", label: "SQL" },
        { from: "app-2", to: "rds", label: "SQL" },
    ],
};
assert.equal(
    score(
        diagramScorer,
        vpcCase,
        output([{ toolName: "createDiagram", input: { diagram: vpcSpec } }]),
    ),
    1,
    "good nested-group spec",
);
const flatGroups = {
    ...vpcSpec,
    groups: vpcSpec.groups.map(({ id, label }) => ({ id, label })),
};
assert.ok(
    score(
        diagramScorer,
        vpcCase,
        output([{ toolName: "createDiagram", input: { diagram: flatGroups } }]),
    ) < 1,
    "missing group nesting is penalized",
);

// --- creation: flowchart ---------------------------------------------------------

const flowCase = getCase("creation-flowchart-login-retry");
const flowSpec = {
    type: "flowchart",
    diagramId: "login-flow",
    nodes: [
        { id: "start", label: "Start", kind: "start" },
        { id: "enter", label: "Enter Credentials", kind: "io" },
        { id: "valid", label: "Valid?", kind: "decision" },
        { id: "dashboard", label: "Show Dashboard" },
        { id: "inc", label: "Increment Failed Attempts" },
        { id: "attempts", label: "Attempts < 3?", kind: "decision" },
        { id: "lock", label: "Lock Account" },
        { id: "end", label: "End", kind: "end" },
    ],
    edges: [
        { from: "start", to: "enter" },
        { from: "enter", to: "valid" },
        { from: "valid", to: "dashboard", label: "yes" },
        { from: "valid", to: "inc", label: "no" },
        { from: "inc", to: "attempts" },
        { from: "attempts", to: "enter", label: "yes" },
        { from: "attempts", to: "lock", label: "no" },
        { from: "dashboard", to: "end" },
        { from: "lock", to: "end" },
    ],
};
assert.equal(
    score(
        diagramScorer,
        flowCase,
        output([{ toolName: "createDiagram", input: { diagram: flowSpec } }]),
    ),
    1,
    "good flowchart spec",
);
const unlabeledBranches = {
    ...flowSpec,
    edges: flowSpec.edges.map(({ from, to }) => ({ from, to })),
};
assert.ok(
    score(
        diagramScorer,
        flowCase,
        output([
            {
                toolName: "createDiagram",
                input: { diagram: unlabeledBranches },
            },
        ]),
    ) < 1,
    "unlabeled decision branches are penalized",
);

// --- creation: sequence ------------------------------------------------------------

const sequenceCase = getCase("creation-sequence-self-call-async");
const sequenceSpec = {
    type: "sequence",
    diagramId: "place-order",
    participants: [
        { id: "client", label: "Client", kind: "actor" },
        { id: "orders", label: "Order Service" },
        { id: "broker", label: "Message Broker" },
    ],
    messages: [
        { from: "client", to: "orders", label: "POST /orders" },
        { from: "orders", to: "orders", label: "validate order" },
        { from: "orders", to: "broker", label: "OrderCreated", kind: "async" },
        { from: "orders", to: "client", label: "201 Created", kind: "reply" },
    ],
};
assert.equal(
    score(
        diagramScorer,
        sequenceCase,
        output([
            { toolName: "createDiagram", input: { diagram: sequenceSpec } },
        ]),
    ),
    1,
    "good sequence spec",
);
const reorderedSequence = {
    ...sequenceSpec,
    messages: [sequenceSpec.messages[3], ...sequenceSpec.messages.slice(0, 3)],
};
assert.ok(
    score(
        diagramScorer,
        sequenceCase,
        output([
            {
                toolName: "createDiagram",
                input: { diagram: reorderedSequence },
            },
        ]),
    ) < 1,
    "out-of-order messages are penalized",
);

// --- editing -------------------------------------------------------------------------

const renameCase = getCase("editing-rename-node-keep-id");
const renameSeed = renameCase.seed!.diagram;
assert.equal(renameSeed.type, "architecture");
const renamedSpec = {
    ...renameSeed,
    nodes: renameSeed.nodes.map((node) =>
        node.id === "worker" ? { ...node, label: "Queue Consumer" } : node,
    ),
};
const goodRename = output([
    { toolName: "updateDiagram", input: { diagram: renamedSpec } },
]);
for (const scorer of [routingScorer, schemaScorer, editingScorer]) {
    assert.equal(
        score(scorer, renameCase, goodRename),
        1,
        `good rename: ${scorer.name}`,
    );
}

const renameChangedId = output([
    {
        toolName: "updateDiagram",
        input: {
            diagram: {
                ...renameSeed,
                nodes: renameSeed.nodes.map((node) =>
                    node.id === "worker"
                        ? {
                              ...node,
                              id: "queue-consumer",
                              label: "Queue Consumer",
                          }
                        : node,
                ),
                edges: [
                    { from: "api", to: "job-queue" },
                    { from: "job-queue", to: "queue-consumer" },
                ],
            },
        },
    },
]);
assert.ok(
    score(editingScorer, renameCase, renameChangedId) < 1,
    "changing the id on rename is penalized",
);

const deleteAndRecreate = output([
    { toolName: "deleteDiagram", input: { diagramId: "job-pipeline" } },
    { toolName: "createDiagram", input: { diagram: renamedSpec } },
]);
assert.ok(
    score(editingScorer, renameCase, deleteAndRecreate) < 0.5,
    "delete + recreate is penalized",
);
assert.ok(score(routingScorer, renameCase, deleteAndRecreate) < 1);

const clearAndRecreate = output([
    { toolName: "clearCanvas", input: {} },
    { toolName: "createDiagram", input: { diagram: renamedSpec } },
]);
assert.ok(
    score(editingScorer, renameCase, clearAndRecreate) < 0.5,
    "clear + recreate is penalized",
);

const unrequestedRelayout = output([
    {
        toolName: "updateDiagram",
        input: { diagram: renamedSpec, relayout: true },
    },
]);
assert.ok(
    score(editingScorer, renameCase, unrequestedRelayout) < 1,
    "unrequested relayout is penalized",
);

const wrongDiagramId = output([
    {
        toolName: "updateDiagram",
        input: { diagram: { ...renamedSpec, diagramId: "other" } },
    },
]);
assert.ok(
    score(editingScorer, renameCase, wrongDiagramId) < 1,
    "diagramId must be reused",
);

const removeCase = getCase("editing-remove-node");
const removeSeed = removeCase.seed!.diagram;
assert.equal(removeSeed.type, "architecture");
const goodRemoval = output([
    {
        toolName: "updateDiagram",
        input: {
            diagram: {
                ...removeSeed,
                nodes: removeSeed.nodes.filter((node) => node.id !== "cache"),
                edges: [{ from: "api", to: "db", label: "SQL" }],
            },
        },
    },
]);
assert.equal(
    score(editingScorer, removeCase, goodRemoval),
    1,
    "good node removal",
);
const danglingRemoval = output([
    {
        toolName: "updateDiagram",
        input: {
            diagram: {
                ...removeSeed,
                nodes: removeSeed.nodes.filter((node) => node.id !== "cache"),
            },
        },
    },
]);
assert.ok(
    score(editingScorer, removeCase, danglingRemoval) < 1,
    "dangling edges after removal fail",
);

const tidyCase = getCase("editing-tidy-up-relayout");
const tidySeed = tidyCase.seed!.diagram;
assert.equal(
    score(
        editingScorer,
        tidyCase,
        output([
            {
                toolName: "updateDiagram",
                input: { diagram: tidySeed, relayout: true },
            },
        ]),
    ),
    1,
    "tidy-up with relayout",
);
assert.ok(
    score(
        editingScorer,
        tidyCase,
        output([{ toolName: "updateDiagram", input: { diagram: tidySeed } }]),
    ) < 1,
    "tidy-up without relayout is penalized",
);

const deleteCase = getCase("editing-delete-diagram");
assert.equal(
    score(
        editingScorer,
        deleteCase,
        output([
            { toolName: "deleteDiagram", input: { diagramId: "page-fetch" } },
        ]),
    ),
    1,
    "delete the right diagram",
);
assert.ok(
    score(
        editingScorer,
        deleteCase,
        output([{ toolName: "clearCanvas", input: {} }]),
    ) < 1,
    "clearCanvas instead of deleteDiagram is penalized",
);

const clearCase = getCase("editing-clear-canvas");
assert.equal(
    score(
        editingScorer,
        clearCase,
        output([{ toolName: "clearCanvas", input: {} }]),
    ),
    1,
);
assert.ok(
    score(
        editingScorer,
        clearCase,
        output([
            {
                toolName: "deleteDiagram",
                input: { diagramId: "client-server" },
            },
        ]),
    ) < 1,
    "deleting individually instead of clearing is penalized",
);

const addMessageCase = getCase("editing-sequence-add-message");
const loginSeed = addMessageCase.seed!.diagram;
assert.equal(loginSeed.type, "sequence");
const withAnalytics = {
    ...loginSeed,
    participants: [
        ...loginSeed.participants,
        { id: "analytics", label: "Analytics" },
    ],
    messages: [
        ...loginSeed.messages.slice(0, 5),
        {
            from: "web",
            to: "analytics",
            label: "login succeeded",
            kind: "async",
        },
        loginSeed.messages[5],
    ],
};
assert.equal(
    score(
        editingScorer,
        addMessageCase,
        output([
            { toolName: "updateDiagram", input: { diagram: withAnalytics } },
        ]),
    ),
    1,
    "good sequence message insertion",
);
const analyticsTooEarly = {
    ...withAnalytics,
    messages: [withAnalytics.messages[5], ...loginSeed.messages],
};
assert.ok(
    score(
        editingScorer,
        addMessageCase,
        output([
            {
                toolName: "updateDiagram",
                input: { diagram: analyticsTooEarly },
            },
        ]),
    ) < 1,
    "message inserted at the wrong position is penalized",
);

// --- research / response / schema --------------------------------------------------

const researchCase = getCase("research-web-current-version");
assert.equal(
    score(
        researchScorer,
        researchCase,
        output([
            {
                toolName: "webSearchTool",
                input: { query: "current stable React version", maxResults: 5 },
            },
        ]),
    ),
    1,
);

const responseCase = getCase("routing-non-canvas-question");
const answer = output(
    [],
    "Horizontal scaling adds machines; vertical scaling adds resources to one machine.",
);
assert.equal(score(responseScorer, responseCase, answer), 1);
assert.equal(score(routingScorer, responseCase, answer), 1);
assert.ok(
    score(
        routingScorer,
        responseCase,
        output([
            { toolName: "createDiagram", input: { diagram: threeTierSpec } },
        ]),
    ) < 1,
    "drawing for a pure question is penalized",
);

const invalidSchema = output([
    {
        toolName: "createDiagram",
        input: {
            diagram: { type: "architecture", diagramId: "Bad Id", nodes: [] },
        },
    },
]);
assert.equal(
    score(schemaScorer, threeTierCase, invalidSchema),
    0,
    "invalid createDiagram input is caught",
);
assert.equal(score(diagramScorer, threeTierCase, invalidSchema), 0);

const legacyTool = output([
    { toolName: "drawElements", input: { elements: [] } },
]);
assert.equal(
    score(schemaScorer, threeTierCase, legacyTool),
    0,
    "removed tools are rejected",
);

const invalidUpdate = output([
    {
        toolName: "updateDiagram",
        input: { diagram: renamedSpec, relayout: "yes" },
    },
]);
assert.equal(
    score(schemaScorer, renameCase, invalidUpdate),
    0,
    "invalid updateDiagram input is caught",
);

console.log(
    `Validated ${cases.length} eval cases across ${suites.length} suites; scorer smoke tests passed.`,
);
