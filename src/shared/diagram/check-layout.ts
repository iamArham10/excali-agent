// Offline regression checks for the diagram layout engine: `npm test`.
import assert from "node:assert/strict";

import type { ArchitectureSpec, FlowchartSpec, ErSpec, ClassSpec } from "../schemas/diagram-schema";
import { layoutGraph, layoutSequence, type Box } from "./layout";
import { validateDiagramSpec } from "./validate";

const overlaps = (a: Box, b: Box) =>
    !(a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y);
const contains = (outer: Box, inner: Box) =>
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.width <= outer.x + outer.width &&
    inner.y + inner.height <= outer.y + outer.height;

async function checkGraph(spec: ArchitectureSpec | FlowchartSpec | ErSpec | ClassSpec, name: string) {
    assert.deepEqual(validateDiagramSpec(spec).errors, [], `${name}: spec should be valid`);
    const layout = await layoutGraph(spec, { origin: { x: 100, y: 100 } });

    for (let i = 0; i < layout.nodes.length; i++) {
        for (let j = i + 1; j < layout.nodes.length; j++) {
            const [a, b] = [layout.nodes[i], layout.nodes[j]];
            assert.ok(!overlaps(a.box, b.box), `${name}: nodes ${a.id} and ${b.id} overlap`);
        }
    }
    for (const node of layout.nodes) {
        if (!node.group) continue;
        const group = layout.groups.find((g) => g.id === node.group)!;
        assert.ok(contains(group.box, node.box), `${name}: ${node.id} is outside group ${group.id}`);
    }
    for (const edge of layout.edges) {
        assert.ok(edge.route && edge.route.length >= 2, `${name}: edge ${edge.id} has no route`);
        edge.route!.slice(1).forEach(([x, y], i) => {
            const [px, py] = edge.route![i];
            assert.ok(x === px || y === py, `${name}: edge ${edge.id} has a diagonal segment`);
        });
    }
    return layout;
}

// Regression: a single group plus considerModelOrder crashed elkjs ("reading 'a'").
const urlShortener: ArchitectureSpec = {
    type: "architecture",
    diagramId: "url-shortener",
    title: "URL Shortener Architecture",
    groups: [{ id: "vpc", label: "VPC" }],
    nodes: [
        { id: "web", label: "Web Client", kind: "client" },
        { id: "gw", label: "API Gateway", kind: "gateway", group: "vpc" },
        { id: "svc", label: "Shortener Service", group: "vpc" },
        { id: "redis", label: "Redis Cache", kind: "cache", group: "vpc" },
        { id: "pg", label: "Postgres", kind: "database", group: "vpc" },
        { id: "kafka", label: "Kafka", kind: "queue", group: "vpc" },
        { id: "analytics", label: "Analytics Pipeline", group: "vpc" },
    ],
    edges: [
        { from: "web", to: "gw", label: "HTTPS" },
        { from: "gw", to: "svc", label: "REST" },
        { from: "svc", to: "redis", label: "GET/SET" },
        { from: "svc", to: "pg", label: "SQL" },
        { from: "svc", to: "kafka", label: "click events", style: "dashed" },
        { from: "kafka", to: "analytics", label: "consume", style: "dashed" },
    ],
};
const shortenerLayout = await checkGraph(urlShortener, "url-shortener");

await checkGraph(
    {
        type: "architecture",
        diagramId: "nested",
        groups: [
            { id: "vpc", label: "VPC" },
            { id: "private", label: "Private subnet", parent: "vpc" },
        ],
        nodes: [
            { id: "web", label: "Web" },
            { id: "gw", label: "Gateway", kind: "gateway", group: "vpc" },
            { id: "api", label: "API", group: "private" },
            { id: "db", label: "DB", kind: "database", group: "private" },
        ],
        edges: [
            { from: "web", to: "gw" },
            { from: "gw", to: "api" },
            { from: "api", to: "db" },
            { from: "web", to: "db", label: "direct" },
            { from: "db", to: "db", label: "replication" },
        ],
    },
    "nested-groups",
);

await checkGraph(
    {
        type: "flowchart",
        diagramId: "retry",
        nodes: [
            { id: "start", label: "Start", kind: "start" },
            { id: "charge", label: "Charge card" },
            { id: "ok", label: "Succeeded?", kind: "decision" },
            { id: "retry", label: "Retries left?", kind: "decision" },
            { id: "done", label: "Done", kind: "end" },
            { id: "refund", label: "Refund", kind: "end" },
        ],
        edges: [
            { from: "start", to: "charge" },
            { from: "charge", to: "ok" },
            { from: "ok", to: "done", label: "yes" },
            { from: "ok", to: "retry", label: "no" },
            { from: "retry", to: "charge", label: "yes" },
            { from: "retry", to: "refund", label: "no" },
        ],
    },
    "flowchart-loop",
);

