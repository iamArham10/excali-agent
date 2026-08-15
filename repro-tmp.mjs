import { readFileSync } from "node:fs";
import { streamText, isStepCount } from "ai";
import { groq } from "@ai-sdk/groq";
import tools from "/home/arham/Github/excalidraw-agent/src/server/tools.ts";

const vars = readFileSync("/home/arham/Github/excalidraw-agent/.dev.vars", "utf8");
const key = vars.match(/^GROQ_API_KEY=(.*)$/m)?.[1];
process.env.GROQ_API_KEY = key;

const prompt = process.argv[2] ?? "Draw a flowchart: user logs in, checks email, logs out.";

try {
  const result = streamText({
    model: groq("openai/gpt-oss-120b"),
    messages: [{ role: "user", content: prompt }],
    tools,
    stopWhen: isStepCount(2),
    onError: (e) => console.log("onError:", e.message),
  });

  const chunks = [];
  for await (const chunk of result.fullStream) {
    if (chunk.type === "tool-call") {
      chunks.push(`tool-call: ${chunk.toolName} args=${chunk.args}`);
    }
    if (chunk.type === "error") {
      console.log("stream error chunk:", chunk.error?.message);
    }
  }
  console.log(chunks.length ? chunks.join("\n") : "no tool calls");
} catch (err) {
  console.log("THREW:", err.constructor.name);
  console.log(JSON.stringify(err, Object.getOwnPropertyNames(err), 2));
  console.log("raw body:", err.body);
}
