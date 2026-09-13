import type { EvalOutput, EvalToolCall } from "../types";

export type EvalElement = Record<string, unknown>;

export function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function getElements(call: EvalToolCall): EvalElement[] {
    if (!isRecord(call.input) || !Array.isArray(call.input.elements)) return [];
    return call.input.elements.filter(isRecord);
}

export function getCalls(output: EvalOutput, toolName: string): EvalToolCall[] {
    return output.toolCalls.filter((call) => call.toolName === toolName);
}

export function getDrawnElements(output: EvalOutput): EvalElement[] {
    return getCalls(output, "drawElements").flatMap(getElements);
}

export function getLabel(element: EvalElement): string | undefined {
    if (element.type === "text") {
        return typeof element.text === "string" ? element.text : undefined;
    }
    if (!isRecord(element.label)) return undefined;
    return typeof element.label.text === "string" ? element.label.text : undefined;
}

export function normalizeText(value: string): string {
    return value.trim().toLocaleLowerCase();
}

export function containsRequired(actual: unknown, required: unknown): boolean {
    if (Array.isArray(required)) {
        return (
            Array.isArray(actual) &&
            required.length === actual.length &&
            required.every((value, index) => containsRequired(actual[index], value))
        );
    }

    if (isRecord(required)) {
        return (
            isRecord(actual) &&
            Object.entries(required).every(([key, value]) =>
                containsRequired(actual[key], value),
            )
        );
    }

    return Object.is(actual, required);
}
