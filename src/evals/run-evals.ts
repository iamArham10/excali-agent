import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { EvalResult, type TestCase } from "./types.ts";
import { generateText, stepCountIs } from "ai";
import { groq } from "@ai-sdk/groq";
import { SYSTEM_INSTRUCTIONS } from "./system-prompt.ts";
import { tools } from "../server/tools.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));

const goldenPrompts: TestCase[] = JSON.parse(
    readFileSync(join(__dirname, "./dataset/golden-dataset.json"), "utf-8"),
);

async function runTest(testCase: TestCase): Promise<EvalResult> {
    const startTime = Date.now();
    try {
        const result = await generateText({
            model: groq("openai/gpt-oss-120b"),
            prompt: testCase.input,
            instructions: SYSTEM_INSTRUCTIONS,
            tools: tools,
            stopWhen: stepCountIs(5),
        });
        const elements: unknown[] = [];
        for (const toolResult of result.toolResults) {
            if (toolResult.toolName === "drawElements") {
                const output = toolResult.output as {
                    elements?: unknown[];
                };
                if (Array.isArray(output?.elements)) {
                    elements.push(...output.elements);
                }
            }
        }

        return {
            testCaseId: testCase.id,
            input: testCase.input,
            response: result.output,
            elements: elements,
            durationMs: Date.now() - startTime,
            error: undefined,
        };
    } catch (error) {
        return {
            testCaseId: testCase.id,
            input: testCase.input,
            response: "",
            elements: [],
            durationMs: Date.now() - startTime,
            error: error instanceof Error ? error.message : String(error),
        };
    }
}

async function main() {
    const startTime = Date.now();
    console.log("Starting evaluation...");
    const results: EvalResult[] = [];
    for (const testCase of goldenPrompts) {
        console.log("Running Test Case: ", testCase.id);
        const result = await runTest(testCase);

        await new Promise((resolve) => setTimeout(resolve, 1000));
        console.log(
            `The following number of elements were created: ${result.elements.length}`,
        );
        console.log(
            `Ran Test Case ${testCase.id} of type ${testCase.category} in ${result.durationMs}ms`,
        );
        results.push(result);
    }

    // average duration
    const averageDuration =
        results.reduce((acc, result) => acc + result.durationMs, 0) /
        results.length;
    console.log(`Average duration: ${averageDuration}ms`);

    // storing results to output.json
    const outputPath = join(__dirname, "output.json");
    writeFileSync(outputPath, JSON.stringify(results, null, 2));
    console.log(`Results saved to ${outputPath}`);
}

main().catch((error) => {
    console.error(error);
});
