import {DSATaskSchema, AIResponseSchema, type DSATask} from "./schemas";
import {lessonFromId} from "../engine/lessons";
import type {AIProvider} from "./provider";
const base=process.env.FEATHERLESS_BASE_URL||"https://api.featherless.ai/v1";
const model=process.env.FEATHERLESS_MODEL||"Qwen/Qwen3-32B";
async function chat(system: string, user: string) {
  const key = process.env.FEATHERLESS_API_KEY;
  if (!key) throw new Error("FEATHERLESS_API_KEY is not configured");
  const r = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
      temperature: 0.2,
      max_tokens: 1500
    }),
    signal: AbortSignal.timeout(25000)
  });
  if (!r.ok) throw new Error(`Featherless request failed: ${r.status}`);
  const data = await r.json();
  const choice = data?.choices?.[0];
  return (choice?.message?.content || choice?.message?.reasoning || "").trim();
}

function parseJson(text: string) {
  // Extract JSON block if surrounded by markdown or commentary
  const match = text.match(/\{[\s\S]*\}/);
  if (match) {
    return JSON.parse(match[0]);
  }
  let cleaned = text.trim();
  if (cleaned.startsWith("```json")) cleaned = cleaned.slice(7);
  else if (cleaned.startsWith("```")) cleaned = cleaned.slice(3);
  if (cleaned.endsWith("```")) cleaned = cleaned.slice(0, -3);
  return JSON.parse(cleaned.trim());
}

import { extractNumbers } from "../agent/nlu";

export const featherlessProvider: AIProvider = {
  async interpretQuestion(input: string) {
    const raw = await chat(
      "You are SmartZero, a DSA teaching planner. Output ONLY a valid JSON object with keys: lessonId, dataStructure, algorithm, pattern, objective, difficulty. lessonId must be one of: second-max, binary-search, bst-insert, linked-list-reverse, bubble-sort, selection-sort, insertion-sort, merge-sort, quick-sort, heap-sort, counting-sort, radix-sort, bucket-sort, graph-bfs, graph-dfs, stack-ops, queue-ops, hash-table-ops, explain-arrays, explain-two-pointers, explain-sliding-window, explain-set, explain-dp, explain-recursion, explain-backtracking, compare-array-vs-linked-list, compare-bfs-vs-dfs, explain-complexity, or null. Do not invent unsupported lesson IDs.",
      input
    );
    const parsed = AIResponseSchema.parse(parseJson(raw));
    const customData = extractNumbers(input);
    return DSATaskSchema.parse({
      ...parsed,
      rawQuestion: input,
      inputData: customData ?? undefined,
    });
  },
  async createLesson(task) {
    return task.lessonId ? lessonFromId(task.lessonId, task.inputData) : null;
  },
  async generateHint(context) {
    return await chat(
      "You are SmartZero, a DSA tutor. Give one concise Socratic hint for a DSA learner. Do not reveal the full answer. Plain text only.",
      JSON.stringify(context)
    );
  }
};
