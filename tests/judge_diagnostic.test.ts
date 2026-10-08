/**
 * SMARTZERO — PRODUCTION JUDGE PATH DIAGNOSTIC
 * 
 * Traces the exact request path from API route → judge client → worker.
 * Identifies exactly where "Judge Unavailable" originates.
 * 
 * NEVER prints secrets, tokens, or credentials.
 */

import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

async function diagnose() {
  console.log("==================================================");
  console.log("▶ SMARTZERO PRODUCTION JUDGE PATH DIAGNOSTIC");
  console.log("==================================================\n");

  // ── 1. Environment Variables ──
  console.log("── 1. Environment Variables ──");
  const judgeWorkerUrl = process.env.JUDGE_WORKER_URL;
  const smartzeroJudgeWorkerUrl = process.env.SMARTZERO_JUDGE_WORKER_URL;
  const judgeWorkerSecret = process.env.JUDGE_WORKER_SECRET;
  const smartzeroJudgeSecret = process.env.SMARTZERO_JUDGE_SECRET;
  const judgeMode = process.env.SMARTZERO_JUDGE_MODE;
  const nodeEnv = process.env.NODE_ENV;

  console.log(`  JUDGE_WORKER_URL:            ${judgeWorkerUrl ? `SET (${judgeWorkerUrl.length} chars, starts with "${judgeWorkerUrl.substring(0, 30)}...")` : "❌ NOT SET"}`);
  console.log(`  SMARTZERO_JUDGE_WORKER_URL:   ${smartzeroJudgeWorkerUrl ? `SET (${smartzeroJudgeWorkerUrl.length} chars)` : "NOT SET"}`);
  console.log(`  JUDGE_WORKER_SECRET:          ${judgeWorkerSecret ? `SET (${judgeWorkerSecret.length} chars)` : "❌ NOT SET"}`);
  console.log(`  SMARTZERO_JUDGE_SECRET:       ${smartzeroJudgeSecret ? `SET (${smartzeroJudgeSecret.length} chars)` : "NOT SET"}`);
  console.log(`  SMARTZERO_JUDGE_MODE:         ${judgeMode || "NOT SET"}`);
  console.log(`  NODE_ENV:                     ${nodeEnv || "NOT SET"}`);

  // ── 2. getJudgeMode() ──
  console.log("\n── 2. getJudgeMode() ──");
  const { getJudgeMode } = await import("../lib/judge/config");
  const mode = getJudgeMode();
  console.log(`  Resolved mode:                ${mode}`);

  // ── 3. Effective worker URL selection ──
  console.log("\n── 3. Effective Worker URL Selection ──");
  const effectiveUrl = judgeWorkerUrl || smartzeroJudgeWorkerUrl;
  console.log(`  Effective URL:                ${effectiveUrl ? `"${effectiveUrl}"` : "❌ NONE — will fall to local or fail-closed"}`);

  if (!effectiveUrl) {
    console.log("\n  ⚠️  ROOT CAUSE: No JUDGE_WORKER_URL or SMARTZERO_JUDGE_WORKER_URL is set.");
    console.log("     In production mode, the client will throw JudgeUnavailableError.");
    console.log("     In local mode, it will attempt local execution (which may not work on Vercel).");
    return;
  }

  // ── 4. URL Construction ──
  console.log("\n── 4. URL Construction ──");
  const cleanUrl = effectiveUrl.replace(/\/$/, "");
  const healthUrl = `${cleanUrl}/health`;
  const readyUrl = `${cleanUrl}/ready`;
  const executeUrl = `${cleanUrl}/api/judge/execute`;
  console.log(`  Health URL:                   ${healthUrl}`);
  console.log(`  Ready URL:                    ${readyUrl}`);
  console.log(`  Execute URL:                  ${executeUrl}`);

  // ── 5. GET /health ──
  console.log("\n── 5. GET /health ──");
  try {
    const healthRes = await fetch(healthUrl, { signal: AbortSignal.timeout(10000) });
    const healthBody = await healthRes.text();
    console.log(`  Status:                       ${healthRes.status}`);
    console.log(`  Body:                         ${healthBody.substring(0, 200)}`);
    if (healthRes.ok) {
      console.log("  ✅ Health endpoint is reachable");
    } else {
      console.log("  ❌ Health endpoint returned non-200");
    }
  } catch (err: unknown) {
    console.log(`  ❌ Health fetch FAILED: ${(err as Error).message}`);
  }

  // ── 6. GET /ready ──
  console.log("\n── 6. GET /ready ──");
  try {
    const readyRes = await fetch(readyUrl, { signal: AbortSignal.timeout(10000) });
    const readyBody = await readyRes.text();
    console.log(`  Status:                       ${readyRes.status}`);
    console.log(`  Body:                         ${readyBody.substring(0, 200)}`);
  } catch (err: unknown) {
    console.log(`  ❌ Ready fetch FAILED: ${(err as Error).message}`);
  }

  // ── 7. Authenticated POST /api/judge/execute (harmless Python) ──
  console.log("\n── 7. Authenticated POST /api/judge/execute (harmless Python) ──");
  const secret = judgeWorkerSecret || smartzeroJudgeSecret;
  if (!secret) {
    console.log("  ❌ Cannot test: No JUDGE_WORKER_SECRET available");
  } else {
    const testPayload = {
      job_id: "diag-test-001",
      submission_id: "diag-sub-001",
      contest_id: "diag-contest",
      question_id: "diag-question",
      language: "python",
      source_code: "print('hello')",
      execution_mode: "run",
      test_cases: [
        {
          id: "tc-diag-1",
          input: "",
          expected_output: "hello",
          weight: 1,
          is_sample: true,
          is_hidden: false,
        },
      ],
      time_limit_ms: 2000,
      memory_limit_mb: 256,
      total_marks: 0,
    };

    try {
      const execRes = await fetch(executeUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${secret}`,
          "x-smartzero-internal": "true",
          "x-smartzero-worker-secret": secret,
        },
        body: JSON.stringify(testPayload),
        signal: AbortSignal.timeout(15000),
      });
      const execBody = await execRes.text();
      console.log(`  HTTP Status:                  ${execRes.status}`);
      console.log(`  Content-Type:                 ${execRes.headers.get("content-type")}`);
      console.log(`  Response (first 500 chars):   ${execBody.substring(0, 500)}`);
      if (execRes.ok) {
        try {
          const data = JSON.parse(execBody);
          console.log(`  Verdict:                      ${data.verdict}`);
          console.log(`  Passed:                       ${data.passed_tests}/${data.total_tests}`);
          console.log("  ✅ Worker execute endpoint is functional");
        } catch {
          console.log("  ❌ Response is not valid JSON despite 200 status");
        }
      } else {
        console.log(`  ❌ Worker returned non-200: ${execRes.status}`);
        if (execRes.status === 401) {
          console.log("  ⚠️  Authentication mismatch: Bearer secret sent does not match worker's JUDGE_WORKER_SECRET");
        }
      }
    } catch (err: unknown) {
      console.log(`  ❌ Execute fetch FAILED: ${(err as Error).message}`);
    }
  }

  // ── 8. JudgeWorkerClient.executeJob() Test ──
  console.log("\n── 8. JudgeWorkerClient.executeJob() Full Pipeline Test ──");
  try {
    const { judgeWorkerClient } = await import("../lib/judge/client");
    const result = await judgeWorkerClient.executeJob({
      job_id: "diag-pipeline-001",
      submission_id: "diag-pipeline-sub-001",
      contest_id: "diag-contest",
      question_id: "diag-question",
      language: "python",
      source_code: "print('pipeline-test')",
      execution_mode: "run",
      test_cases: [
        {
          id: "tc-pipeline-1",
          input: "",
          expected_output: "pipeline-test",
          weight: 1,
          is_sample: true,
          is_hidden: false,
        },
      ],
      time_limit_ms: 2000,
      memory_limit_mb: 256,
      total_marks: 0,
    });
    console.log(`  Status:                       ${result.status}`);
    console.log(`  Verdict:                      ${result.verdict}`);
    console.log(`  Passed:                       ${result.passed_tests}/${result.total_tests}`);
    console.log("  ✅ JudgeWorkerClient.executeJob() succeeded through full pipeline");
  } catch (err: unknown) {
    const errObj = err as any;
    console.log(`  ❌ JudgeWorkerClient.executeJob() FAILED`);
    console.log(`  Error type:                   ${errObj.constructor?.name || typeof err}`);
    console.log(`  Error code:                   ${errObj.code || "N/A"}`);
    console.log(`  Error message:                ${errObj.message || String(err)}`);
    if (errObj.code === "JUDGE_UNAVAILABLE") {
      console.log("  ⚠️  This is what the browser is seeing!");
    }
    if (errObj.code === "JUDGE_TIMEOUT") {
      console.log("  ⚠️  Request timed out reaching the worker");
    }
  }

  // ── 9. Check for Cloudflare response anomalies ──
  console.log("\n── 9. Cloudflare Response Header Check ──");
  try {
    const cfRes = await fetch(healthUrl, { signal: AbortSignal.timeout(10000) });
    const cfServer = cfRes.headers.get("server");
    const cfRay = cfRes.headers.get("cf-ray");
    const cfStatus = cfRes.headers.get("cf-cache-status");
    console.log(`  Server header:                ${cfServer || "not set"}`);
    console.log(`  CF-Ray:                       ${cfRay || "not set"}`);
    console.log(`  CF-Cache-Status:              ${cfStatus || "not set"}`);
    const contentType = cfRes.headers.get("content-type");
    console.log(`  Content-Type:                 ${contentType || "not set"}`);
    if (contentType && !contentType.includes("application/json")) {
      console.log("  ⚠️  Cloudflare may be returning HTML error page instead of JSON");
    }
  } catch (err: unknown) {
    console.log(`  ❌ Cloudflare check FAILED: ${(err as Error).message}`);
  }

  console.log("\n==================================================");
  console.log("▶ DIAGNOSTIC COMPLETE");
  console.log("==================================================");
}

diagnose().catch((err) => {
  console.error("Diagnostic failed:", err);
  process.exit(1);
});
