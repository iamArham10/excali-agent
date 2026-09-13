# Evaluation suite

The evals are split by capability so every dataset is scored only by relevant metrics.

| Suite | Dataset | What it measures | Scorers |
| --- | --- | --- | --- |
| Routing | `datasets/routing.json` | Tool choice, no-tool behavior, read-before-edit, destructive actions | routing, schema, response |
| Creation | `datasets/creation.json` | Requested nodes/edges, labels, IDs, grid alignment, overlap, arrow binding and endpoints | routing, schema, semantics, geometry |
| Editing | `datasets/editing.json` | Partial updates, ID reuse, preservation, deletion cascades, clear, state inspection | routing, schema, stateful editing |
| Mermaid | `datasets/mermaid.json` | Editable flowchart syntax, direction, labels, arrows, subgraphs | routing, schema, Mermaid quality |
| Research | `datasets/research.json` | Web vs internal retrieval, query specificity, result limits, unnecessary search | routing, schema, research query |

## Commands

```bash
# Offline: validates every dataset and smoke-tests scorer behavior.
npm test

# Live Braintrust evals (requires OPENAI_API_KEY and BRAINTRUST_API_KEY).
npm run eval

# Run one live suite.
EVAL_SUITE=creation npm run eval

# Optional live-run controls.
EVAL_CONCURRENCY=1 EVAL_DELAY_MS=1000 npm run eval
```

Valid values for `EVAL_SUITE` are `routing`, `creation`, `editing`, `mermaid`, `research`, and `all`.

## Dataset principles

- Expectations describe semantics and invariants, not exact element-array ordering.
- Routing uses required and forbidden tools instead of demanding one brittle exact sequence.
- Stateful cases seed a valid prior tool interaction and assert reuse of known element IDs.
- Negative cases ensure the agent does not mutate the canvas or invoke retrieval unnecessarily.
- Creation geometry is scored separately from semantic completeness, making failures actionable.
- All emitted tool inputs are validated against the production Zod schemas.

## Known boundary

These evals inspect model tool calls. They do not execute browser-side Excalidraw mutations, so they cannot prove the final rendered scene matches the calls. Browser execution and rendered-scene diffs should be added as an integration suite if the canvas service is made runnable in a test DOM.
