import type { ModelTaskType } from "../types/dsa";

export interface FeatherlessModelMetadata {
  id: string;
  context_length: number;
  max_completion_tokens?: number;
  features?: {
    tool_use?: boolean;
    image_input?: boolean;
  };
  available_on_current_plan?: boolean;
  model_class?: string;
  owned_by?: string;
  is_gated?: boolean;
}

export interface ModelSelectionResult {
  primary: string;
  secondary: string;
  tertiary: string;
  taskCategory: ModelTaskType;
  supportsVision: boolean;
}

interface CacheEntry {
  timestamp: number;
  models: FeatherlessModelMetadata[];
}

// Server-side in-memory cache
let modelCache: CacheEntry | null = null;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

const BASE_URL = process.env.FEATHERLESS_BASE_URL || "https://api.featherless.ai/v1";

export const DEFAULT_REASONING_MODEL = process.env.FEATHERLESS_REASONING_MODEL || "zai-org/GLM-5.3-Flash";
export const DEFAULT_STANDARD_MODEL = process.env.FEATHERLESS_MODEL || "Qwen/Qwen3-32B";

// Fallback catalog in case network is offline or discovery fails
const DEFAULT_KNOWN_MODELS: FeatherlessModelMetadata[] = [
  {
    id: "zai-org/GLM-5.3-Flash",
    context_length: 32768,
    features: { tool_use: true },
    available_on_current_plan: true,
  },
  {
    id: "Qwen/Qwen3-32B",
    context_length: 32768,
    features: { tool_use: true },
    available_on_current_plan: true,
  },
  {
    id: "Qwen/Qwen2.5-VL-7B-Instruct",
    context_length: 32768,
    features: { tool_use: true, image_input: true },
    available_on_current_plan: true,
  },
  {
    id: "allura-org/GLM4-9B-Neon-v2",
    context_length: 32768,
    features: { tool_use: true },
    available_on_current_plan: true,
  },
  {
    id: "Darkknight535/Moonlight-L3-15B-v2.5-64k",
    context_length: 65536,
    features: { tool_use: true },
    available_on_current_plan: true,
  },
  {
    id: "SteelStorage/AbL3In-15B",
    context_length: 8192,
    features: { tool_use: true },
    available_on_current_plan: true,
  },
];

/**
 * Discovers available models from Featherless catalog with server-side caching.
 * NEVER logs or exposes the API key.
 */