// Incremental layout keeps pinned nodes exactly where they are.
const pinned = new Map(
    shortenerLayout.nodes.map((node) => [node.id, { ...node.box, x: node.box.x + 300 }]),
);
const updated = await layoutGraph(
    {
        ...urlShortener,
        nodes: [...urlShortener.nodes, { id: "cdn", label: "CDN", kind: "external" }],
        edges: [...(urlShortener.edges ?? []), { from: "web", to: "cdn" }],
    },
    { origin: { x: 0, y: 0 }, pinned },
);
for (const node of updated.nodes) {
    if (pinned.has(node.id)) assert.deepEqual(node.box, pinned.get(node.id), `${node.id} moved`);
}
const cdn = updated.nodes.find((node) => node.id === "cdn")!;
for (const node of updated.nodes) {
    if (node.id !== "cdn") assert.ok(!overlaps(cdn.box, node.box), `cdn overlaps ${node.id}`);
}

// Randomised hierarchy fuzzing: ELK must never throw on valid specs.
let seed = 42;
const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
for (let run = 0; run < 150; run++) {
    const groupCount = Math.floor(random() * 4);
    const groups = Array.from({ length: groupCount }, (_, i) => ({
        id: `g${i}`,
        label: `Group ${i}`,
        ...(i > 0 && random() < 0.4 ? { parent: `g${Math.floor(random() * i)}` } : {}),
    }));
    const nodeCount = 2 + Math.floor(random() * 10);
    const nodes = Array.from({ length: nodeCount }, (_, i) => {
        const group = Math.floor(random() * (groupCount + 1)) - 1;
        return { id: `n${i}`, label: `Node ${i}`, ...(group >= 0 ? { group: `g${group}` } : {}) };
    });
    const edges = Array.from({ length: Math.floor(random() * nodeCount * 1.5) }, (_, i) => ({
        id: `e${i}`,
        from: `n${Math.floor(random() * nodeCount)}`,
        to: `n${Math.floor(random() * nodeCount)}`,
        ...(random() < 0.5 ? { label: "calls" } : {}),
    }));
    const spec: ArchitectureSpec = {
        type: "architecture",
        diagramId: `fuzz-${run}`,
        direction: random() < 0.5 ? "LR" : "TB",
        groups,
        nodes,
        edges,
    };
    await layoutGraph(spec, { origin: { x: 0, y: 0 } }).catch((error) => {
        throw new Error(`fuzz run ${run} crashed: ${error}\n${JSON.stringify(spec)}`);
    });
}

const sequence = layoutSequence(
    {
        type: "sequence",
        diagramId: "seq",
        participants: [
            { id: "a", label: "Client" },
            { id: "b", label: "Server" },
        ],
        messages: [
            { from: "a", to: "b", label: "a fairly long request label that needs room" },
            { from: "b", to: "b", label: "validate" },
            { from: "b", to: "a", label: "200 OK", kind: "reply" },
        ],
    },
    { x: 0, y: 0 },
);
const [client, server] = sequence.participants;
assert.ok(server.lifeline.x - client.lifeline.x >= 300, "columns widen to fit message labels");

// ER Diagram layout test
await checkGraph(
    {
        type: "er",
        diagramId: "ecommerce-er",
        title: "E-Commerce ER Diagram",
        nodes: [
            {
                id: "user",
                label: "User\n──\nPK id: int\nemail: varchar\nname: varchar",
                kind: "entity",
            },
            {
                id: "order",
                label: "Order\n──\nPK id: int\nFK user_id: int\ntotal: decimal\nstatus: varchar",
                kind: "entity",
            },
            {
                id: "order-item",
                label: "OrderItem\n──\nPK id: int\nFK order_id: int\nFK product_id: int\nquantity: int",
                kind: "weak-entity",
            },
            {
                id: "product",
                label: "Product\n──\nPK id: int\nname: varchar\nprice: decimal",
                kind: "entity",
            },
        ],
        edges: [
            { from: "user", to: "order", label: "1:N places" },
            { from: "order", to: "order-item", label: "1:N contains" },
            { from: "product", to: "order-item", label: "1:N listed in" },
        ],
    },
    "er-diagram",
);

// Class Diagram layout test
await checkGraph(
    {
        type: "class",
        diagramId: "payment-classes",
        title: "Payment Domain Classes",
        nodes: [
            {
                id: "payment-gateway",
                label: "PaymentGateway\n──\n+ process(amount: float): bool\n+ refund(id: string): bool",
                kind: "interface",
            },
            {
                id: "stripe-gateway",
                label: "StripeGateway\n──\n- apiKey: string\n──\n+ process(amount: float): bool\n+ refund(id: string): bool",
                kind: "class",
            },
            {
                id: "order-mgr",
                label: "OrderManager\n──\n- gateway: PaymentGateway\n──\n+ checkout(orderId: string): void",
                kind: "class",
            },
            {
                id: "payment-status",
                label: "PaymentStatus\n──\nPENDING\nCOMPLETED\nFAILED",
                kind: "enum",
            },
        ],
        edges: [
            { from: "stripe-gateway", to: "payment-gateway", label: "implements", style: "dashed" },
            { from: "order-mgr", to: "payment-gateway", label: "uses", style: "dashed" },
            { from: "order-mgr", to: "payment-status", label: "references" },
        ],
    },
    "class-diagram",
);

console.log("Layout checks passed (fixtures, incremental placement, 150 fuzzed hierarchies, sequence, ER, class).");
