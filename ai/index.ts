import { fallbackProvider } from "./fallback";
import { featherlessProvider } from "./featherless";
import { interpretDSAQuery } from "../agent/nlu";
import type { AIProvider } from "./provider";

function resilient(primary: AIProvider): AIProvider {
  return {
    async interpretQuestion(input, context) {
      // If authoritative local NLU finds a high-confidence match (problem solving, comparison, code, debugging, or custom lesson), use it immediately!
      const local = interpretDSAQuery(input, context);
      if (
        local.intent === "problem_solving" ||
        local.intent === "compare" ||
        local.intent === "code_explanation" ||
        local.intent === "debugging" ||
        local.intent === "implementation" ||
        local.customLesson
      ) {
        return fallbackProvider.interpretQuestion(input, context);
      }
      try {
        return await primary.interpretQuestion(input, context);
      } catch {
        return await fallbackProvider.interpretQuestion(input, context);
      }
    },
    async createLesson(task) {
      try {
        return await primary.createLesson(task);
      } catch {
        return await fallbackProvider.createLesson(task);
      }
    },
    async generateHint(context) {
      try {
        return await primary.generateHint(context);
      } catch {
        return fallbackProvider.generateHint(context);
      }
    },
  };
}

export function getAIProvider() {
  return process.env.SMARTZERO_ENABLE_LIVE_AI !== "false" && !!process.env.FEATHERLESS_API_KEY
    ? resilient(featherlessProvider)
    : fallbackProvider;
}
