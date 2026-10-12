import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// ─────────────────────────────────────────────────────────────
// TYPES & SCHEMAS
// ─────────────────────────────────────────────────────────────

export type DrillLanguage = "python" | "sql" | "mixed";
export type DrillScenario = "baseline" | "burst";

export type FailureCategory =
  | "SUCCESS"
  | "PREFLIGHT_FAILURE"
  | "AUTH_ERROR"
  | "HTTP_ERROR"
  | "RATE_LIMITED"
  | "TIMEOUT"
  | "NETWORK_ERROR"
  | "INVALID_JSON"
  | "INVALID_RESPONSE_SCHEMA"
  | "UNEXPECTED_JOB_STATUS"
  | "VERDICT_MISMATCH"
  | "TEST_CASE_FAILURE"
  | "ABORTED_BY_CIRCUIT_BREAKER";

export interface DrillArgs {
  targetUrl: string;
  concurrency: number;
  totalRequests: number;
  language: DrillLanguage;
  scenario: DrillScenario;
  timeoutMs: number;
  seed: number;
  dryRun: boolean;
  confirmStaging: boolean;
  allowRemoteHosts: string[];
  outputPath?: string;
  forceOverwrite: boolean;
  help: boolean;
}

export interface RequestRecord {
  jobId: string;
  language: "python" | "sql";
  waveIndex: number;
  slotIndex: number;
  dispatchedAtMonotonic: number;
  completedAtMonotonic: number;
  durationMs: number;
  httpStatus?: number;
  category: FailureCategory;
  verdict?: string;
  passed?: boolean;
  errorMessage?: string;
}

export interface LatencyStats {
  min: number;
  mean: number;
  p50: number;
  p95: number;
  p99: number;
  max: number;
}

export interface LanguageMetrics {
  total: number;
  successCount: number;
  failureCount: number;
  latencies: LatencyStats;
}

export interface DrillReport {
  timestamp: string;
  target: {
    url: string;
    hostname: string;
    port: string;
    protocol: string;
    isLoopback: boolean;
  };
  config: {
    concurrency: number;
    totalRequests: number;
    language: DrillLanguage;
    scenario: DrillScenario;
    timeoutMs: number;
    seed: number;
    dryRun: boolean;
  };
  workerInfo?: {
    workerName?: string;
    reportedConcurrency?: number;
    runtimes?: string[];
  };
  preflight: {
    healthOk: boolean;
    readinessOk: boolean;
    canaryLatencyMs?: number;
    canaryVerdict?: string;
  };
  circuitBreaker: {
    triggered: boolean;
    reason?: string;
  };
  executionSummary: {
    requestsPrepared: number;
    requestsDispatched: number;
    requestsCompleted: number;
    requestsSuccessful: number;
    requestsFailed: number;
    requestsSkipped: number;
    timeoutCount: number;
    totalWallClockMs: number;
    dispatchWindowMs: number;
    throughputRps: number;
    queueWaitMetric: "unavailable";
    queueWaitNote: string;
  };
  latencies: LatencyStats;
  perLanguage: {
    python?: LanguageMetrics;
    sql?: LanguageMetrics;
  };
  httpStatusDistribution: Record<string, number>;
  categoryDistribution: Record<string, number>;
  exitCode: number;
}

// ─────────────────────────────────────────────────────────────
// 1. SAFE TARGET VALIDATION
// ─────────────────────────────────────────────────────────────

const FORBIDDEN_HOST_PATTERNS = [
  /smartzero/i,
  /vercel\.app$/i,
  /supabase\.co$/i,
  /workers\.dev$/i,
  /trycloudflare\.com$/i,
  /localtunnel\.me$/i,
  /ngrok\.io$/i,
  /ngrok-free\.app$/i,
];

export function isLoopbackHostname(hostname: string): boolean {
  const norm = hostname.toLowerCase().trim();
  return (
    norm === "127.0.0.1" ||
    norm === "localhost" ||
    norm === "::1" ||
    norm === "[::1]" ||
    norm === "0.0.0.0"
  );
}

