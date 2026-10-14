import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type {
  JudgeWorkerJobRequest,
  JudgeWorkerJobResponse,
  SafeTestCaseResult,
} from "../lib/judge/types";
import { formatSqlTable } from "../lib/judge/sqlEngine";

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
  | "UNEXPECTED_REDIRECT"
  | "INVALID_JSON"
  | "INVALID_RESPONSE_SCHEMA"
  | "UNEXPECTED_JOB_STATUS"
  | "VERDICT_MISMATCH"
  | "TEST_CASE_FAILURE"
  | "ABORTED_BY_CIRCUIT_BREAKER"
  | "CANCELLED_NOT_DISPATCHED";

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
    requestsAbortedInFlight: number;
    requestsSkipped: number;
    timeoutCount: number;
    totalWallClockMs: number;
    dispatchWindowMs: number;
    throughputRps: number;
    queueWaitMetric: "unavailable";
    queueWaitNote: string;
    cancellationNotice: string;
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

const APPROVED_LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);
const DEFAULT_JUDGE_PORT = process.env.PORT || "8080";

const FORBIDDEN_HOST_PATTERNS = [
  /smartzero/i,
  /vercel\.app$/i,
  /supabase\.co$/i,
  /workers\.dev$/i,
  /trycloudflare\.com$/i,
  /cloudflarepreview\.com$/i,
  /localtunnel\.me$/i,
  /ngrok\.io$/i,
  /ngrok-free\.app$/i,
  /herokuapp\.com$/i,
  /fly\.dev$/i,
  /render\.com$/i,
  /railway\.app$/i,
  /amazonaws\.com$/i,
];

export function isLoopbackHostname(hostname: string): boolean {
  const norm = hostname.toLowerCase().trim();
  return APPROVED_LOOPBACK_HOSTS.has(norm);
}

