import type { ModelMessage } from "ai";
import type { DiagramSpec } from "../../shared/schemas/diagram-schema";
import { TOOL_NAMES } from "../../shared/tool-names";
import type { EvalCase } from "../types";

function describe(spec: DiagramSpec): string {
    if (spec.type === "sequence") {
        return `${spec.participants.length} participants, ${spec.messages.length} messages`;
    }
    return `${spec.nodes.length} nodes, ${spec.edges?.length ?? 0} edges`;
}

export function buildMessages(testCase: EvalCase): ModelMessage[] {
    if (!testCase.seed) {
        return [{ role: "user", content: testCase.input }];
    }

    const toolCallId = `seed-${testCase.id}`;
    const { diagram } = testCase.seed;

    return [
        { role: "user", content: testCase.seed.priorPrompt },
        {
            role: "assistant",
            content: [
                {
                    type: "tool-call",
                    toolCallId,
                    toolName: TOOL_NAMES.CREATE_DIAGRAM,
                    input: { diagram },
                },
            ],
        },
        {
            role: "tool",
            content: [
                {
                    type: "tool-result",
                    toolCallId,
                    toolName: TOOL_NAMES.CREATE_DIAGRAM,
                    output: {
                        type: "json",
                        value: {
                            ok: true,
                            message: `created ${diagram.type} diagram '${diagram.diagramId}' (${describe(diagram)})`,
                        },
                    },
                },
            ],
        },
        { role: "assistant", content: testCase.seed.priorResponse },
        { role: "user", content: testCase.input },
    ];
}
