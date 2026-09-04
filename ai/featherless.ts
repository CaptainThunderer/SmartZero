import { DSATaskSchema, AIResponseSchema, type DSATask } from "./schemas";
import { lessonFromId } from "../engine/lessons";
import type { AIProvider } from "./provider";
import { getFallbackChain } from "./modelRouter";
import type { ModelTaskType } from "../types/dsa";
import { extractNumbers, interpretDSAQuery } from "../agent/nlu";

const BASE_URL = process.env.FEATHERLESS_BASE_URL || "https://api.featherless.ai/v1";

async function chatWithModel(system: string, user: string, modelId: string, timeoutMs = 25000): Promise<string> {
  const key = process.env.FEATHERLESS_API_KEY;
  if (!key) throw new Error("FEATHERLESS_API_KEY is not configured");

  const r = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: modelId,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.2,
      max_tokens: 1500,
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!r.ok) {
    throw new Error(`Featherless model ${modelId} returned status ${r.status}`);
  }

  const data = await r.json();
  const choice = data?.choices?.[0];
  return (choice?.message?.content || choice?.message?.reasoning || "").trim();
}

async function chatWithFallback(system: string, user: string, taskType: ModelTaskType = "TEXT_PROBLEM_SOLVING"): Promise<string> {
  const chain = await getFallbackChain(taskType);
  let lastError: unknown = null;

  for (const modelId of chain) {
    try {
      const response = await chatWithModel(system, user, modelId);
      if (response) return response;
    } catch (err) {
      lastError = err;
      // Fall through to next model in chain
    }
  }

  throw lastError || new Error("All models in fallback chain failed.");
}

function parseJson(text: string) {
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

export const featherlessProvider: AIProvider = {
  async interpretQuestion(input: string, context?: unknown) {
    const localTask = interpretDSAQuery(input, context as any);

    // If local NLU has identified a high-confidence problem, visual comparison, or code task, use it directly
    if (
      localTask.intent === "problem_solving" ||
      localTask.problemPlan ||
      localTask.customLesson ||
      localTask.intent === "compare" ||
      localTask.intent === "code_explanation" ||
      localTask.intent === "debugging" ||
      localTask.intent === "unsupported_non_dsa" ||
      localTask.lessonId
    ) {
      return localTask;
    }

    try {
      const raw = await chatWithFallback(
        `You are SmartZero, an expert programming, DSA, competitive programming, and computer science tutor.
Analyze the user's question or problem statement.
Output ONLY a valid JSON object with keys:
- intent: "problem_solving" | "visualize" | "explain" | "theory" | "implementation" | "trace" | "complexity" | "compare" | "debugging" | "code_explanation" | "clarification" | "unsupported_non_dsa"
- lessonId: ONLY specify one of the standard visual DSA lessons ('second-max', 'binary-search', 'bst-insert', 'linked-list-reverse', 'bubble-sort', 'selection-sort', 'insertion-sort', 'merge-sort', 'quick-sort', 'heap-sort', 'graph-bfs', 'graph-dfs', 'stack-ops', 'queue-ops', 'hash-table-ops') if the user's query is DIRECTLY that specific algorithm. For all other questions, mathematical word problems, arithmetic comparisons, competitive programming tasks, or custom problems, lessonId MUST BE null.
- dataStructure: string or null
- algorithm: string or null
- pattern: string or null
- objective: string
- difficulty: "Easy" | "Medium" | "Hard"
- explanation: comprehensive pedagogical explanation or walkthrough.`,
        input,
        "COMPLEX_REASONING"
      );

      const parsed = AIResponseSchema.parse(parseJson(raw));

      const validVisualLessons = new Set([
        "second-max",
        "binary-search",
        "bst-insert",
        "linked-list-reverse",
        "bubble-sort",
        "selection-sort",
        "insertion-sort",
        "merge-sort",
        "quick-sort",
        "heap-sort",
        "graph-bfs",
        "graph-dfs",
        "stack-ops",
        "queue-ops",
        "hash-table-ops",
      ]);

      if (parsed.lessonId && !validVisualLessons.has(parsed.lessonId)) {
        parsed.lessonId = null;
      }

      const customData = extractNumbers(input);
      return DSATaskSchema.parse({
        ...parsed,
        rawQuestion: input,
        inputData: customData ?? undefined,
      });
    } catch {
      return localTask;
    }
  },

  async createLesson(task) {
    return task.customLesson || (task.lessonId ? lessonFromId(task.lessonId, task.inputData) : null);
  },

  async generateHint(context) {
    return await chatWithFallback(
      "You are SmartZero, a DSA tutor. Give one concise Socratic hint for a DSA learner. Do not reveal the full answer. Plain text only.",
      JSON.stringify(context),
      "GENERAL_EXPLANATION"
    );
  },
};