export function validateTargetUrl(
  rawUrl: string,
  options: {
    confirmStaging?: boolean;
    allowRemoteHosts?: string[];
    intendedPort?: string;
  } = {}
): { valid: boolean; error?: string; parsed?: URL; isLoopback: boolean } {
  if (!rawUrl || typeof rawUrl !== "string" || !rawUrl.trim()) {
    return { valid: false, error: "Target URL cannot be empty.", isLoopback: false };
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    return { valid: false, error: "Malformed URL format.", isLoopback: false };
  }

  // Reject embedded credentials
  if (parsed.username || parsed.password) {
    return { valid: false, error: "Embedded URL credentials are strictly forbidden.", isLoopback: false };
  }

  // Reject URL fragments
  if (parsed.hash) {
    return { valid: false, error: "URL fragments (#) are strictly forbidden.", isLoopback: false };
  }

  // Reject query parameters
  if (parsed.search) {
    return { valid: false, error: "Query parameters (?) are strictly forbidden in target URL.", isLoopback: false };
  }

  // Reject non-execution paths
  const normPath = parsed.pathname.replace(/\/+$/, "");
  if (normPath !== "/api/judge/execute" && normPath !== "/execute") {
    return {
      valid: false,
      error: `Invalid execution endpoint path '${parsed.pathname}'. Path must be '/api/judge/execute' or '/execute'.`,
      isLoopback: false,
    };
  }

  const hostname = parsed.hostname.toLowerCase();
  const isLoopback = isLoopbackHostname(hostname);
  const requiredPort = options.intendedPort || DEFAULT_JUDGE_PORT;

  if (isLoopback) {
    if (parsed.protocol !== "http:") {
      return { valid: false, error: "Local loopback judge target must strictly use HTTP (not HTTPS or other protocols).", isLoopback: true };
    }
    const targetPort = parsed.port;
    if (!targetPort) {
      return { valid: false, error: `Local loopback target must explicitly specify the intended judge port (expected :${requiredPort}).`, isLoopback: true };
    }
    if (targetPort !== requiredPort) {
      return { valid: false, error: `Local loopback port '${targetPort}' does not match the intended judge port '${requiredPort}'.`, isLoopback: true };
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
      error: "Remote non-loopback staging targets require explicit '--confirm-staging' confirmation flag.",
      isLoopback: false,
    };
  }

  // Remote staging requires explicit allowlist inclusion
  const allowlist = (options.allowRemoteHosts || []).map((h) => h.toLowerCase().trim()).filter(Boolean);
  if (allowlist.length === 0 || !allowlist.includes(hostname)) {
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
// 3. STRICT ARGUMENT PARSER
// ─────────────────────────────────────────────────────────────

export function parseStrictInt(raw: string | undefined, flagName: string): { value?: number; error?: string } {
  if (raw === undefined || raw === "") {
    return { error: `Missing value for flag '${flagName}'.` };
  }
  if (raw.startsWith("-") && raw.length > 1 && !/^-?\d+$/.test(raw)) {
    return { error: `Missing value for flag '${flagName}'. Encountered flag '${raw}' instead.` };
  }
  const trimmed = raw.trim();
  if (!/^-?\d+$/.test(trimmed)) {
    return { error: `Invalid integer value for '${flagName}': '${raw}'. Non-integer characters are not allowed.` };
  }
  const val = Number(trimmed);
  if (!Number.isSafeInteger(val)) {
    return { error: `Value for '${flagName}' exceeds safe integer limits: '${raw}'.` };
  }
  return { value: val };
}

export function parseDrillArgs(argv: string[]): { args?: DrillArgs; error?: string } {
  const defaults: DrillArgs = {
    targetUrl: `http://127.0.0.1:${DEFAULT_JUDGE_PORT}/api/judge/execute`,
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
      if (i + 1 >= argv.length) return { error: `Missing value for flag '${arg}'.` };
      const res = parseStrictInt(argv[++i], arg);
      if (res.error) return { error: res.error };
      if (res.value! <= 0 || res.value! > 100) {
        return { error: `Invalid concurrency '${res.value}'. Must be an integer between 1 and 100.` };
      }
      args.concurrency = res.value!;
      continue;
    }

    if (arg === "--requests" || arg === "-n" || arg === "--total") {
      if (i + 1 >= argv.length) return { error: `Missing value for flag '${arg}'.` };
      const res = parseStrictInt(argv[++i], arg);
      if (res.error) return { error: res.error };
      if (res.value! <= 0 || res.value! > 1000) {
        return { error: `Invalid total requests '${res.value}'. Must be an integer between 1 and 1000.` };
      }
      args.totalRequests = res.value!;
      continue;
    }

    if (arg === "--language" || arg === "-l") {
      if (i + 1 >= argv.length || (argv[i + 1].startsWith("-") && argv[i + 1].length > 1)) {
        return { error: `Missing value for flag '${arg}'.` };
      }
      const val = argv[++i].toLowerCase().trim();
      if (val !== "python" && val !== "sql" && val !== "mixed") {
        return { error: `Invalid language '${val}'. Supported: 'python', 'sql', 'mixed'.` };
      }
      args.language = val as DrillLanguage;
      continue;
    }

    if (arg === "--scenario" || arg === "-s") {
      if (i + 1 >= argv.length || (argv[i + 1].startsWith("-") && argv[i + 1].length > 1)) {
        return { error: `Missing value for flag '${arg}'.` };
      }
      const val = argv[++i].toLowerCase().trim();
      if (val !== "baseline" && val !== "burst") {
        return { error: `Invalid scenario '${val}'. Supported: 'baseline', 'burst'.` };
      }
      args.scenario = val as DrillScenario;
      continue;
    }

    if (arg === "--timeout-ms") {
      if (i + 1 >= argv.length) return { error: `Missing value for flag '${arg}'.` };
      const res = parseStrictInt(argv[++i], arg);
      if (res.error) return { error: res.error };
      if (res.value! < 1000 || res.value! > 60000) {
        return { error: `Invalid timeout-ms '${res.value}'. Must be between 1000 and 60000 ms.` };
      }
      args.timeoutMs = res.value!;
      continue;
    }

    if (arg === "--seed") {
      if (i + 1 >= argv.length) return { error: `Missing value for flag '${arg}'.` };
      const res = parseStrictInt(argv[++i], arg);
      if (res.error) return { error: res.error };
      args.seed = res.value!;
      continue;
    }

    if (arg === "--url") {
      if (i + 1 >= argv.length || (argv[i + 1].startsWith("-") && argv[i + 1].length > 1)) {
        return { error: "Missing value for flag '--url'." };
      }
      const val = argv[++i].trim();
      if (!val) return { error: "Target URL cannot be empty." };
      args.targetUrl = val;
      continue;
    }

    if (arg === "--allow-remote-host") {
      if (i + 1 >= argv.length || (argv[i + 1].startsWith("-") && argv[i + 1].length > 1)) {
        return { error: "Missing value for flag '--allow-remote-host'." };
      }
      const val = argv[++i].trim();
      args.allowRemoteHosts = val.split(",").map((s) => s.trim()).filter(Boolean);
      continue;
    }

    if (arg === "--output" || arg === "-o") {
      if (i + 1 >= argv.length || (argv[i + 1].startsWith("-") && argv[i + 1].length > 1)) {
        return { error: "Missing value for flag '--output'." };
      }
      const val = argv[++i].trim();
      if (!val) return { error: "Output path cannot be empty." };
      args.outputPath = val;
      continue;
    }

    return { error: `Unknown argument '${arg}'. Use --help for usage.` };
  }

  // Validate conflicting options
  if (args.dryRun && args.scenario === "baseline") {
    return {
      error: "Conflicting options: '--dry-run' (0 execution requests) cannot be combined with '--scenario baseline' (which executes an authenticated canary).",
    };
  }

  if (args.scenario === "baseline" && args.totalRequests > 1) {
    return {
      error: "Conflicting options: '--scenario baseline' runs exactly 1 canary request. Total requests cannot exceed 1.",
    };
  }

  // Pre-validate report output overwrite
  if (args.outputPath) {
    const resolved = path.resolve(process.cwd(), args.outputPath);
    if (fs.existsSync(resolved) && !args.forceOverwrite) {
      return {
        error: `Output file '${args.outputPath}' already exists. Use '--force' to overwrite.`,
      };
    }
  }

  return { args };
}

// ─────────────────────────────────────────────────────────────
// 4. DETERMINISTIC PAYLOAD BUILDERS (MATCHING REAL JUDGE API)
// ─────────────────────────────────────────────────────────────

export function generatePythonPayload(
  jobId: string,
  value: number,
  timeLimitMs: number = 2000
): JudgeWorkerJobRequest {
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
    total_marks: 20,
  };
}