export async function discoverModels(forceRefresh = false): Promise<FeatherlessModelMetadata[]> {
  const now = Date.now();
  if (!forceRefresh && modelCache && now - modelCache.timestamp < CACHE_TTL_MS) {
    return modelCache.models;
  }

  const key = process.env.FEATHERLESS_API_KEY;
  if (!key) {
    return DEFAULT_KNOWN_MODELS;
  }

  try {
    const res = await fetch(`${BASE_URL}/models`, {
      headers: {
        Authorization: `Bearer ${key}`,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      if (modelCache) return modelCache.models;
      return DEFAULT_KNOWN_MODELS;
    }

    const json = await res.json();
    const rawList: unknown[] = Array.isArray(json) ? json : json?.data || [];

    const parsedModels: FeatherlessModelMetadata[] = rawList
      .filter((m): m is Record<string, unknown> => typeof m === "object" && m !== null && "id" in m && typeof (m as { id: unknown }).id === "string")
      .map((m) => ({
        id: String(m.id),
        context_length: typeof m.context_length === "number" ? m.context_length : 8192,
        max_completion_tokens: typeof m.max_completion_tokens === "number" ? m.max_completion_tokens : undefined,
        features: typeof m.features === "object" && m.features !== null ? (m.features as { tool_use?: boolean; image_input?: boolean }) : {},
        available_on_current_plan: m.available_on_current_plan !== false,
        model_class: typeof m.model_class === "string" ? m.model_class : undefined,
        owned_by: typeof m.owned_by === "string" ? m.owned_by : undefined,
        is_gated: Boolean(m.is_gated),
      }));

    if (parsedModels.length > 0) {
      modelCache = {
        timestamp: now,
        models: parsedModels,
      };
      return parsedModels;
    }
  } catch {
    // Network or parse error: fallback gracefully to cache or defaults
  }

  if (modelCache) return modelCache.models;
  return DEFAULT_KNOWN_MODELS;
}

/**
 * Ranks models according to capability for a specific task category.
 */
export function rankModels(
  models: FeatherlessModelMetadata[],
  taskCategory: ModelTaskType
): FeatherlessModelMetadata[] {
  // Only consider models available on the current account plan and not gated
  const available = models.filter((m) => m.available_on_current_plan !== false && !m.is_gated);
  const candidates = available.length > 0 ? available : models;

  return [...candidates].sort((a, b) => {
    const scoreA = calculateModelScore(a, taskCategory);
    const scoreB = calculateModelScore(b, taskCategory);
    return scoreB - scoreA;
  });
}

function calculateModelScore(model: FeatherlessModelMetadata, task: ModelTaskType): number {
  let score = 0;
  const idLower = model.id.toLowerCase();

  // Task-specific scoring
  switch (task) {
    case "VISION":
      if (model.features?.image_input) score += 1000;
      if (idLower.includes("vl")) score += 500;
      break;

    case "CODE_GENERATION":
    case "CODE_DEBUGGING":
      if (idLower.includes("coder")) score += 600;
      if (idLower.includes("code")) score += 400;
      if (idLower.includes("qwen")) score += 300;
      if (model.context_length >= 32768) score += 100;
      break;

    case "DSA_REASONING":
    case "COMPLEX_REASONING":
      if (model.id === DEFAULT_REASONING_MODEL) score += 900;
      if (idLower.includes("glm-5.3") || idLower.includes("glm-5")) score += 800;
      if (idLower.includes("32b") || idLower.includes("70b") || idLower.includes("72b")) score += 500;
      if (idLower.includes("qwen")) score += 400;
      if (idLower.includes("z1") || idLower.includes("r1") || idLower.includes("reason")) score += 400;
      if (model.context_length >= 32768) score += 100;
      break;

    case "LONG_CONTEXT":
      if (model.context_length >= 65536) score += 800;
      else if (model.context_length >= 32768) score += 400;
      if (idLower.includes("glm-5.3")) score += 300;
      break;

    case "TEXT_PROBLEM_SOLVING":
      if (model.id === DEFAULT_REASONING_MODEL) score += 850;
      if (idLower.includes("glm-5.3") || idLower.includes("glm-5")) score += 750;
      if (idLower.includes("32b")) score += 400;
      else if (idLower.includes("14b") || idLower.includes("15b") || idLower.includes("9b")) score += 300;
      if (idLower.includes("qwen")) score += 300;
      break;

    case "GENERAL_EXPLANATION":
    case "COMPARISON":
    default:
      if (idLower.includes("32b")) score += 400;
      if (idLower.includes("glm-5.3")) score += 350;
      else if (idLower.includes("14b") || idLower.includes("15b") || idLower.includes("9b")) score += 300;
      else if (idLower.includes("7b")) score += 200;
      if (idLower.includes("qwen")) score += 250;
      if (idLower.includes("instruct")) score += 100;
      break;
  }

  // General capabilities
  if (model.features?.tool_use) score += 50;

  return score;
}

/**
 * Selects primary, secondary, and tertiary models for a task.
 * Dynamically routes complex natural language reasoning to GLM-5.3-Flash
 * and canonical DSA / code tasks to Qwen, with graceful fallback.
 */
export async function selectModel(
  taskCategory: ModelTaskType = "TEXT_PROBLEM_SOLVING",
  options?: { requireVision?: boolean; preferReasoning?: boolean }
): Promise<ModelSelectionResult> {
  const effectiveCategory = options?.requireVision ? "VISION" : taskCategory;
  const models = await discoverModels();
  const ranked = rankModels(models, effectiveCategory);

  const reasoningModelName = DEFAULT_REASONING_MODEL;
  const standardModelName = DEFAULT_STANDARD_MODEL;

  const isReasoningTask =
    options?.preferReasoning ||
    effectiveCategory === "COMPLEX_REASONING" ||
    effectiveCategory === "DSA_REASONING" ||
    effectiveCategory === "TEXT_PROBLEM_SOLVING" ||
    effectiveCategory === "CODE_DEBUGGING";

  const reasoningCandidate = ranked.find(
    (m) =>
      (m.id === reasoningModelName || m.id.toLowerCase().includes("glm-5.3")) &&
      m.available_on_current_plan !== false &&
      !m.is_gated
  );

  const standardCandidate = ranked.find(
    (m) =>
      (m.id === standardModelName || m.id.toLowerCase().includes("qwen3-32b") || m.id.toLowerCase().includes("qwen")) &&
      m.available_on_current_plan !== false &&
      !m.is_gated
  );

  let primary: string;
  let secondary: string;
  let tertiary: string;

  if (effectiveCategory === "VISION") {
    primary = ranked.find((m) => Boolean(m.features?.image_input))?.id || "Qwen/Qwen2.5-VL-7B-Instruct";
    secondary = ranked.find((m) => m.id !== primary)?.id || standardModelName;
    tertiary = ranked.find((m) => m.id !== primary && m.id !== secondary)?.id || "allura-org/GLM4-9B-Neon-v2";
  } else if (isReasoningTask && reasoningCandidate) {
    // 1. Prefer GLM-5.3-Flash for ambiguous natural-language, story problems, normalization, complex reasoning
    primary = reasoningCandidate.id;
    secondary = standardCandidate ? standardCandidate.id : (ranked.find((m) => m.id !== primary)?.id || standardModelName);
    tertiary = ranked.find((m) => m.id !== primary && m.id !== secondary)?.id || "allura-org/GLM4-9B-Neon-v2";
  } else {
    // 2. Prefer Qwen for canonical registered DSA lessons, code generation, and standard queries
    primary = standardCandidate ? standardCandidate.id : (ranked[0]?.id || standardModelName);
    secondary = reasoningCandidate ? reasoningCandidate.id : (ranked.find((m) => m.id !== primary)?.id || "allura-org/GLM4-9B-Neon-v2");
    tertiary = ranked.find((m) => m.id !== primary && m.id !== secondary)?.id || "SteelStorage/AbL3In-15B";
  }

  const supportsVision = ranked.some((m) => m.id === primary && Boolean(m.features?.image_input));

  return {
    primary,
    secondary,
    tertiary,
    taskCategory: effectiveCategory,
    supportsVision,
  };
}

/**
 * Returns the fallback chain of models for a given task category.
 */
export async function getFallbackChain(taskCategory: ModelTaskType = "TEXT_PROBLEM_SOLVING"): Promise<string[]> {
  const selection = await selectModel(taskCategory);
  return [selection.primary, selection.secondary, selection.tertiary].filter(Boolean);
}
