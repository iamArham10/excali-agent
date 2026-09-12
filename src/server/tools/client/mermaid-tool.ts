import { tool } from "ai";
import { z } from "zod";

export const drawDiagramUsingMermaid = tool({
    description: `Draw a diagram on the Excalidraw canvas by generating Mermaid syntax.

IMPORTANT CONSTRAINTS — only flowchart diagrams convert to real, editable Excalidraw elements. Anything else renders as a flat, non-editable image, so you MUST follow these rules:

1. Diagram type: ALWAYS use "flowchart" (e.g. "flowchart TD" or "flowchart LR"). Never use sequenceDiagram, classDiagram, erDiagram, gitGraph, stateDiagram, or any other Mermaid diagram type — they render as static images, not editable shapes.

2. Node shapes: ONLY use these, which map to real Excalidraw shapes:
   - [Text] -> rectangle
   - (Text) -> ellipse/rounded
   - ((Text)) -> circle
   - {Text} -> diamond
   Do NOT use subroutine [[ ]], cylindrical [( )], asymmetric > ], hexagon {{ }}, parallelogram [/ /], or trapezoid [/ \\] — these all silently fall back to a plain rectangle, so avoid them entirely rather than relying on them for meaning.

3. Text: use plain text only in node labels and edge labels. Do NOT use Markdown formatting (bold/italic) or FontAwesome icons (e.g. "fa:fa-camera") — neither is supported and both fall back to plain text or are dropped.

4. Arrows: use standard arrows (-->) and labeled arrows (-->|label|). Avoid cross-style arrows (x--x) — they fall back to a bar arrowhead.

5. Grouping: use "subgraph name ... end" to group related nodes when it helps organize the diagram — this is fully supported and renders as a real grouped container.

Output only the raw Mermaid flowchart syntax, with no surrounding markdown code fences or commentary.`,
    inputSchema: z.object({
        mermaidString: z
            .string()
            .describe(
                "Valid Mermaid flowchart syntax only (flowchart TD/LR/etc). Use only [], (), (()), {} node shapes, plain text labels, standard arrows, and subgraph...end for grouping. No other Mermaid diagram types or shapes.",
            ),
    }),
});