export function validateTargetUrl(
  rawUrl: string,
  options: {
    confirmStaging?: boolean;
    allowRemoteHosts?: string[];
  } = {}
): { valid: boolean; error?: string; parsed?: URL; isLoopback: boolean } {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { valid: false, error: "Malformed URL format.", isLoopback: false };
  }

  // Reject embedded credentials
  if (parsed.username || parsed.password) {
    return { valid: false, error: "Embedded URL credentials are strictly forbidden.", isLoopback: false };
  }

  // Reject URL fragments
  if (parsed.hash) {
    return { valid: false, error: "URL fragments (#) are forbidden.", isLoopback: false };
  }

  // Reject non-execution paths
  const normPath = parsed.pathname.replace(/\/+$/, "");
  if (normPath !== "/api/judge/execute" && normPath !== "/execute") {
    return {
      valid: false,
      error: `Invalid execution endpoint path '${parsed.pathname}'. Must be '/api/judge/execute' or '/execute'.`,
      isLoopback: false,
    };
  }

  const hostname = parsed.hostname.toLowerCase();
  const isLoopback = isLoopbackHostname(hostname);

  if (isLoopback) {
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return { valid: false, error: "Loopback targets must use HTTP or HTTPS.", isLoopback: true };
    }
    return { valid: true, parsed, isLoopback: true };
  }

  // Remote Target Policy
  if (parsed.protocol !== "https:") {
    return { valid: false, error: "Remote non-loopback targets must strictly use HTTPS.", isLoopback: false };
  }

  // Check forbidden production/tunnel patterns
  for (const pattern of FORBIDDEN_HOST_PATTERNS) {
    if (pattern.test(hostname)) {
      return {
        valid: false,
        error: `Target host '${hostname}' matches forbidden production or public tunnel domain pattern.`,
        isLoopback: false,
      };
    }
  }

  // Remote staging requires explicit confirmation flag
  if (!options.confirmStaging) {
    return {
      valid: false,
      error: "Remote non-loopback staging targets require explicit '--confirm-staging' flag.",
      isLoopback: false,
    };
  }

  // Remote staging requires explicit allowlist inclusion
  const allowlist = (options.allowRemoteHosts || []).map((h) => h.toLowerCase().trim());
  if (!allowlist.includes(hostname)) {
    return {
      valid: false,
      error: `Remote host '${hostname}' is not present in the allowed remote hosts list (--allow-remote-host).`,
      isLoopback: false,
    };
  }

  return { valid: true, parsed, isLoopback: false };
}

// ─────────────────────────────────────────────────────────────
// 2. SAFE SECRET EXTRACTION
// ─────────────────────────────────────────────────────────────

export function loadJudgeSecretSafe(): { secret?: string; error?: string; source?: string } {
  const envSecret = process.env.JUDGE_WORKER_SECRET || process.env.SMARTZERO_JUDGE_SECRET;

  let fileSecret: string | undefined = undefined;
  const envLocalPath = path.resolve(process.cwd(), ".env.local");

  if (fs.existsSync(envLocalPath)) {
    try {
      const content = fs.readFileSync(envLocalPath, "utf-8");
      for (const line of content.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx > 0) {
          const key = trimmed.slice(0, eqIdx).trim();
          let val = trimmed.slice(eqIdx + 1).trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }
          if (key === "JUDGE_WORKER_SECRET" || key === "SMARTZERO_JUDGE_SECRET") {
            if (val) fileSecret = val;
          }
        }
      }
    } catch {
      // Ignored
    }
  }

  // Precedence and conflict checking
  if (envSecret && fileSecret && envSecret !== fileSecret) {
    return {
      error: "Conflict detected: Environment JUDGE_WORKER_SECRET differs from .env.local value. Fail closed.",
    };
  }

  if (envSecret) {
    return { secret: envSecret, source: "process.env" };
  }

  if (fileSecret) {
    return { secret: fileSecret, source: ".env.local" };
  }

  return {
    error: "JUDGE_WORKER_SECRET is not configured in process.env or .env.local. Secret required.",
  };
}

// ─────────────────────────────────────────────────────────────
// 3. ARGUMENT PARSER
// ─────────────────────────────────────────────────────────────

export function parseDrillArgs(argv: string[]): { args?: DrillArgs; error?: string } {
  const defaults: DrillArgs = {
    targetUrl: "http://127.0.0.1:8080/api/judge/execute",
    concurrency: 5,
    totalRequests: 20,
    language: "mixed",
    scenario: "burst",
    timeoutMs: 5000,
    seed: 42,
    dryRun: false,
    confirmStaging: false,
    allowRemoteHosts: [],
    forceOverwrite: false,
    help: false,
  };

  const args: DrillArgs = { ...defaults };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === "--help" || arg === "-h") {
      args.help = true;
      return { args };
    }

    if (arg === "--dry-run") {
      args.dryRun = true;
      continue;
    }

    if (arg === "--confirm-staging") {
      args.confirmStaging = true;
      continue;
    }

    if (arg === "--force") {
      args.forceOverwrite = true;
      continue;
    }

    if (arg === "--concurrency" || arg === "-c") {
      const val = parseInt(argv[++i], 10);
      if (isNaN(val) || val <= 0 || val > 100) {
        return { error: `Invalid concurrency '${argv[i]}'. Must be an integer between 1 and 100.` };
      }
      args.concurrency = val;
      continue;
    }

    if (arg === "--requests" || arg === "-n" || arg === "--total") {
      const val = parseInt(argv[++i], 10);
      if (isNaN(val) || val <= 0 || val > 1000) {
        return { error: `Invalid total requests '${argv[i]}'. Must be an integer between 1 and 1000.` };
      }
      args.totalRequests = val;
      continue;
    }

    if (arg === "--language" || arg === "-l") {
      const val = (argv[++i] || "").toLowerCase().trim();
      if (val !== "python" && val !== "sql" && val !== "mixed") {
        return { error: `Invalid language '${val}'. Supported: 'python', 'sql', 'mixed'.` };
      }
      args.language = val as DrillLanguage;
      continue;
    }

    if (arg === "--scenario" || arg === "-s") {
      const val = (argv[++i] || "").toLowerCase().trim();
      if (val !== "baseline" && val !== "burst") {
        return { error: `Invalid scenario '${val}'. Supported: 'baseline', 'burst'.` };
      }
      args.scenario = val as DrillScenario;
      continue;
    }

    if (arg === "--timeout-ms") {
      const val = parseInt(argv[++i], 10);
      if (isNaN(val) || val < 1000 || val > 30000) {
        return { error: `Invalid timeout-ms '${argv[i]}'. Must be between 1000 and 30000 ms.` };
      }
      args.timeoutMs = val;
      continue;
    }

    if (arg === "--seed") {
      const val = parseInt(argv[++i], 10);
      if (isNaN(val)) {
        return { error: `Invalid seed '${argv[i]}'. Must be an integer.` };
      }
      args.seed = val;
      continue;
    }

    if (arg === "--url") {
      const val = argv[++i];
      if (!val) return { error: "Missing value for --url." };
      args.targetUrl = val;
      continue;
    }

    if (arg === "--allow-remote-host") {
      const val = argv[++i];
      if (!val) return { error: "Missing value for --allow-remote-host." };
      args.allowRemoteHosts = val.split(",").map((s) => s.trim()).filter(Boolean);
      continue;
    }

    if (arg === "--output" || arg === "-o") {
      const val = argv[++i];
      if (!val) return { error: "Missing value for --output." };
      args.outputPath = val;
      continue;
    }

    return { error: `Unknown argument '${arg}'. Use --help for usage.` };
  }

  return { args };
}

