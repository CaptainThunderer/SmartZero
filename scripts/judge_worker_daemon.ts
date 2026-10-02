/**
 * SmartZero 2.0 — Dedicated Judge Worker Daemon
 *
 * Standalone, independently executable worker daemon.
 * Decoupled from Next.js server runtime.
 * Pulls jobs from the durable queue, loads authoritative tests from Supabase,
 * executes within isolated Docker/gVisor containers, and records verdicts.
 *
 * Usage:
 *   npx tsx scripts/judge_worker_daemon.ts
 */

import { JudgeWorker } from "../lib/judge/worker/worker";
import { getJudgeQueue } from "../lib/judge/queue/queue";
import { getSandboxRunner } from "../lib/judge/sandbox/index";
import { judgeObservability } from "../lib/judge/observability";
import { getJudgeMode } from "../lib/judge/config";

const WORKER_ID = `judge-worker-${process.pid}-${Math.random().toString(36).slice(2, 7)}`;
const POLL_INTERVAL_MS = Number(process.env.JUDGE_POLL_INTERVAL_MS) || 500;

console.log("==================================================");
console.log(`🚀 STARTING SMARTZERO JUDGE WORKER DAEMON [${WORKER_ID}]`);
console.log(`Execution Mode: ${getJudgeMode().toUpperCase()}`);
console.log(`Poll Interval: ${POLL_INTERVAL_MS}ms`);
console.log("==================================================\n");

let isShuttingDown = false;
const queue = getJudgeQueue();
const worker = new JudgeWorker(WORKER_ID, queue);

async function startDaemon() {
  // 1. Health check sandbox environment
  const runner = await getSandboxRunner();
  console.log(`Active Sandbox Engine: ${runner.name}`);

  const isRunnerAvail = await runner.isAvailable();
  if (!isRunnerAvail && getJudgeMode() === "production") {
    console.error(
      "❌ FATAL: Production judge mode mandates an available container sandbox (Docker/gVisor)."
    );
    console.error(
      "Host subprocess fallback is strictly forbidden in production. Shutting down daemon."
    );
    judgeObservability.recordSandboxUnavailable();
    process.exit(1);
  }

  console.log("✅ Sandbox health check passed. Ready to consume jobs.\n");

  // 2. Continuous event loop
  while (!isShuttingDown) {
    try {
      const processed = await worker.processNextJob();
      if (!processed) {
        // Queue empty, await next polling interval
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      }
    } catch (err) {
      console.error(`[${WORKER_ID}] Worker error processing job:`, err);
      judgeObservability.recordJobFailed("SYSTEM_ERROR");
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  console.log(`\n🛑 Worker daemon [${WORKER_ID}] stopped gracefully.`);
  process.exit(0);
}

// Graceful shutdown handling
function handleShutdown(signal: string) {
  if (isShuttingDown) return;
  console.log(`\nReceived ${signal}. Initiating graceful worker shutdown...`);
  isShuttingDown = true;
  worker.stopWorker();
  setTimeout(() => {
    console.error("Force exiting after shutdown timeout.");
    process.exit(1);
  }, 10000).unref();
}

process.on("SIGINT", () => handleShutdown("SIGINT"));
process.on("SIGTERM", () => handleShutdown("SIGTERM"));

// Launch daemon if invoked directly
if (require.main === module || process.argv[1]?.includes("judge_worker_daemon")) {
  startDaemon().catch((err) => {
    console.error("Fatal worker startup failure:", err);
    process.exit(1);
  });
}

export { startDaemon, worker, WORKER_ID };