export function generateSqlPayload(
  jobId: string,
  threshold: number = 20,
  timeLimitMs: number = 2000
): JudgeWorkerJobRequest {
  const expectedTable = formatSqlTable(
    ["id", "val"],
    [
      [2, 20],
      [3, 30],
    ]
  );

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
    order_sensitive: true,
    test_cases: [
      {
        id: "tc-sql-1",
        input: "",
        expected_output: expectedTable,
        weight: 1,
        is_sample: true,
        is_hidden: false,
      },
    ],
    time_limit_ms: timeLimitMs,
    memory_limit_mb: 256,
    total_marks: 20,
  };
}

// ─────────────────────────────────────────────────────────────
// 5. RESULT CLASSIFIER & VERIFICATION
// ─────────────────────────────────────────────────────────────

export function classifyExecutionResult(
  status: number,
  bodyText: string,
  options: {
    expectedJobId?: string;
    expectedOutput?: string;
    language?: "python" | "sql";
  } = {}
): { category: FailureCategory; verdict?: string; passed?: boolean; errorMessage?: string } {
  if (status === 301 || status === 302 || status === 303 || status === 307 || status === 308) {
    return { category: "UNEXPECTED_REDIRECT", errorMessage: `HTTP ${status} redirect received. Redirects are strictly rejected.` };
  }
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

  if (options.expectedJobId && data.job_id !== options.expectedJobId) {
    return {
      category: "INVALID_RESPONSE_SCHEMA",
      errorMessage: `Job ID mismatch: expected '${options.expectedJobId}', received '${data.job_id}'.`,
    };
  }

  if (!data.status || typeof data.status !== "string") {
    return { category: "INVALID_RESPONSE_SCHEMA", errorMessage: "Missing mandatory 'status' field." };
  }

  if (!data.verdict || typeof data.verdict !== "string") {
    return { category: "INVALID_RESPONSE_SCHEMA", errorMessage: "Missing mandatory 'verdict' field." };
  }

  if (data.status !== "COMPLETED") {
    return {
      category: "UNEXPECTED_JOB_STATUS",
      verdict: data.verdict,
      errorMessage: `Job did not reach completed terminal status: status is '${data.status}'.`,
    };
  }

  // Missing test results must not count as success
  if (!Array.isArray(data.test_results) || data.test_results.length === 0) {
    return {
      category: "INVALID_RESPONSE_SCHEMA",
      verdict: data.verdict,
      passed: false,
      errorMessage:
        "Missing mandatory 'test_results' array or test results array is empty. Missing test results must not count as success.",
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

  // Verify all test case items in test_results
  for (const tr of data.test_results) {
    if (!tr.passed || tr.verdict !== "Accepted") {
      return {
        category: "TEST_CASE_FAILURE",
        verdict: tr.verdict || "Wrong Answer",
        passed: false,
        errorMessage: `Test case index ${tr.index || 1} failed: verdict '${tr.verdict}', passed=${tr.passed}.`,
      };
    }
  }

  // Verify sample output against expected format
  if (options.expectedOutput !== undefined) {
    const sampleResult = data.test_results.find((tr: any) => tr.is_sample) || data.test_results[0];
    if (!sampleResult || sampleResult.actual_output === undefined) {
      return {
        category: "TEST_CASE_FAILURE",
        verdict: data.verdict,
        passed: false,
        errorMessage: "Sample test case result missing actual_output.",
      };
    }

    const normActual = String(sampleResult.actual_output).trim().replace(/\r\n/g, "\n");
    const normExpected = String(options.expectedOutput).trim().replace(/\r\n/g, "\n");

    if (normActual !== normExpected) {
      return {
        category: "TEST_CASE_FAILURE",
        verdict: "Wrong Answer",
        passed: false,
        errorMessage: `Output mismatch. Expected:\n'${normExpected}'\nActual:\n'${normActual}'`,
      };
    }

    // Additional structured validation for SQL
    if (options.language === "sql" && sampleResult.columns && sampleResult.rows) {
      if (!Array.isArray(sampleResult.columns) || sampleResult.columns.length !== 2) {
        return {
          category: "TEST_CASE_FAILURE",
          verdict: "Wrong Answer",
          passed: false,
          errorMessage: `SQL column schema mismatch: expected 2 columns ('id', 'val'), received ${JSON.stringify(sampleResult.columns)}.`,
        };
      }
      if (!Array.isArray(sampleResult.rows) || sampleResult.rows.length !== 2) {
        return {
          category: "TEST_CASE_FAILURE",
          verdict: "Wrong Answer",
          passed: false,
          errorMessage: `SQL row count mismatch: expected 2 rows, received ${sampleResult.rows.length}.`,
        };
      }
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
  private abortController = new AbortController();

  get signal(): AbortSignal {
    return this.abortController.signal;
  }

  tripped(): boolean {
    return this.isTripped;
  }

  reason(): string | undefined {
    return this.tripReason;
  }

  trip(reason: string): void {
    if (this.isTripped) return;
    this.isTripped = true;
    this.tripReason = reason;
    try {
      this.abortController.abort(new Error(reason));
    } catch {
      // ignore
    }
  }

  recordOutcome(category: FailureCategory): void {
    if (this.isTripped) return;

    this.totalCompleted++;

    if (category === "AUTH_ERROR") {
      this.trip("Authentication failure received during execution.");
      return;
    }

    if (category === "TIMEOUT") {
      this.consecutiveTimeouts++;
      if (this.consecutiveTimeouts >= 3) {
        this.trip("3 consecutive execution timeouts encountered.");
        return;
      }
    } else {
      this.consecutiveTimeouts = 0;
    }

    if (
      category !== "SUCCESS" &&
      category !== "ABORTED_BY_CIRCUIT_BREAKER" &&
      category !== "CANCELLED_NOT_DISPATCHED"
    ) {
      this.totalFailures++;
    }

    if (this.totalCompleted >= 5) {
      const failureRate = this.totalFailures / this.totalCompleted;
      if (failureRate > 0.2) {
        this.trip(
          `Failure rate exceeded 20% threshold (${Math.round(failureRate * 100)}% failures after ${this.totalCompleted} requests).`
        );
        return;
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────
// 8. PRNG FOR DETERMINISTIC MIXED DISTRIBUTION
// ─────────────────────────────────────────────────────────────

export function createPrng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ─────────────────────────────────────────────────────────────
// 9. DRILL RUNNER ENGINE
// ─────────────────────────────────────────────────────────────

export async function runJudgeConcurrencyDrill(args: DrillArgs): Promise<DrillReport> {
  console.log("==================================================");
  console.log("▶ SMARTZERO 2.0 JUDGE CONCURRENCY DRILL");
  console.log("==================================================");

  // Target Validation
  const targetCheck = validateTargetUrl(args.targetUrl, {
    confirmStaging: args.confirmStaging,
    allowRemoteHosts: args.allowRemoteHosts,
  });

  if (!targetCheck.valid || !targetCheck.parsed) {
    throw new Error(`Target Validation Failed: ${targetCheck.error}`);
  }

  const parsedUrl = targetCheck.parsed;
  const executeUrl = parsedUrl.toString();
  const baseUrl = `${parsedUrl.protocol}//${parsedUrl.host}`;
  const healthUrl = `${baseUrl}/health`;
  const readyUrl = `${baseUrl}/ready`;

  console.log(`[Config] Target Host:     ${parsedUrl.host} (${targetCheck.isLoopback ? "Loopback" : "Remote Staging"})`);
  console.log(`[Config] Concurrency:     ${args.concurrency}`);
  console.log(`[Config] Total Requests:  ${args.totalRequests}`);
  console.log(`[Config] Language:        ${args.language}`);
  console.log(`[Config] Scenario:        ${args.scenario}`);
  console.log(`[Config] Timeout:         ${args.timeoutMs} ms`);
  console.log(`[Config] PRNG Seed:       ${args.seed}`);
  console.log(`[Config] Dry Run:         ${args.dryRun}`);

  // Safe Secret Extraction
  const secretResult = loadJudgeSecretSafe();
  if (secretResult.error || !secretResult.secret) {
    throw new Error(`Secret Validation Failed: ${secretResult.error || "Secret missing"}`);
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

  // DRY-RUN EXIT: Guaranteed zero POST execution requests
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
        requestsAbortedInFlight: 0,
        requestsSkipped: args.totalRequests,
        timeoutCount: 0,
        totalWallClockMs: 0,
        dispatchWindowMs: 0,
        throughputRps: 0,
        queueWaitMetric: "unavailable",
        queueWaitNote:
          "Direct HTTP worker endpoint executes via priority queue but does not expose queue wait timestamps in response.",
        cancellationNotice:
          "Aborting in-flight HTTP requests terminates client network sockets; it does not cancel code already executing in the judge worker.",
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
        Connection: "close",
      },
      body: JSON.stringify(canaryPayload),
      signal: AbortSignal.timeout(args.timeoutMs),
      redirect: "error",
    });

    canaryLatencyMs = Math.round(performance.now() - canaryStart);
    const bodyText = await canaryRes.text();
    const classified = classifyExecutionResult(canaryRes.status, bodyText, {
      expectedJobId: "canary-01",
      expectedOutput: "81",
      language: "python",
    });

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
        requestsAbortedInFlight: 0,
        requestsSkipped: 0,
        timeoutCount: 0,
        totalWallClockMs: canaryLatencyMs,
        dispatchWindowMs: 0,
        throughputRps: Math.round(1000 / Math.max(canaryLatencyMs, 1)),
        queueWaitMetric: "unavailable",
        queueWaitNote: "Direct HTTP worker endpoint does not expose queue wait timestamps in response.",
        cancellationNotice:
          "Aborting in-flight HTTP requests terminates client network sockets; it does not cancel code already executing in the judge worker.",
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

  const effectiveConcurrency = Math.min(args.concurrency, args.totalRequests);
  const numWaves = Math.ceil(args.totalRequests / effectiveConcurrency);
  let dispatchedCount = 0;
  let minDispatchTime = Infinity;
  let maxDispatchTime = 0;

  for (let waveIdx = 0; waveIdx < numWaves; waveIdx++) {
    // If breaker tripped, halt scheduling subsequent waves immediately
    if (breaker.tripped()) {
      console.warn(`[CIRCUIT BREAKER] Tripped: ${breaker.reason()}. Halting further wave scheduling.`);
      break;
    }

    const waveSize = Math.min(effectiveConcurrency, args.totalRequests - dispatchedCount);
    const waveItems: {
      slot: number;
      jobId: string;
      language: "python" | "sql";
      payload: JudgeWorkerJobRequest;
      expectedOutput: string;
    }[] = [];

    // Prepare Wave Payloads
    for (let slot = 0; slot < waveSize; slot++) {
      const reqIdx = dispatchedCount + slot + 1;
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
          payload: generatePythonPayload(jobId, val, args.timeoutMs),
          expectedOutput: `${val * val}`,
        });
      } else {
        waveItems.push({
          slot,
          jobId,
          language: "sql",
          payload: generateSqlPayload(jobId, 20, args.timeoutMs),
          expectedOutput: formatSqlTable(
            ["id", "val"],
            [
              [2, 20],
              [3, 30],
            ]
          ),
        });
      }
    }

    // Barrier Dispatch
    const waveDispatchedAt = performance.now();
    minDispatchTime = Math.min(minDispatchTime, waveDispatchedAt);
    maxDispatchTime = Math.max(maxDispatchTime, waveDispatchedAt);

    console.log(`[Wave ${waveIdx + 1}/${numWaves}] Dispatching ${waveSize} synchronized requests...`);

    const wavePromises = waveItems.map(async (item) => {
      if (breaker.tripped()) {
        return;
      }
      dispatchedCount++;
      const itemDispatchTime = performance.now();

      const itemController = new AbortController();
      let timedOut = false;
      const timeoutHandle = setTimeout(() => {
        timedOut = true;
        itemController.abort(new Error("Timeout"));
      }, args.timeoutMs);

      // Link to circuit breaker abort signal
      const onBreakerAbort = () => {
        if (!itemController.signal.aborted) {
          itemController.abort(new Error("BreakerAbort"));
        }
      };

      if (breaker.signal.aborted) {
        onBreakerAbort();
      } else {
        breaker.signal.addEventListener("abort", onBreakerAbort, { once: true });
      }

      try {
        const res = await fetch(executeUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${secret}`,
            "x-smartzero-worker-secret": secret,
            Connection: "close",
          },
          body: JSON.stringify(item.payload),
          signal: itemController.signal,
          redirect: "error",
        });

        clearTimeout(timeoutHandle);
        breaker.signal.removeEventListener("abort", onBreakerAbort);

        const itemCompletedTime = performance.now();
        const durationMs = Math.round(itemCompletedTime - itemDispatchTime);

        const bodyText = await res.text();
        const classified = classifyExecutionResult(res.status, bodyText, {
          expectedJobId: item.jobId,
          expectedOutput: item.expectedOutput,
          language: item.language,
        });

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
        breaker.signal.removeEventListener("abort", onBreakerAbort);

        const itemCompletedTime = performance.now();
        const durationMs = Math.round(itemCompletedTime - itemDispatchTime);

        let category: FailureCategory;
        let errMsg: string;

        if (breaker.tripped() && !timedOut) {
          category = "ABORTED_BY_CIRCUIT_BREAKER";
          errMsg = `In-flight request aborted by circuit breaker (${breaker.reason()}). Note: worker process may still be executing on judge server.`;
        } else if (timedOut || err?.name === "TimeoutError") {
          category = "TIMEOUT";
          errMsg = `Request timed out after ${args.timeoutMs}ms.`;
        } else if (err?.message?.includes("redirect")) {
          category = "UNEXPECTED_REDIRECT";
          errMsg = "Request was unexpectedly redirected. Redirects are rejected.";
        } else {
          category = "NETWORK_ERROR";
          errMsg = err?.message || "Network socket error.";
        }

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
          errorMessage: errMsg,
        };
        records.push(record);
        return record;
      }
    });

    await Promise.all(wavePromises);
  }

  // Account for any requests that were never dispatched because breaker tripped
  const skippedCount = args.totalRequests - dispatchedCount;
  for (let i = 0; i < skippedCount; i++) {
    const skippedSlot = dispatchedCount + i;
    records.push({
      jobId: `skipped-${skippedSlot}`,
      language: args.language === "mixed" ? (prng() < 0.5 ? "python" : "sql") : args.language,
      waveIndex: Math.floor(skippedSlot / effectiveConcurrency),
      slotIndex: skippedSlot % effectiveConcurrency,
      dispatchedAtMonotonic: 0,
      completedAtMonotonic: 0,
      durationMs: 0,
      category: "CANCELLED_NOT_DISPATCHED",
      passed: false,
      errorMessage: `Request skipped: Circuit breaker tripped earlier (${breaker.reason() || "Tripped"}).`,
    });
  }

  const overallDurationMs = Math.round(performance.now() - overallStart);
  const dispatchWindowMs = Math.round(maxDispatchTime - minDispatchTime);

  // ─────────────────────────────────────────────────────────────
  // 5. METRICS AGGREGATION
  // ─────────────────────────────────────────────────────────────
  const executedRecords = records.filter(
    (r) => r.category !== "CANCELLED_NOT_DISPATCHED" && r.category !== "ABORTED_BY_CIRCUIT_BREAKER"
  );
  const abortedInFlightCount = records.filter((r) => r.category === "ABORTED_BY_CIRCUIT_BREAKER").length;
  const skippedCountFinal = records.filter((r) => r.category === "CANCELLED_NOT_DISPATCHED").length;
  const completedCount = executedRecords.length;
  const successCount = executedRecords.filter((r) => r.category === "SUCCESS").length;
  const failureCount = completedCount - successCount;
  const timeoutCount = records.filter((r) => r.category === "TIMEOUT").length;

  const latencies = executedRecords.map((r) => r.durationMs);
  const overallLatencyStats = calculatePercentiles(latencies);

  // Per-language breakdowns
  const pyRecords = executedRecords.filter((r) => r.language === "python");
  const sqlRecords = executedRecords.filter((r) => r.language === "sql");

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
  } else if (failureCount > 0 || abortedInFlightCount > 0) {
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
    workerInfo: {
      workerName,
      reportedConcurrency,
      runtimes: reportedRuntimes,
    },
    preflight: {
      healthOk,
      readinessOk,
      canaryLatencyMs,
      canaryVerdict,
    },
    circuitBreaker: {
      triggered: breaker.tripped(),
      reason: breaker.reason(),
    },
    executionSummary: {
      requestsPrepared: args.totalRequests,
      requestsDispatched: dispatchedCount,
      requestsCompleted: completedCount,
      requestsSuccessful: successCount,
      requestsFailed: failureCount,
      requestsAbortedInFlight: abortedInFlightCount,
      requestsSkipped: skippedCountFinal,
      timeoutCount,
      totalWallClockMs: overallDurationMs,
      dispatchWindowMs,
      throughputRps,
      queueWaitMetric: "unavailable",
      queueWaitNote:
        "Direct HTTP worker endpoint executes via priority queue but does not expose queue wait timestamps in response.",
      cancellationNotice:
        "Aborting in-flight HTTP requests terminates client network sockets; it does not cancel code already executing in the judge worker.",
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
  console.log(`▶ DRILL EXECUTION REPORT SUMMARY`);
  console.log(`==================================================`);
  console.log(`Target:               ${report.target.protocol}//${report.target.hostname}:${report.target.port}`);
  console.log(`Total Configured:     ${report.executionSummary.requestsPrepared}`);
  console.log(`Dispatched:           ${report.executionSummary.requestsDispatched}`);
  console.log(`Completed:            ${report.executionSummary.requestsCompleted}`);
  console.log(`Successful:           ${report.executionSummary.requestsSuccessful}`);
  console.log(`Failed:               ${report.executionSummary.requestsFailed}`);
  console.log(`Aborted in-Flight:    ${report.executionSummary.requestsAbortedInFlight}`);
  console.log(`Skipped (Unstarted):  ${report.executionSummary.requestsSkipped}`);
  console.log(`Timeouts:             ${report.executionSummary.timeoutCount}`);
  console.log(`Circuit Breaker:      ${report.circuitBreaker.triggered ? `TRIPPED (${report.circuitBreaker.reason})` : "OK (Not Tripped)"}`);
  console.log(`Total Wall Clock:     ${report.executionSummary.totalWallClockMs} ms`);
  console.log(`Dispatch Window:      ${report.executionSummary.dispatchWindowMs} ms (Node barrier)`);
  console.log(`Throughput:           ${report.executionSummary.throughputRps} req/sec`);
  console.log(`Queue Wait Time:      UNAVAILABLE (Total latency includes queue + exec)`);
  console.log(`Latency min / p50:    ${report.latencies.min} ms / ${report.latencies.p50} ms`);
  console.log(`Latency p95 / p99:    ${report.latencies.p95} ms / ${report.latencies.p99} ms`);
  console.log(`Latency max / mean:   ${report.latencies.max} ms / ${report.latencies.mean} ms`);

  if (pyMetrics) {
    console.log(
      `\n[Python Metrics] Count: ${pyMetrics.total} | OK: ${pyMetrics.successCount} | p50: ${pyMetrics.latencies.p50}ms | p95: ${pyMetrics.latencies.p95}ms`
    );
  }
  if (sqlMetrics) {
    console.log(
      `[SQL Metrics]    Count: ${sqlMetrics.total} | OK: ${sqlMetrics.successCount} | p50: ${sqlMetrics.latencies.p50}ms | p95: ${sqlMetrics.latencies.p95}ms`
    );
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
// 10. CLI ENTRY POINT
// ─────────────────────────────────────────────────────────────

export async function main() {
  const { args, error } = parseDrillArgs(process.argv.slice(2));

  if (error) {
    console.error(`Error: ${error}`);
    console.log("Run with --help for usage information.");
    process.exitCode = 2;
    return;
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
  --timeout-ms <N>            Per-request HTTP timeout in ms (1000..60000, default: 5000)
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
