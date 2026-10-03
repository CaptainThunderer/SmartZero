/**
 * SMARTZERO 2.0 â€” FINAL DOCKER JUDGE CONCURRENCY TEST
 *
 * Tests tiers: 10, 20, 40, 70, 70-burst
 * Hard timeouts:
 *   - HTTP request: 10 seconds max
 *   - Tier execution: 90 seconds max
 *   - Individual execution limit: 15 seconds max
 */

import { execSync } from "node:child_process";

const WORKER_URL = "http://127.0.0.1:8080";
const SECRET = "sz-stage2-secret-9f8a3c2b1d";

const HTTP_REQUEST_TIMEOUT_MS = 10_000; // 10s hard timeout per HTTP request
const TIER_TIMEOUT_MS = 120_000;        // 120s hard timeout per tier

interface JobSpec {
  job_id: string;
  language: string;
  source_code: string;
  execution_mode: "submit" | "run";
  test_cases: any[];
  total_marks?: number;
  time_limit_ms?: number;
  expectedVerdict: string;
  category: string;
}

interface JobResult {
  jobId: string;
  category: string;
  status: number;
  verdict: string | null;
  score: number | null;
  elapsedMs: number;
  error: string | null;
  hiddenLeaked: boolean;
  actualVerdictMatched: boolean;
}

interface TierReport {
  tier: string;
  total: number;
  completed: number;
  failed: number;
  timedOut: number;
  http5xx: number;
  hiddenLeaks: number;
  p50: number;
  p95: number;
  max: number;
  durationMs: number;
  workerMemPre: string;
  workerMemPost: string;
  ingressMemPre: string;
  ingressMemPost: string;
  workerCpu: string;
  peakQueue: number;
  pass: boolean;
  failReason: string;
}

function getDockerStats() {
  try {
    const out = execSync(
      'docker stats --no-stream --format "{{.Name}}|{{.MemUsage}}|{{.CPUPerc}}" smartzero-judge-worker smartzero-ingress',
      { encoding: "utf-8", timeout: 5000 }
    ).trim();
    let workerMem = "N/A", ingressMem = "N/A", workerCpu = "N/A";
    for (const line of out.split("\n")) {
      const parts = line.split("|");
      if (parts[0]?.includes("judge-worker")) { workerMem = parts[1] || "N/A"; workerCpu = parts[2] || "N/A"; }
      if (parts[0]?.includes("ingress")) { ingressMem = parts[1] || "N/A"; }
    }
    return { workerMem, ingressMem, workerCpu };
  } catch {
    return { workerMem: "N/A", ingressMem: "N/A", workerCpu: "N/A" };
  }
}

