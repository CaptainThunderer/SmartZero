/**
 * SmartZero 2.0 — AI Provider Abstraction Test Suite
 *
 * Covers:
 * 1. Provider interface compliance
 * 2. Gemini provider success (mocked)
 * 3. OpenRouter provider success (mocked)
 * 4. Featherless provider success (mocked)
 * 5. Gemini missing API key
 * 6. OpenRouter missing API key
 * 7. Featherless missing API key
 * 8. Unknown provider resolution
 * 9. Provider HTTP error handling
 * 10. Provider timeout / network error handling
 * 11. Malformed provider response handling
 * 12. Deterministic fallback provider
 * 13. Resilient provider fallback behavior
 * 14. Authoritative provider selection (resolveProvider)
 * 15. Existing AI Teacher request/response compatibility
 *
 * Run: npx tsx tests/ai_provider_abstraction.test.ts
 */

import assert from "node:assert/strict";
import {
  getAIProvider,
  resolveProvider,
  resilient,
  fallbackProvider,
  geminiProvider,
  openrouterProvider,
  featherlessProvider,
} from "../ai";
import { callGeminiApi } from "../ai/providers/gemini";
import { callOpenRouterApi } from "../ai/providers/openrouter";
import type { AIProvider } from "../ai/provider";

let passed = 0;
let failed = 0;