// ─────────────────────────────────────────────────────────────
// 4. DETERMINISTIC PAYLOAD BUILDERS
// ─────────────────────────────────────────────────────────────

export function createPrng(seed: number): () => number {
  let s = (seed >>> 0) || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function generatePythonPayload(jobId: string, value: number, timeLimitMs: number = 2000) {
  return {
    job_id: jobId,
    submission_id: `sub-${jobId}`,
    contest_id: "drill-contest",
    question_id: "drill-q-py",
    language: "python",
    source_code: "import sys\nraw = sys.stdin.read().strip()\nif raw:\n    n = int(raw)\n    print(n * n)\n",
    execution_mode: "run",
    test_cases: [
      {
        id: "tc-py-1",
        input: `${value}\n`,
        expected_output: `${value * value}`,
        weight: 1,
        is_sample: true,
        is_hidden: false,
      },
    ],
    time_limit_ms: timeLimitMs,
    memory_limit_mb: 256,
  };
}

export function generateSqlPayload(jobId: string, threshold: number = 20, timeLimitMs: number = 2000) {
  return {
    job_id: jobId,
    submission_id: `sub-${jobId}`,
    contest_id: "drill-contest",
    question_id: "drill-q-sql",
    language: "sql",
    schema_sql: "CREATE TABLE drill_items (id INT, val INT);",
    sample_data_sql: "INSERT INTO drill_items VALUES (1, 10), (2, 20), (3, 30);",
    source_code: `SELECT id, val FROM drill_items WHERE val >= ${threshold} ORDER BY id;`,
    execution_mode: "run",
    test_cases: [
      {
        id: "tc-sql-1",
        expected_output: "id | val\n2 | 20\n3 | 30",
        weight: 1,
        is_sample: true,
        is_hidden: false,
      },
    ],
    time_limit_ms: timeLimitMs,
    memory_limit_mb: 256,
  };
}

// ─────────────────────────────────────────────────────────────
// 5. RESULT CLASSIFIER & VERIFICATION
// ─────────────────────────────────────────────────────────────

export function classifyExecutionResult(
  status: number,
  bodyText: string,
  expectedOutput: string
): { category: FailureCategory; verdict?: string; passed?: boolean; errorMessage?: string } {
  if (status === 401 || status === 403) {
    return { category: "AUTH_ERROR", errorMessage: `HTTP ${status} Unauthorized.` };
  }
  if (status === 429) {
    return { category: "RATE_LIMITED", errorMessage: "HTTP 429 Rate limited." };
  }
  if (status < 200 || status >= 300) {
    return { category: "HTTP_ERROR", errorMessage: `HTTP ${status}: ${bodyText.slice(0, 200)}` };
  }

  let data: any;
  try {
    data = JSON.parse(bodyText);
  } catch {
    return { category: "INVALID_JSON", errorMessage: "Response body was not valid JSON." };
  }

  if (!data || typeof data !== "object") {
    return { category: "INVALID_RESPONSE_SCHEMA", errorMessage: "Response body is not a JSON object." };
  }

  if (data.status !== "COMPLETED" && data.status !== "FAILED") {
    return {
      category: "UNEXPECTED_JOB_STATUS",
      verdict: data.verdict,
      errorMessage: `Unexpected job status: '${data.status}'.`,
    };
  }

  if (data.verdict !== "Accepted") {
    return {
      category: "VERDICT_MISMATCH",
      verdict: data.verdict,
      passed: false,
      errorMessage: `Expected 'Accepted' but received '${data.verdict}'.`,
    };
  }

  const sampleResult = (data.test_results || []).find((tr: any) => tr.is_sample);
  if (sampleResult && sampleResult.actual_output !== undefined) {
    const normActual = String(sampleResult.actual_output).trim().replace(/\r\n/g, "\n");
    const normExpected = expectedOutput.trim().replace(/\r\n/g, "\n");
    if (normActual !== normExpected) {
      return {
        category: "TEST_CASE_FAILURE",
        verdict: "Wrong Answer",
        passed: false,
        errorMessage: `Output mismatch. Expected: '${normExpected}', Actual: '${normActual}'`,
      };
    }
  }

  return {
    category: "SUCCESS",
    verdict: data.verdict || "Accepted",
    passed: true,
  };
}

// ─────────────────────────────────────────────────────────────
// 6. PERCENTILE CALCULATOR
// ─────────────────────────────────────────────────────────────

/**
 * Calculates standard percentiles using nearest-rank method over sorted latencies.
 */
export function calculatePercentiles(values: number[]): LatencyStats {
  if (values.length === 0) {
    return { min: 0, mean: 0, p50: 0, p95: 0, p99: 0, max: 0 };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const sum = sorted.reduce((acc, v) => acc + v, 0);
  const mean = Math.round((sum / n) * 100) / 100;

  const nearestRank = (p: number): number => {
    const idx = Math.min(Math.max(Math.ceil((p / 100) * n) - 1, 0), n - 1);
    return sorted[idx];
  };

  return {
    min: sorted[0],
    mean,
    p50: nearestRank(50),
    p95: nearestRank(95),
    p99: nearestRank(99),
    max: sorted[n - 1],
  };
}

// ─────────────────────────────────────────────────────────────
// 7. CIRCUIT BREAKER
// ─────────────────────────────────────────────────────────────

export class CircuitBreaker {
  private consecutiveTimeouts = 0;
  private totalCompleted = 0;
  private totalFailures = 0;
  private isTripped = false;
  private tripReason?: string;

  recordOutcome(category: FailureCategory): void {
    if (this.isTripped) return;

    this.totalCompleted++;

    if (category === "AUTH_ERROR") {
      this.trip("Authentication failure received during execution.");
      return;
    }

    if (category === "TIMEOUT") {
      this.consecutiveTimeouts++;
      this.totalFailures++;
      if (this.consecutiveTimeouts >= 3) {
        this.trip("3 consecutive request timeouts observed.");
        return;
      }
    } else if (category === "SUCCESS") {
      this.consecutiveTimeouts = 0;
    } else {
      this.consecutiveTimeouts = 0;
      this.totalFailures++;
    }

    if (this.totalCompleted >= 5) {
      const failureRate = this.totalFailures / this.totalCompleted;
      if (failureRate > 0.2) {
        this.trip(`Cumulative failure rate exceeded 20% (${(failureRate * 100).toFixed(1)}%).`);
      }
    }
  }

  trip(reason: string): void {
    this.isTripped = true;
    this.tripReason = reason;
  }

  tripped(): boolean {
    return this.isTripped;
  }

  reason(): string | undefined {
    return this.tripReason;
  }
}

// ─────────────────────────────────────────────────────────────
// 8. DRILL RUNNER ENGINE
// ─────────────────────────────────────────────────────────────

export async function runJudgeConcurrencyDrill(args: DrillArgs): Promise<DrillReport> {
  const targetCheck = validateTargetUrl(args.targetUrl, {
    confirmStaging: args.confirmStaging,
    allowRemoteHosts: args.allowRemoteHosts,
  });

  if (!targetCheck.valid || !targetCheck.parsed) {
    throw new Error(`Target Validation Failure: ${targetCheck.error}`);
  }

  const parsedUrl = targetCheck.parsed;
  const baseUrl = `${parsedUrl.protocol}//${parsedUrl.host}`;
  const healthUrl = `${baseUrl}/health`;
  const readyUrl = `${baseUrl}/ready`;
  const executeUrl = targetCheck.parsed.toString();

  // Load Secret
  const secretResult = loadJudgeSecretSafe();
  if (secretResult.error || !secretResult.secret) {
    throw new Error(`Secret Validation Failure: ${secretResult.error}`);
  }
  const secret = secretResult.secret;

  // 1. Health Probe
  console.log(`[Preflight] Checking health probe at ${healthUrl}...`);
  let healthOk = false;
  let workerName: string | undefined;
  try {
    const healthRes = await fetch(healthUrl, {
      headers: { Connection: "close" },
      signal: AbortSignal.timeout(5000),
      redirect: "error",
    });
    if (healthRes.ok) {
      const data = await healthRes.json();
      if (data?.status === "ok") {
        healthOk = true;
        workerName = data?.worker;
      }
    }
  } catch (err: any) {
    throw new Error(`Health probe failed at ${healthUrl}: ${err.message}`);
  }

  if (!healthOk) {
    throw new Error(`Health probe at ${healthUrl} did not return status 'ok'.`);
  }
  console.log(`  ✅ Health probe OK (worker: ${workerName || "unknown"})`);

  // 2. Readiness Probe
  console.log(`[Preflight] Checking readiness probe at ${readyUrl}...`);
  let readinessOk = false;
  let reportedConcurrency: number | undefined;
  let reportedRuntimes: string[] | undefined;
  try {
    const readyRes = await fetch(readyUrl, {
      headers: { Connection: "close" },
      signal: AbortSignal.timeout(5000),
      redirect: "error",
    });
    if (readyRes.ok) {
      const data = await readyRes.json();
      if (data?.ready === true) {
        readinessOk = true;
        reportedConcurrency = data?.concurrency;
        reportedRuntimes = data?.runtimes;
      }
    }
  } catch (err: any) {
    throw new Error(`Readiness probe failed at ${readyUrl}: ${err.message}`);
  }

  if (!readinessOk) {
    throw new Error(`Readiness probe at ${readyUrl} did not report ready: true.`);
  }
  console.log(`  ✅ Readiness probe OK (worker concurrency: ${reportedConcurrency ?? "N/A"})`);

  // DRY-RUN EXIT
  if (args.dryRun) {
    console.log("\n[DRY RUN] Mode enabled. Read-only checks passed. Zero execution POST requests sent.");
    const dryRunReport: DrillReport = {
      timestamp: new Date().toISOString(),
      target: {
        url: args.targetUrl,
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (parsedUrl.protocol === "https:" ? "443" : "80"),
        protocol: parsedUrl.protocol,
        isLoopback: targetCheck.isLoopback,
      },
      config: { ...args },
      workerInfo: {
        workerName,
        reportedConcurrency,
        runtimes: reportedRuntimes,
      },
      preflight: { healthOk, readinessOk },
      circuitBreaker: { triggered: false },
      executionSummary: {
        requestsPrepared: args.totalRequests,
        requestsDispatched: 0,
        requestsCompleted: 0,
        requestsSuccessful: 0,
        requestsFailed: 0,
        requestsSkipped: args.totalRequests,
        timeoutCount: 0,
        totalWallClockMs: 0,
        dispatchWindowMs: 0,
        throughputRps: 0,
        queueWaitMetric: "unavailable",
        queueWaitNote: "Direct HTTP worker endpoint executes via priority queue but does not expose queue wait timestamps in response.",
      },
      latencies: { min: 0, mean: 0, p50: 0, p95: 0, p99: 0, max: 0 },
      perLanguage: {},
      httpStatusDistribution: {},
      categoryDistribution: {},
      exitCode: 0,
    };

    if (args.outputPath) {
      const resolvedOut = path.resolve(process.cwd(), args.outputPath);
      if (fs.existsSync(resolvedOut) && !args.forceOverwrite) {
        console.warn(`[Report Export] File '${args.outputPath}' exists. Use --force to overwrite.`);
      } else {
        fs.mkdirSync(path.dirname(resolvedOut), { recursive: true });
        fs.writeFileSync(resolvedOut, JSON.stringify(dryRunReport, null, 2), "utf-8");
        console.log(`[Report Export] Saved sanitized report to: ${args.outputPath}`);
      }
    }

    return dryRunReport;
  }

  // 3. Canary Request (Exactly 1 Authenticated Test)
  console.log(`[Preflight] Executing 1 authenticated canary job...`);
  const canaryStart = performance.now();
  const canaryPayload = generatePythonPayload("canary-01", 9, 2000);
  let canaryVerdict = "UNKNOWN";
  let canaryLatencyMs = 0;

  try {
    const canaryRes = await fetch(executeUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${secret}`,
        "x-smartzero-worker-secret": secret,
      },
      body: JSON.stringify(canaryPayload),
      signal: AbortSignal.timeout(args.timeoutMs),
      redirect: "error",
    });

    canaryLatencyMs = Math.round(performance.now() - canaryStart);
    const bodyText = await canaryRes.text();
    const classified = classifyExecutionResult(canaryRes.status, bodyText, "81");

    if (classified.category !== "SUCCESS") {
      throw new Error(`Canary job failed (${classified.category}): ${classified.errorMessage}`);
    }
    canaryVerdict = classified.verdict || "Accepted";
    console.log(`  ✅ Canary OK (Verdict: ${canaryVerdict}, Latency: ${canaryLatencyMs}ms)`);
  } catch (err: any) {
    throw new Error(`Preflight canary failed: ${err.message}`);
  }

  // Baseline Scenario exits after Canary
  if (args.scenario === "baseline") {
    console.log("\n[Baseline] Scenario completed successfully with 1 canary test.");
    return {
      timestamp: new Date().toISOString(),
      target: {
        url: args.targetUrl,
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (parsedUrl.protocol === "https:" ? "443" : "80"),
        protocol: parsedUrl.protocol,
        isLoopback: targetCheck.isLoopback,
      },
      config: { ...args },
      workerInfo: { workerName, reportedConcurrency, runtimes: reportedRuntimes },
      preflight: { healthOk, readinessOk, canaryLatencyMs, canaryVerdict },
      circuitBreaker: { triggered: false },
      executionSummary: {
        requestsPrepared: 1,
        requestsDispatched: 1,
        requestsCompleted: 1,
        requestsSuccessful: 1,
        requestsFailed: 0,
        requestsSkipped: 0,
        timeoutCount: 0,
        totalWallClockMs: canaryLatencyMs,
        dispatchWindowMs: 0,
        throughputRps: Math.round(1000 / Math.max(canaryLatencyMs, 1)),
        queueWaitMetric: "unavailable",
        queueWaitNote: "Direct HTTP worker endpoint does not expose queue wait timestamps in response.",
      },
      latencies: calculatePercentiles([canaryLatencyMs]),
      perLanguage: {
        python: {
          total: 1,
          successCount: 1,
          failureCount: 0,
          latencies: calculatePercentiles([canaryLatencyMs]),
        },
      },
      httpStatusDistribution: { "200": 1 },
      categoryDistribution: { SUCCESS: 1 },
      exitCode: 0,
    };
  }

  // ─────────────────────────────────────────────────────────────
  // 4. CONTROLLED CONCURRENCY BURST EXECUTION
  // ─────────────────────────────────────────────────────────────
  console.log(`\n==================================================`);
  console.log(`▶ LAUNCHING CONTROLLED DRILL: ${args.totalRequests} Requests @ Concurrency ${args.concurrency}`);
  console.log(`  Language: ${args.language} | Timeout: ${args.timeoutMs}ms | Seed: ${args.seed}`);
  console.log(`==================================================\n`);

  const prng = createPrng(args.seed);
  const breaker = new CircuitBreaker();
  const records: RequestRecord[] = [];
  const overallStart = performance.now();

  const numWaves = Math.ceil(args.totalRequests / args.concurrency);
  let preparedCount = 0;
  let dispatchedCount = 0;
  let skippedCount = 0;
  let minDispatchTime = Infinity;
  let maxDispatchTime = 0;

  for (let waveIdx = 0; waveIdx < numWaves; waveIdx++) {
    if (breaker.tripped()) {
      const remaining = args.totalRequests - dispatchedCount;
      skippedCount += remaining;
      console.warn(`[CIRCUIT BREAKER] Tripped: ${breaker.reason()}. Skipping remaining ${remaining} requests.`);
      break;
    }

    const waveSize = Math.min(args.concurrency, args.totalRequests - dispatchedCount);
    const waveItems: {
      slot: number;
      jobId: string;
      language: "python" | "sql";
      payload: any;
      expectedOutput: string;
    }[] = [];

    // Prepare Wave Payloads
    for (let slot = 0; slot < waveSize; slot++) {
      const reqIdx = dispatchedCount + slot + 1;
      preparedCount++;
      const jobId = `drill-${Date.now()}-${waveIdx}-${slot}`;

      let lang: "python" | "sql";
      if (args.language === "python") lang = "python";
      else if (args.language === "sql") lang = "sql";
      else lang = prng() < 0.5 ? "python" : "sql";

      if (lang === "python") {
        const val = 10 + (reqIdx % 50);
        waveItems.push({
          slot,
          jobId,
          language: "python",
          payload: generatePythonPayload(jobId, val, 2000),
          expectedOutput: `${val * val}`,
        });
      } else {
        waveItems.push({
          slot,
          jobId,
          language: "sql",
          payload: generateSqlPayload(jobId, 20, 2000),
          expectedOutput: "id | val\n2 | 20\n3 | 30",
        });
      }
    }

    // Barrier Dispatch
    const waveDispatchedAt = performance.now();
    minDispatchTime = Math.min(minDispatchTime, waveDispatchedAt);
    maxDispatchTime = Math.max(maxDispatchTime, waveDispatchedAt);

    console.log(`[Wave ${waveIdx + 1}/${numWaves}] Dispatching ${waveSize} synchronized requests...`);

    const wavePromises = waveItems.map(async (item) => {
      dispatchedCount++;
      const itemDispatchTime = performance.now();

      const controller = new AbortController();
      const timeoutHandle = setTimeout(() => controller.abort(), args.timeoutMs);

      try {
        const res = await fetch(executeUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${secret}`,
            "x-smartzero-worker-secret": secret,
          },
          body: JSON.stringify(item.payload),
          signal: controller.signal,
          redirect: "error",
        });

        clearTimeout(timeoutHandle);
        const itemCompletedTime = performance.now();
        const durationMs = Math.round(itemCompletedTime - itemDispatchTime);

        const bodyText = await res.text();
        const classified = classifyExecutionResult(res.status, bodyText, item.expectedOutput);
        breaker.recordOutcome(classified.category);

        const record: RequestRecord = {
          jobId: item.jobId,
          language: item.language,
          waveIndex: waveIdx,
          slotIndex: item.slot,
          dispatchedAtMonotonic: itemDispatchTime,
          completedAtMonotonic: itemCompletedTime,
          durationMs,
          httpStatus: res.status,
          category: classified.category,
          verdict: classified.verdict,
          passed: classified.passed,
          errorMessage: classified.errorMessage,
        };
        records.push(record);
        return record;
      } catch (err: any) {
        clearTimeout(timeoutHandle);
        const itemCompletedTime = performance.now();
        const durationMs = Math.round(itemCompletedTime - itemDispatchTime);

        const isTimeout = err?.name === "AbortError" || controller.signal.aborted;
        const category: FailureCategory = isTimeout ? "TIMEOUT" : "NETWORK_ERROR";
        breaker.recordOutcome(category);

        const record: RequestRecord = {
          jobId: item.jobId,
          language: item.language,
          waveIndex: waveIdx,
          slotIndex: item.slot,
          dispatchedAtMonotonic: itemDispatchTime,
          completedAtMonotonic: itemCompletedTime,
          durationMs,
          category,
          passed: false,
          errorMessage: isTimeout ? `Request timed out after ${args.timeoutMs}ms.` : err?.message,
        };
        records.push(record);
        return record;
      }
    });

    await Promise.all(wavePromises);
  }

  const overallDurationMs = Math.round(performance.now() - overallStart);
  const dispatchWindowMs = Math.round(maxDispatchTime - minDispatchTime);

  // ─────────────────────────────────────────────────────────────
  // 5. METRICS AGGREGATION
  // ─────────────────────────────────────────────────────────────
  const completedCount = records.length;
  const successCount = records.filter((r) => r.category === "SUCCESS").length;
  const failureCount = completedCount - successCount;
  const timeoutCount = records.filter((r) => r.category === "TIMEOUT").length;

  const latencies = records.map((r) => r.durationMs);
  const overallLatencyStats = calculatePercentiles(latencies);

  // Per-language breakdowns
  const pyRecords = records.filter((r) => r.language === "python");
  const sqlRecords = records.filter((r) => r.language === "sql");

  const pyMetrics: LanguageMetrics | undefined =
    pyRecords.length > 0
      ? {
          total: pyRecords.length,
          successCount: pyRecords.filter((r) => r.category === "SUCCESS").length,
          failureCount: pyRecords.filter((r) => r.category !== "SUCCESS").length,
          latencies: calculatePercentiles(pyRecords.map((r) => r.durationMs)),
        }
      : undefined;

  const sqlMetrics: LanguageMetrics | undefined =
    sqlRecords.length > 0
      ? {
          total: sqlRecords.length,
          successCount: sqlRecords.filter((r) => r.category === "SUCCESS").length,
          failureCount: sqlRecords.filter((r) => r.category !== "SUCCESS").length,
          latencies: calculatePercentiles(sqlRecords.map((r) => r.durationMs)),
        }
      : undefined;

  const httpDist: Record<string, number> = {};
  const catDist: Record<string, number> = {};

  for (const r of records) {
    if (r.httpStatus) {
      const codeStr = String(r.httpStatus);
      httpDist[codeStr] = (httpDist[codeStr] || 0) + 1;
    }
    catDist[r.category] = (catDist[r.category] || 0) + 1;
  }

  const throughputRps =
    overallDurationMs > 0 ? Math.round((completedCount / (overallDurationMs / 1000)) * 100) / 100 : 0;

  let exitCode = 0;
  if (breaker.tripped()) {
    exitCode = 3;
  } else if (failureCount > 0) {
    exitCode = 1;
  }

  const report: DrillReport = {
    timestamp: new Date().toISOString(),
    target: {
      url: args.targetUrl,
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === "https:" ? "443" : "80"),
      protocol: parsedUrl.protocol,
      isLoopback: targetCheck.isLoopback,
    },
    config: { ...args },
    workerInfo: { workerName, reportedConcurrency, runtimes: reportedRuntimes },
    preflight: { healthOk, readinessOk, canaryLatencyMs, canaryVerdict },
    circuitBreaker: {
      triggered: breaker.tripped(),
      reason: breaker.reason(),
    },
    executionSummary: {
      requestsPrepared: preparedCount,
      requestsDispatched: dispatchedCount,
      requestsCompleted: completedCount,
      requestsSuccessful: successCount,
      requestsFailed: failureCount,
      requestsSkipped: skippedCount,
      timeoutCount,
      totalWallClockMs: overallDurationMs,
      dispatchWindowMs,
      throughputRps,
      queueWaitMetric: "unavailable",
      queueWaitNote:
        "Direct HTTP execution endpoint executes via priority queue but does not expose server queue wait timestamps in response.",
    },
    latencies: overallLatencyStats,
    perLanguage: {
      python: pyMetrics,
      sql: sqlMetrics,
    },
    httpStatusDistribution: httpDist,
    categoryDistribution: catDist,
    exitCode,
  };

  // ─────────────────────────────────────────────────────────────
  // 6. CONSOLE SUMMARY DISPLAY
  // ─────────────────────────────────────────────────────────────
  console.log(`\n==================================================`);
  console.log(`📊 CONCURRENCY DRILL SUMMARY REPORT`);
  console.log(`==================================================`);
  console.log(`Target:               ${report.target.url} (${report.target.isLoopback ? "Loopback" : "Remote Staging"})`);
  console.log(`Concurrency:          ${report.config.concurrency} workers`);
  console.log(`Total Requests:       ${report.config.totalRequests}`);
  console.log(`Dispatched / Done:    ${report.executionSummary.requestsDispatched} / ${report.executionSummary.requestsCompleted}`);
  console.log(`Successful:           ${report.executionSummary.requestsSuccessful}`);
  console.log(`Failed / Timeouts:    ${report.executionSummary.requestsFailed} / ${report.executionSummary.timeoutCount}`);
  if (report.circuitBreaker.triggered) {
    console.log(`Circuit Breaker:      TRIPPED (${report.circuitBreaker.reason})`);
  } else {
    console.log(`Circuit Breaker:      CLEAN`);
  }
  console.log(`Total Wall Clock:     ${report.executionSummary.totalWallClockMs} ms`);
  console.log(`Dispatch Window:      ${report.executionSummary.dispatchWindowMs} ms (Node barrier)`);
  console.log(`Throughput:           ${report.executionSummary.throughputRps} req/sec`);
  console.log(`Queue Wait Time:      UNAVAILABLE (Total latency includes queue + exec)`);
  console.log(`Latency min / p50:    ${report.latencies.min} ms / ${report.latencies.p50} ms`);
  console.log(`Latency p95 / p99:    ${report.latencies.p95} ms / ${report.latencies.p99} ms`);
  console.log(`Latency max / mean:   ${report.latencies.max} ms / ${report.latencies.mean} ms`);

  if (pyMetrics) {
    console.log(`\n[Python Metrics] Count: ${pyMetrics.total} | OK: ${pyMetrics.successCount} | p50: ${pyMetrics.latencies.p50}ms | p95: ${pyMetrics.latencies.p95}ms`);
  }
  if (sqlMetrics) {
    console.log(`[SQL Metrics]    Count: ${sqlMetrics.total} | OK: ${sqlMetrics.successCount} | p50: ${sqlMetrics.latencies.p50}ms | p95: ${sqlMetrics.latencies.p95}ms`);
  }

  console.log(`\nExit Code: ${report.exitCode} (${report.exitCode === 0 ? "PASSED" : "FAILED/ABORTED"})`);
  console.log(`==================================================\n`);

  // Optional JSON Report Export
  if (args.outputPath) {
    const resolvedOut = path.resolve(process.cwd(), args.outputPath);
    if (fs.existsSync(resolvedOut) && !args.forceOverwrite) {
      console.warn(`[Report Export] File '${args.outputPath}' exists. Use --force to overwrite.`);
    } else {
      fs.mkdirSync(path.dirname(resolvedOut), { recursive: true });
      fs.writeFileSync(resolvedOut, JSON.stringify(report, null, 2), "utf-8");
      console.log(`[Report Export] Saved sanitized report to: ${args.outputPath}`);
    }
  }

  return report;
}

