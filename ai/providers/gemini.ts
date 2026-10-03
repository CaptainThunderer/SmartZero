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

export async function callGeminiApi(
  systemPrompt: string,
  userPrompt: string,
  modelOverride?: string,
  timeoutMs = 25000
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const model = modelOverride || process.env.AI_MODEL || process.env.GEMINI_MODEL || "gemini-1.5-flash";
  const baseUrl = process.env.GEMINI_BASE_URL || "https://generativelanguage.googleapis.com/v1beta";
  const url = `${baseUrl}/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const bodyPayload: Record<string, unknown> = {
    contents: [
      {
        role: "user",
        parts: [{ text: userPrompt }],
      },
    ],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 2048,
    },
  };

  if (systemPrompt) {
    bodyPayload.systemInstruction = {
      parts: [{ text: systemPrompt }],
    };
  }

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(bodyPayload),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => "");
    throw new Error(`Gemini API error (status ${res.status}): ${errorText.slice(0, 200)}`);
  }

  const data = await res.json();
  const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!candidateText || typeof candidateText !== "string") {
    throw new Error("Gemini returned empty or malformed candidate parts");
  }

  return candidateText.trim();
}

export const geminiProvider: AIProvider = {
  name: "gemini",

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

      const raw = await callGeminiApi(systemPrompt, input);
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
    return await callGeminiApi(
      "You are SmartZero, a DSA tutor. Give one concise Socratic hint for a DSA learner. Do not reveal the full answer. Plain text only.",
      JSON.stringify(context)
    );
  },
};