function testAssert(condition: boolean, name: string) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${name}`);
  } else {
    failed++;
    console.error(`  ❌ FAIL: ${name}`);
  }
}

async function run() {
  console.log("▶ Running SmartZero AI Provider Abstraction Test Suite...\n");

  const originalFetch = globalThis.fetch;
  const originalEnv = { ...process.env };

  try {
    // ══════════════════════════════════════════════
    // 1. Provider Interface Compliance
    // ══════════════════════════════════════════════
    console.log("── 1. Provider Interface Compliance ──");
    const providers: [string, AIProvider][] = [
      ["fallback", fallbackProvider],
      ["gemini", geminiProvider],
      ["openrouter", openrouterProvider],
      ["featherless", featherlessProvider],
    ];

    for (const [name, p] of providers) {
      testAssert(typeof p.interpretQuestion === "function", `${name} implements interpretQuestion`);
      testAssert(typeof p.createLesson === "function", `${name} implements createLesson`);
      testAssert(typeof p.generateHint === "function", `${name} implements generateHint`);
    }

    // ══════════════════════════════════════════════
    // 2. Gemini Provider Success (Mocked)
    // ══════════════════════════════════════════════
    console.log("\n── 2. Gemini Provider Success (Mocked) ──");
    process.env.GEMINI_API_KEY = "test-mock-gemini-key";
    process.env.AI_MODEL = "gemini-2.5-flash";

    const mockGeminiJson = JSON.stringify({
      intent: "explain",
      lessonId: null,
      dataStructure: "array",
      algorithm: "kadane",
      pattern: "dynamic_programming",
      objective: "Explain Kadane algorithm",
      difficulty: "Medium",
      explanation: "Kadane tracks max contiguous subarray sum.",
    });

    globalThis.fetch = (async (url: string | URL | Request) => {
      const urlStr = String(url);
      testAssert(urlStr.includes("generativelanguage.googleapis.com"), "Gemini calls Google generative language endpoint");
      testAssert(urlStr.includes("key=test-mock-gemini-key"), "Gemini request passes API key in URL parameter");

      return new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [{ text: mockGeminiJson }],
              },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }) as typeof fetch;

    const geminiText = await callGeminiApi("System instruction", "User query");
    testAssert(geminiText.includes("kadane"), "callGeminiApi extracts candidate text");

    const geminiTask = await geminiProvider.interpretQuestion("Custom algorithmic query without direct lesson");
    testAssert(Boolean(geminiTask.intent), "geminiProvider.interpretQuestion returns structured DSATask");

    // ══════════════════════════════════════════════
    // 3. OpenRouter Provider Success (Mocked)
    // ══════════════════════════════════════════════
    console.log("\n── 3. OpenRouter Provider Success (Mocked) ──");
    process.env.OPENROUTER_API_KEY = "test-mock-openrouter-key";

    const mockOpenRouterJson = JSON.stringify({
      intent: "problem_solving",
      lessonId: null,
      dataStructure: "hash_map",
      algorithm: "two_sum",
      pattern: "lookup",
      objective: "Solve Two Sum",
      difficulty: "Easy",
      explanation: "Use hash map for complement lookup.",
    });

    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      const urlStr = String(url);
      testAssert(urlStr.includes("openrouter.ai/api/v1/chat/completions"), "OpenRouter calls openrouter chat completions");
      const headers = (init?.headers as Record<string, string>) || {};
      testAssert(headers.Authorization === "Bearer test-mock-openrouter-key", "OpenRouter sends Authorization header");

      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: mockOpenRouterJson,
              },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }) as typeof fetch;

    const openrouterText = await callOpenRouterApi("System instruction", "User query");
    testAssert(openrouterText.includes("two_sum"), "callOpenRouterApi extracts choice message content");

    const openrouterTask = await openrouterProvider.interpretQuestion("Unseen custom problem");
    testAssert(Boolean(openrouterTask.intent), "openrouterProvider.interpretQuestion returns valid DSATask");

    // ══════════════════════════════════════════════
    // 4. Featherless Provider Success (Mocked)
    // ══════════════════════════════════════════════
    console.log("\n── 4. Featherless Provider Success (Mocked) ──");
    process.env.FEATHERLESS_API_KEY = "test-mock-featherless-key";

    globalThis.fetch = (async (url: string | URL | Request) => {
      const urlStr = String(url);
      if (urlStr.endsWith("/models")) {
        return new Response(JSON.stringify([{ id: "Qwen/Qwen3-32B", context_length: 32768 }]), { status: 200 });
      }
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  intent: "explain",
                  lessonId: "binary-search",
                  objective: "Binary Search",
                  difficulty: "Easy",
                  explanation: "Divide search space in half",
                }),
              },
            },
          ],
        }),
        { status: 200 }
      );
    }) as typeof fetch;

    const featherlessHint = await featherlessProvider.generateHint({ lesson: "binary-search" });
    testAssert(typeof featherlessHint === "string" && featherlessHint.length > 0, "Featherless generates hint via fallback chain");

    const featherlessTask = await featherlessProvider.interpretQuestion("Arbitrary custom query for LLM");
    testAssert(Boolean(featherlessTask.intent), "Featherless returns valid task");

    // ══════════════════════════════════════════════
    // 5. Missing API Keys Handling
    // ══════════════════════════════════════════════
    console.log("\n── 5. Missing API Keys Handling ──");
    delete process.env.GEMINI_API_KEY;
    await assert.rejects(
      async () => await callGeminiApi("sys", "user"),
      /GEMINI_API_KEY is not configured/,
      "callGeminiApi throws when GEMINI_API_KEY missing"
    );
    testAssert(true, "callGeminiApi rejects cleanly when key is missing");

    delete process.env.OPENROUTER_API_KEY;
    await assert.rejects(
      async () => await callOpenRouterApi("sys", "user"),
      /OPENROUTER_API_KEY is not configured/,
      "callOpenRouterApi throws when OPENROUTER_API_KEY missing"
    );
    testAssert(true, "callOpenRouterApi rejects cleanly when key is missing");

    delete process.env.FEATHERLESS_API_KEY;
    process.env.AI_PROVIDER = "featherless";
    const resolvedNoKeyFeatherless = resolveProvider();
    testAssert(resolvedNoKeyFeatherless === fallbackProvider, "Featherless with no key safely resolves to fallbackProvider");

    // ══════════════════════════════════════════════
    // 6. Unknown Provider Resolution
    // ══════════════════════════════════════════════
    console.log("\n── 6. Unknown Provider Resolution ──");
    process.env.AI_PROVIDER = "non_existent_provider_xyz";
    const resolvedUnknown = resolveProvider();
    testAssert(resolvedUnknown === fallbackProvider, "Unknown provider name falls back safely to fallbackProvider");

    // ══════════════════════════════════════════════
    // 7. Provider HTTP Error Handling
    // ══════════════════════════════════════════════
    console.log("\n── 7. Provider HTTP Error Handling ──");
    process.env.GEMINI_API_KEY = "dummy-key";
    globalThis.fetch = (async () => {
      return new Response("Internal Server Error", { status: 500 });
    }) as typeof fetch;

    await assert.rejects(
      async () => await callGeminiApi("sys", "user"),
      /status 500/,
      "callGeminiApi throws on HTTP 500"
    );
    testAssert(true, "callGeminiApi throws informative error on HTTP 500");

    // ══════════════════════════════════════════════
    // 8. Provider Timeout / Network Error Handling
    // ══════════════════════════════════════════════
    console.log("\n── 8. Provider Timeout / Network Error Handling ──");
    globalThis.fetch = (async () => {
      throw new Error("Network timeout or connection refused");
    }) as typeof fetch;

    await assert.rejects(
      async () => await callGeminiApi("sys", "user"),
      /Network timeout/,
      "callGeminiApi propagates timeout error to resilient wrapper"
    );
    testAssert(true, "callGeminiApi propagates network failures cleanly");

    // ══════════════════════════════════════════════
    // 9. Malformed Provider Response Handling
    // ══════════════════════════════════════════════
    console.log("\n── 9. Malformed Provider Response Handling ──");
    globalThis.fetch = (async () => {
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "NOT_JSON_AT_ALL" }] } }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;

    // geminiProvider.interpretQuestion catches parse errors and falls back to localTask
    const malformedResult = await geminiProvider.interpretQuestion("Custom question");
    testAssert(Boolean(malformedResult.rawQuestion), "geminiProvider recovers gracefully on malformed JSON");

    // ══════════════════════════════════════════════
    // 10. Deterministic Fallback Provider
    // ══════════════════════════════════════════════
    console.log("\n── 10. Deterministic Fallback Provider ──");
    const fbTask = await fallbackProvider.interpretQuestion("Explain binary search");
    testAssert(fbTask.lessonId === "binary-search", "fallbackProvider routes binary search to canonical lesson");

    const fbLesson = await fallbackProvider.createLesson(fbTask);
    testAssert(Boolean(fbLesson && fbLesson.steps.length > 0), "fallbackProvider builds canonical lesson steps");

    const fbHint = await fallbackProvider.generateHint({});
    testAssert(typeof fbHint === "string" && fbHint.length > 0, "fallbackProvider generates deterministic hint");

    // ══════════════════════════════════════════════
    // 11. Resilient Provider Fallback Behavior
    // ══════════════════════════════════════════════
    console.log("\n── 11. Resilient Provider Fallback Behavior ──");
    const failingProvider: AIProvider = {
      name: "failing_mock",
      async interpretQuestion() {
        throw new Error("API Out of Quota (429)");
      },
      async createLesson() {
        throw new Error("API Failure");
      },
      async generateHint() {
        throw new Error("API Failure");
      },
    };

    const resilientWrapper = resilient(failingProvider);

    // Should not throw — must fall back to fallbackProvider!
    const recoveredTask = await resilientWrapper.interpretQuestion("Explain insertion sort");
    testAssert(recoveredTask.lessonId === "insertion-sort", "resilient wrapper catches error and returns fallback task");

    const recoveredLesson = await resilientWrapper.createLesson(recoveredTask);
    testAssert(Boolean(recoveredLesson), "resilient wrapper catches lesson creation failure and recovers");

    const recoveredHint = await resilientWrapper.generateHint({});
    testAssert(typeof recoveredHint === "string" && recoveredHint.length > 0, "resilient wrapper recovers hint");

    // ══════════════════════════════════════════════
    // 12. Provider Selection (resolveProvider) Matrix
    // ══════════════════════════════════════════════
    console.log("\n── 12. Provider Selection Matrix ──");
    delete process.env.GEMINI_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.FEATHERLESS_API_KEY;

    // Explicit config selection
    process.env.GEMINI_API_KEY = "mock-key";
    testAssert(resolveProvider({ provider: "gemini" }).name?.includes("gemini") === true, "Explicit config: gemini");

    process.env.OPENROUTER_API_KEY = "mock-key";
    testAssert(resolveProvider({ provider: "openrouter" }).name?.includes("openrouter") === true, "Explicit config: openrouter");

    process.env.FEATHERLESS_API_KEY = "mock-key";
    testAssert(resolveProvider({ provider: "featherless" }).name?.includes("featherless") === true, "Explicit config: featherless");

    testAssert(resolveProvider({ provider: "deterministic" }) === fallbackProvider, "Explicit config: deterministic");

    // Live AI disabled explicitly (for future live contest exams)
    testAssert(resolveProvider({ allowLiveAI: false }) === fallbackProvider, "allowLiveAI: false enforces fallbackProvider");

    // Global toggle disabled
    process.env.SMARTZERO_ENABLE_LIVE_AI = "false";
    testAssert(resolveProvider() === fallbackProvider, "SMARTZERO_ENABLE_LIVE_AI=false enforces fallbackProvider");
    process.env.SMARTZERO_ENABLE_LIVE_AI = "true";

    // ══════════════════════════════════════════════
    // 13. Existing AI Teacher Compatibility
    // ══════════════════════════════════════════════
    console.log("\n── 13. AI Teacher Compatibility ──");
    const activeProvider = getAIProvider();
    testAssert(typeof activeProvider.interpretQuestion === "function", "getAIProvider returns interpretQuestion");
    testAssert(typeof activeProvider.createLesson === "function", "getAIProvider returns createLesson");
    testAssert(typeof activeProvider.generateHint === "function", "getAIProvider returns generateHint");

    const kadaneInterpret = await activeProvider.interpretQuestion("Explain Kadane algorithm");
    testAssert(kadaneInterpret.lessonId === "max-subarray", "Active provider routes Kadane to max-subarray lesson");

    const kadaneLesson = await activeProvider.createLesson(kadaneInterpret);
    testAssert(Boolean(kadaneLesson && kadaneLesson.id === "max-subarray"), "Active provider instantiates Kadane lesson");

    console.log(`\n══════════════════════════════════════════════════`);
    console.log(`  AI Provider Abstraction Suite: ${passed} passed, ${failed} failed`);
    console.log(`══════════════════════════════════════════════════\n`);
  } finally {
    globalThis.fetch = originalFetch;
    process.env = originalEnv;
  }

  process.exit(failed > 0 ? 1 : 0);
}

run();
