import { fallbackProvider } from "./fallback";
import { featherlessProvider, chatWithFallback } from "./featherless";
import { geminiProvider, callGeminiApi } from "./providers/gemini";
import { openrouterProvider, callOpenRouterApi } from "./providers/openrouter";
import { interpretDSAQuery } from "../agent/nlu";
import type { AIProvider, AIProviderConfig, AIProviderName } from "./provider";

export { fallbackProvider, featherlessProvider, geminiProvider, openrouterProvider };
export type { AIProvider, AIProviderConfig, AIProviderName };

/**
 * Wraps a primary AI provider with deterministic fast-path and graceful fallback.
 * If local NLU has high confidence (standard DSA problem, code explanation, debugging, etc.),
 * it routes to deterministic execution immediately with zero network delay.
 * If external provider network calls fail, it seamlessly drops back to fallbackProvider.
 */
export function resilient(primary: AIProvider): AIProvider {
  return {
    name: primary.name ? `resilient(${primary.name})` : "resilient(provider)",

    async interpretQuestion(input, context) {
      const local = interpretDSAQuery(input, context);
      if (
        local.intent === "problem_solving" ||
        local.intent === "compare" ||
        local.intent === "code_explanation" ||
        local.intent === "debugging" ||
        local.intent === "implementation" ||
        local.customLesson ||
        local.lessonId
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

/**
 * Authoritative AI Provider Resolution Gateway
 * Resolves configured provider based on AI_PROVIDER environment variable or configuration.
 * Never throws — always falls back to deterministic engine when credentials or network are unavailable.
 */
export function resolveProvider(config?: AIProviderConfig): AIProvider {
  // If live AI is globally disabled or explicitly disabled for this invocation (e.g. during contest exams)
  if (process.env.SMARTZERO_ENABLE_LIVE_AI === "false" || config?.allowLiveAI === false) {
    return fallbackProvider;
  }

  const requested = (config?.provider || process.env.AI_PROVIDER || "").toLowerCase().trim();

  // 1. Explicit Gemini
  if (requested === "gemini") {
    if (process.env.GEMINI_API_KEY) {
      return resilient(geminiProvider);
    }
    return fallbackProvider;
  }

  // 2. Explicit OpenRouter
  if (requested === "openrouter") {
    if (process.env.OPENROUTER_API_KEY) {
      return resilient(openrouterProvider);
    }
    return fallbackProvider;
  }

  // 3. Explicit Featherless
  if (requested === "featherless") {
    if (process.env.FEATHERLESS_API_KEY) {
      return resilient(featherlessProvider);
    }
    return fallbackProvider;
  }

  // 4. Explicit Deterministic / Local Fallback
  if (requested === "deterministic" || requested === "fallback" || requested === "local") {
    return fallbackProvider;
  }

  // 5. Unspecified: Auto-detect available credentials in priority order
  if (!requested) {
    if (process.env.GEMINI_API_KEY) {
      return resilient(geminiProvider);
    }
    if (process.env.OPENROUTER_API_KEY) {
      return resilient(openrouterProvider);
    }
    if (process.env.FEATHERLESS_API_KEY) {
      return resilient(featherlessProvider);
    }
    return fallbackProvider;
  }

  // 6. Unknown provider requested -> safe fallback
  return fallbackProvider;
}

/**
 * Public AI Gateway entry point for SmartZero API routes and agent workflows.
 */
export function getAIProvider(config?: AIProviderConfig): AIProvider {
  return resolveProvider(config);
}

/**
 * Unifies raw text/JSON generation across available AI providers.
 * Enforces live AI safety (disabled when allowLiveAI is false or SMARTZERO_ENABLE_LIVE_AI is false).
 */
export async function generateAIText(
  systemPrompt: string,
  userPrompt: string,
  config?: AIProviderConfig
): Promise<string> {
  if (process.env.SMARTZERO_ENABLE_LIVE_AI === "false" || config?.allowLiveAI === false) {
    throw new Error("Live AI is disabled by policy.");
  }

  const requested = (config?.provider || process.env.AI_PROVIDER || "").toLowerCase().trim();

  // 1. Explicit Gemini
  if (requested === "gemini") {
    if (process.env.GEMINI_API_KEY) {
      return await callGeminiApi(systemPrompt, userPrompt, config?.model);
    }
    throw new Error("GEMINI_API_KEY is not configured");
  }

  // 2. Explicit OpenRouter
  if (requested === "openrouter") {
    if (process.env.OPENROUTER_API_KEY) {
      return await callOpenRouterApi(systemPrompt, userPrompt, config?.model);
    }
    throw new Error("OPENROUTER_API_KEY is not configured");
  }

  // 3. Explicit Featherless
  if (requested === "featherless") {
    if (process.env.FEATHERLESS_API_KEY) {
      return await chatWithFallback(systemPrompt, userPrompt);
    }
    throw new Error("FEATHERLESS_API_KEY is not configured");
  }

  // 4. Auto-detect available credentials in priority order
  if (!requested) {
    if (process.env.GEMINI_API_KEY) {
      return await callGeminiApi(systemPrompt, userPrompt, config?.model);
    }
    if (process.env.OPENROUTER_API_KEY) {
      return await callOpenRouterApi(systemPrompt, userPrompt, config?.model);
    }
    if (process.env.FEATHERLESS_API_KEY) {
      return await chatWithFallback(systemPrompt, userPrompt);
    }
  }

  throw new Error("No external AI provider configured or available");
}