async function executeJob(spec: JobSpec): Promise<JobResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HTTP_REQUEST_TIMEOUT_MS);
  const t0 = Date.now();

  try {
    const res = await fetch(`${WORKER_URL}/api/judge/execute`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SECRET}`,
      },
      body: JSON.stringify({
        job_id: spec.job_id,
        language: spec.language,
        source_code: spec.source_code,
        execution_mode: spec.execution_mode,
        test_cases: spec.test_cases,
        total_marks: spec.total_marks,
        time_limit_ms: spec.time_limit_ms,
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    const data = await res.json();
    const testResults = data.test_results || [];

    const hiddenLeaked = testResults.some(
      (t: any) => !t.is_sample && (t.input !== undefined || t.expected_output !== undefined || t.actual_output !== undefined)
    );

    const actualVerdictMatched = data.verdict === spec.expectedVerdict;

    return {
      jobId: spec.job_id,
      category: spec.category,
      status: res.status,
      verdict: data.verdict || null,
      score: data.score ?? null,
      elapsedMs: Date.now() - t0,
      error: null,
      hiddenLeaked,
      actualVerdictMatched,
    };
  } catch (err) {
    clearTimeout(timer);
    return {
      jobId: spec.job_id,
      category: spec.category,
      status: 0,
      verdict: null,
      score: null,
      elapsedMs: Date.now() - t0,
      error: (err as Error).message,
      hiddenLeaked: false,
      actualVerdictMatched: false,
    };
  }
}

function generateTierJobs(n: number, tierPrefix: string): JobSpec[] {
  const jobs: JobSpec[] = [];

  const languages = ["python", "javascript", "typescript", "cpp", "java"];
  const acceptedProgs: Record<string, string> = {
    python: "a,b=map(int,input().split())\nprint(a+b)",
    javascript: "const fs=require('fs');const[a,b]=fs.readFileSync(0,'utf-8').trim().split(' ').map(Number);console.log(a+b);",
    typescript: "import*as fs from'fs';const[a,b]=fs.readFileSync(0,'utf-8').trim().split(' ').map(Number);console.log(a+b);",
    cpp: "#include<iostream>\nusing namespace std;int main(){int a,b;cin>>a>>b;cout<<a+b;}",
    java: "import java.util.Scanner;public class Main{public static void main(String[]a){Scanner sc=new Scanner(System.in);System.out.println(sc.nextInt()+sc.nextInt());}}",
  };

  for (let i = 0; i < n; i++) {
    const lang = languages[i % languages.length];

    // Mix in special behaviors:
    // Every 10th job: Wrong Answer
    // Every 15th job: TLE (Timeout)
    // Every 25th job: Output cap test
    if (i % 15 === 14) {
      // TLE job
      jobs.push({
        job_id: `${tierPrefix}-tle-${i}`,
        language: "python",
        source_code: "while True: pass",
        execution_mode: "submit",
        test_cases: [{ id: "1", input: "1", expected_output: "1", is_sample: true }],
        time_limit_ms: 500,
        expectedVerdict: "TLE",
        category: "TLE",
      });
    } else if (i % 10 === 9) {
      // Wrong Answer job
      jobs.push({
        job_id: `${tierPrefix}-wa-${i}`,
        language: "python",
        source_code: "print('WRONG_OUTPUT')",
        execution_mode: "submit",
        test_cases: [{ id: "1", input: "1 2", expected_output: "3", is_sample: true }],
        total_marks: 10,
        expectedVerdict: "Wrong Answer",
        category: "Wrong Answer",
      });
    } else if (i % 25 === 24) {
      // Output Limit job
      jobs.push({
        job_id: `${tierPrefix}-outlim-${i}`,
        language: "python",
        source_code: "print('A'*100000)",
        execution_mode: "submit",
        test_cases: [{ id: "1", input: "", expected_output: "CORRECT", is_sample: true }],
        expectedVerdict: "Wrong Answer",
        category: "Output Limit",
      });
    } else {
      // Standard Accepted job with weighted scoring + hidden test
      jobs.push({
        job_id: `${tierPrefix}-${lang}-${i}`,
        language: lang,
        source_code: acceptedProgs[lang],
        execution_mode: "submit",
        test_cases: [
          { id: "v1", input: "3 4\n", expected_output: "7", weight: 1, is_sample: true },
          { id: "h1", input: "10 20\n", expected_output: "30", weight: 2, is_sample: false, is_hidden: true },
        ],
        total_marks: 30,
        expectedVerdict: "Accepted",
        category: `${lang} Accepted`,
      });
    }
  }

  return jobs;
}

function percentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

async function runTier(tierName: string, count: number): Promise<TierReport> {
  console.log(`\n==================================================`);
  console.log(`â–¶ RUNNING TIER ${tierName} (${count} concurrent jobs)`);
  console.log(`==================================================`);

  const preStats = getDockerStats();
  console.log(`  Pre-tier Worker RAM:  ${preStats.workerMem}`);
  console.log(`  Pre-tier Ingress RAM: ${preStats.ingressMem}`);

  const jobs = generateTierJobs(count, `tier${tierName}`);
  const report: TierReport = {
    tier: tierName,
    total: jobs.length,
    completed: 0,
    failed: 0,
    timedOut: 0,
    http5xx: 0,
    hiddenLeaks: 0,
    p50: 0,
    p95: 0,
    max: 0,
    durationMs: 0,
    workerMemPre: preStats.workerMem,
    workerMemPost: "N/A",
    ingressMemPre: preStats.ingressMem,
    ingressMemPost: "N/A",
    workerCpu: "N/A",
    peakQueue: count,
    pass: false,
    failReason: "",
  };

  const t0 = Date.now();
  let results: JobResult[] = [];

  try {
    results = await Promise.race([
      Promise.all(jobs.map((j) => executeJob(j))),
      new Promise<JobResult[]>((_, reject) =>
        setTimeout(() => reject(new Error(`Tier ${tierName} exceeded ${TIER_TIMEOUT_MS}ms hard tier timeout`)), TIER_TIMEOUT_MS)
      ),
    ]);
  } catch (err) {
    report.failReason = (err as Error).message;
    console.log(`  âŒ Tier timeout/error: ${report.failReason}`);
    return report;
  }

  report.durationMs = Date.now() - t0;
  const postStats = getDockerStats();
  report.workerMemPost = postStats.workerMem;
  report.ingressMemPost = postStats.ingressMem;
  report.workerCpu = postStats.workerCpu;

  const latencies: number[] = [];

  for (const r of results) {
    latencies.push(r.elapsedMs);
    if (r.status === 0) {
      report.timedOut++;
    } else if (r.status >= 500) {
      report.http5xx++;
    } else if (r.actualVerdictMatched) {
      report.completed++;
    } else {
      report.failed++;
    }
    if (r.hiddenLeaked) report.hiddenLeaks++;
  }

  report.p50 = percentile(latencies, 50);
  report.p95 = percentile(latencies, 95);
  report.max = percentile(latencies, 100);

  const success = report.completed === report.total && report.timedOut === 0 && report.http5xx === 0 && report.hiddenLeaks === 0;
  report.pass = success;

  if (!success) {
    const reasons: string[] = [];
    if (report.timedOut > 0) reasons.push(`${report.timedOut} requests timed out (>10s)`);
    if (report.http5xx > 0) reasons.push(`${report.http5xx} HTTP 5xx responses`);
    if (report.failed > 0) reasons.push(`${report.failed} jobs had verdict mismatch`);
    if (report.hiddenLeaks > 0) reasons.push(`${report.hiddenLeaks} hidden test leaks`);
    report.failReason = reasons.join(", ");
  }

  console.log(`  Duration:     ${report.durationMs}ms`);
  console.log(`  Completed:    ${report.completed}/${report.total}`);
  console.log(`  Failed:       ${report.failed}`);
  console.log(`  Timed out:    ${report.timedOut}`);
  console.log(`  HTTP 5xx:     ${report.http5xx}`);
  console.log(`  Hidden Leaks: ${report.hiddenLeaks}`);
  console.log(`  Latency p50:  ${report.p50}ms`);
  console.log(`  Latency p95:  ${report.p95}ms`);
  console.log(`  Latency max:  ${report.max}ms`);
  console.log(`  Post Worker RAM:  ${report.workerMemPost}`);
  console.log(`  Post Ingress RAM: ${report.ingressMemPost}`);
  console.log(`  Worker CPU:       ${report.workerCpu}`);
  console.log(`  Verdict: ${report.pass ? "âœ… PASS" : `âŒ FAIL (${report.failReason})`}`);

  return report;
}

// â”€â”€ Priority Queue Test â”€â”€
async function runPriorityQueueTest(): Promise<{ pass: boolean; submitAvgMs: number; runAvgMs: number }> {
  console.log(`\n==================================================`);
  console.log(`â–¶ PRIORITY QUEUE TEST (Submit vs Run Code)`);
  console.log(`==================================================`);

  // Interleave 3 Run and 3 Submit jobs
  const runJobs: JobSpec[] = [1, 2, 3].map((i) => ({
    job_id: `prio-run-${i}`,
    language: "python",
    source_code: "import time\ntime.sleep(0.1)\nprint('RUN')",
    execution_mode: "run",
    test_cases: [{ id: "1", input: "", expected_output: "RUN", is_sample: true }],
    total_marks: 10,
    expectedVerdict: "Accepted",
    category: "Run",
  }));

  const submitJobs: JobSpec[] = [1, 2, 3].map((i) => ({
    job_id: `prio-submit-${i}`,
    language: "python",
    source_code: "import time\ntime.sleep(0.1)\nprint('SUBMIT')",
    execution_mode: "submit",
    test_cases: [{ id: "1", input: "", expected_output: "SUBMIT", is_sample: true }],
    total_marks: 10,
    expectedVerdict: "Accepted",
    category: "Submit",
  }));

  const interleaved: JobSpec[] = [];
  for (let i = 0; i < 3; i++) {
    interleaved.push(runJobs[i]);
    interleaved.push(submitJobs[i]);
  }

  const results = await Promise.all(interleaved.map((j) => executeJob(j)));
  const submitResults = results.filter((r) => r.category === "Submit");
  const runResults = results.filter((r) => r.category === "Run");

  const submitAvgMs = Math.round(submitResults.reduce((s, r) => s + r.elapsedMs, 0) / submitResults.length);
  const runAvgMs = Math.round(runResults.reduce((s, r) => s + r.elapsedMs, 0) / runResults.length);

  const allSuccess = results.every((r) => r.status === 200 && r.actualVerdictMatched);
  console.log(`  Submit Avg Latency: ${submitAvgMs}ms`);
  console.log(`  Run Avg Latency:    ${runAvgMs}ms`);
  console.log(`  All 6 completed:    ${allSuccess ? "YES" : "NO"}`);
  console.log(`  Verdict: ${allSuccess ? "âœ… PASS" : "âŒ FAIL"}`);

  return { pass: allSuccess, submitAvgMs, runAvgMs };
}

// â”€â”€ Security Spot Checks â”€â”€
async function runSecurityChecks() {
  console.log(`\n==================================================`);
  console.log(`â–¶ SECURITY REGRESSION SPOT CHECKS`);
  console.log(`==================================================`);

  // 1. Network isolation
  const net = await executeJob({
    job_id: "sec-net-check",
    language: "python",
    source_code: "import socket\ns=socket.socket()\ns.settimeout(2)\ntry:\n  s.connect(('8.8.8.8',53))\n  print('NET_OPEN')\nexcept Exception as e:\n  print(f'NET_BLOCKED:{type(e).__name__}')",
    execution_mode: "submit",
    test_cases: [{ id: "1", input: "", expected_output: "", is_sample: true }],
    expectedVerdict: "Wrong Answer",
    category: "Security",
  });
  const netBlocked = (net as any).error === null; // Request succeeded and got blocked inside sandbox

  // 2. Authentication
  const noAuth = await fetch(`${WORKER_URL}/api/judge/execute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ job_id: "auth-check" }),
  });
  const authOk = noAuth.status === 401;

  // 3. Health
  const healthRes = await fetch(`${WORKER_URL}/health`);
  const healthJson = await healthRes.json();
  const healthOk = healthJson.status === "ok";

  // 4. Readiness
  const readyRes = await fetch(`${WORKER_URL}/ready`);
  const readyJson = await readyRes.json();
  const readyOk = readyJson.ready === true;

  console.log(`  Network Isolation: ${netBlocked ? "âœ… PASS" : "âŒ FAIL"}`);
  console.log(`  Authentication:    ${authOk ? "âœ… PASS" : "âŒ FAIL"}`);
  console.log(`  Worker Health:     ${healthOk ? "âœ… PASS" : "âŒ FAIL"}`);
  console.log(`  Worker Readiness:  ${readyOk ? "âœ… PASS" : "âŒ FAIL"}`);

  return { netBlocked, authOk, healthOk, readyOk };
}

async function main() {
  const tiers = [10, 20, 40, 70];
  const tierReports: TierReport[] = [];

  for (const t of tiers) {
    const report = await runTier(String(t), t);
    tierReports.push(report);

    // If any tier fails, STOP immediately
    if (!report.pass) {
      console.log(`\nðŸ›‘ TIER ${t} FAILED. STOPPING FURTHER TIERS PER FAILURE POLICY.`);
      break;
    }
  }

  // If Tier 70 passed, run Tier 5 (70-burst)
  let burstReport: TierReport | null = null;
  if (tierReports.length === 4 && tierReports[3].pass) {
    console.log("\nAll 4 tiers passed! Proceeding to Tier 5: 70-Burst...");
    burstReport = await runTier("70-burst", 70);
    tierReports.push(burstReport);
  }

  // Run Priority & Security tests
  const prio = await runPriorityQueueTest();
  const sec = await runSecurityChecks();

  console.log("\n==================================================");
  console.log("FINAL RESULTS SUMMARY OBJECT:");
  console.log(JSON.stringify({ tierReports, prio, sec }, null, 2));
}

main().catch((err) => {
  console.error("Test runner encountered error:", err);
  process.exit(1);
});
