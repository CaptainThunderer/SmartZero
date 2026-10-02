import { DSATaskSchema, AIResponseSchema, type DSATask } from "../schemas";
import { lessonFromId } from "../../engine/lessons";
import type { AIProvider } from "../provider";
import { extractNumbers, interpretDSAQuery } from "../../agent/nlu";

const VALID_VISUAL_LESSONS = new Set([
  "second-max",
  "binary-search",
  "bst-insert",
  "linked-list-reverse",
  "max-subarray",
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

export async function callOpenRouterApi(
  systemPrompt: string,
  userPrompt: string,
  modelOverride?: string,
  timeoutMs = 25000
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not configured");
  }

  const model = modelOverride || process.env.AI_MODEL || process.env.OPENROUTER_MODEL || "meta-llama/llama-3.3-70b-instruct:free";
  const baseUrl = process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1";

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": "https://smartzero.app",
      "X-Title": "SmartZero",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.2,
      max_tokens: 1500,
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => "");
    throw new Error(`OpenRouter API error (status ${res.status}): ${errorText.slice(0, 200)}`);
  }

  const data = await res.json();
  const choice = data?.choices?.[0];
  const content = choice?.message?.content || choice?.message?.reasoning;
  if (!content || typeof content !== "string") {
    throw new Error("OpenRouter returned empty or malformed choice content");
  }

  return content.trim();
}

export const openrouterProvider: AIProvider = {
  name: "openrouter",

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
      const systemPrompt = `You are SmartZero, an expert programming, DSA, competitive programming, and computer science tutor.
Analyze the user's question or problem statement.
Output ONLY a valid JSON object with keys:
- intent: "problem_solving" | "visualize" | "explain" | "theory" | "implementation" | "trace" | "complexity" | "compare" | "debugging" | "code_explanation" | "clarification" | "unsupported_non_dsa"
- lessonId: ONLY specify one of the standard visual DSA lessons ('second-max', 'binary-search', 'bst-insert', 'linked-list-reverse', 'max-subarray', 'bubble-sort', 'selection-sort', 'insertion-sort', 'merge-sort', 'quick-sort', 'heap-sort', 'graph-bfs', 'graph-dfs', 'stack-ops', 'queue-ops', 'hash-table-ops') if the user's query is DIRECTLY that specific algorithm. For all other questions, mathematical word problems, arithmetic comparisons, competitive programming tasks, or custom problems, lessonId MUST BE null.
- dataStructure: string or null
- algorithm: string or null
- pattern: string or null
- objective: string
- difficulty: "Easy" | "Medium" | "Hard"
- explanation: comprehensive pedagogical explanation or walkthrough.`;

      const raw = await callOpenRouterApi(systemPrompt, input);
      const parsed = AIResponseSchema.parse(parseJson(raw));

      if (parsed.lessonId && !VALID_VISUAL_LESSONS.has(parsed.lessonId)) {
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
    return await callOpenRouterApi(
      "You are SmartZero, a DSA tutor. Give one concise Socratic hint for a DSA learner. Do not reveal the full answer. Plain text only.",
      JSON.stringify(context)
    );
  },
};
