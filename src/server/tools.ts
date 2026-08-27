import { tool } from "ai";

import {
    DeleteElementsToolSchema,
    DrawElementsToolSchema,
    ModifyElementsToolSchema,
} from "./excali-schema";

const drawElements = tool({
    description:
        "Draw shapes, text, and arrows on the canvas. To connect shapes, an arrow " +
        "references only their ids in start.id and end.id; the canvas service " +
        "calculates all arrow coordinates and binding points.",
    inputSchema: DrawElementsToolSchema,
    execute: async ({ elements }) => {
        return { elements };
    },
});

const modifyElements = tool({
    description:
        "modify one or more elements on the canvas. use id to reference elements, and make sure to include type as well.",
    inputSchema: ModifyElementsToolSchema,
    execute: async ({ elements }) => {
        return {
            // strip out absent optional attributes so only actually-provided
            // fields are shipped to the client
            elements: elements.map((e) =>
                Object.fromEntries(
                    Object.entries(e).filter(
                        ([, value]) => value !== undefined,
                    ),
                ),
            ),
        };
    },
});

const deleteElements = tool({
    description:
        "delete one or more elements on the canvas. " +
        "Also deletes labels bound to the deleted elements and any arrows " +
        "connected to them.",
    inputSchema: DeleteElementsToolSchema,
    execute: async ({ elements }) => {
        return { elements };
    },
});

const tools = {
    drawElements,
    modifyElements,
    deleteElements,
};

export { tools };