// ─────────────────────────────────────────────────────────────
// 9. CLI ENTRY POINT
// ─────────────────────────────────────────────────────────────

export async function main() {
  const { args, error } = parseDrillArgs(process.argv.slice(2));

  if (error) {
    console.error(`Error: ${error}`);
    console.log("Run with --help for usage information.");
    process.exit(2);
  }

  if (!args || args.help) {
    console.log(`
SmartZero 2.0 Judge Concurrency Mock-Drill Tool

Usage:
  npx tsx scripts/judge_concurrency_drill.ts [options]

Options:
  --concurrency, -c <N>       Concurrent requests in-flight (1..100, default: 5)
  --requests, -n <N>          Total requests to execute (1..1000, default: 20)
  --language, -l <lang>       'python' | 'sql' | 'mixed' (default: 'mixed')
  --scenario, -s <scenario>   'baseline' (1 canary) | 'burst' (wave-based) (default: 'burst')
  --timeout-ms <N>            Per-request HTTP timeout in ms (1000..30000, default: 5000)
  --seed <N>                  Integer seed for deterministic mixed language distribution (default: 42)
  --url <url>                 Target judge execution endpoint (default: http://127.0.0.1:8080/api/judge/execute)
  --dry-run                   Validate preflight & configuration without executing code
  --confirm-staging           Required confirmation when targeting remote staging
  --allow-remote-host <hosts> Comma-separated list of permitted remote staging hosts
  --output, -o <path>         Write sanitized JSON summary report to file
  --force                     Overwrite output file if it exists
  --help, -h                  Show this help text

Safety Rules:
  - Default target is strictly loopback (http://127.0.0.1:8080/api/judge/execute).
  - Maximum concurrency is capped at 100.
  - Automatic circuit breaker aborts if failure rate > 20% or 3 consecutive timeouts occur.
  - Never prints or leaks authentication secrets.
`);
    return;
  }

  try {
    const report = await runJudgeConcurrencyDrill(args);
    process.exitCode = report.exitCode;
  } catch (err: any) {
    console.error(`\n[FATAL ERROR]: ${err.message}`);
    process.exitCode = err.message.includes("Target Validation") || err.message.includes("Secret Validation") ? 2 : 4;
  }
}

// Execute if run directly
const currentFilePath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(currentFilePath)) {
  main();
}
