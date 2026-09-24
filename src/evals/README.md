# Evaluation suite

The evals are split by capability, and each dataset is scored only by the metrics that apply to it. The agent describes diagrams as semantic specs (`createDiagram` / `updateDiagram` / `deleteDiagram`). Layout is computed by code, so the evals check diagram meaning, not geometry.

| Suite    | Dataset                  | What it measures                                                                                                                                                                                         | Scorers                            |
| -------- | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| Routing  | `datasets/routing.json`  | Tool choice, no-tool behavior, read-before-edit, update-instead-of-recreate, destructive actions                                                                                                         | routing, schema, response          |
| Creation | `datasets/creation.json` | Diagram type (incl. inferred from wording), direction, nodes/kinds, labeled/dashed edges, nested groups, ordered sequence messages, self-calls, spec validity, whole diagram in one `createDiagram` call | routing, schema, diagram semantics |
| Editing  | `datasets/editing.json`  | Full-spec `updateDiagram` on the same `diagramId`, stable ids on rename, add/remove/recolor, `relayout` only when asked, no delete+recreate, `deleteDiagram`, `clearCanvas`                              | routing, schema, stateful editing  |
| Research | `datasets/research.json` | Web vs internal retrieval, query specificity, result limits, unnecessary search                                                                                                                          | routing, schema, research query    |

## Commands

```bash
# Offline: validates every dataset and seed spec and smoke-tests scorer behavior.
npm test

# Live Braintrust evals (requires OPENAI_API_KEY and BRAINTRUST_API_KEY).
npm run eval

# Run one live suite.
EVAL_SUITE=creation npm run eval

# Optional live-run controls.
EVAL_CONCURRENCY=1 EVAL_DELAY_MS=1000 npm run eval
```

Valid values for `EVAL_SUITE` are `routing`, `creation`, `editing`, `research`, and `all`.

## Dataset principles

- Expectations describe semantics, not exact specs. Nodes, participants, groups, and edges are matched by label using a case-insensitive substring match. A label can be an array of accepted alternatives, e.g. `["Postgres", "Database"]`. Model-chosen ids are never assumed, except in editing cases, where the ids come from the seed.
- A spec that fails the Zod schema or `validateDiagramSpec` (unknown node ids, duplicate ids, cyclic groups, ...) scores 0 on semantics, because the canvas would reject it. Validation warnings, such as unlabeled decision branches, count as one failed check unless `forbidWarnings` is `false`.
- Sequence messages are matched as an ordered subsequence, so extra messages in between are allowed.
- `maxNodes` penalizes invented components.
- Stateful cases seed a prior `createDiagram` call (`seed.diagram`) and its tool result. Editing expectations check reuse of `diagramId`, `preservedIds` (same id and the seed's label), `changedNodes`, present/absent labels, and the `relayout` flag. Absent counts as `false`.
- Routing uses required and forbidden tools instead of one fixed call sequence.
- Negative cases check that the agent doesn't change the canvas or run retrieval when it isn't needed.
- All emitted tool inputs are validated against the production Zod schemas.

## Known boundaries

- These evals inspect model tool calls. They don't run the browser-side renderer, so they can't prove the final scene is laid out well. Layout is deterministic code and should be unit-tested directly.
- Canvas tools are client-side (no server `execute`), so a live run stops after the first step that calls one. A case that needs `getCanvasState` followed by an edit can only check the read step. Editing cases therefore seed the current spec in the conversation.
