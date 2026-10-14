# SmartZero 2.0 — Judge Concurrency Mock-Drill Tool (`judge_concurrency_drill.ts`)

A production-grade, controlled, and reproducible stress-testing utility designed to discover and diagnose concurrency bottlenecks, queue overload, timeout behavior, worker instability, verdict mismatches, and execution isolation defects in the SmartZero 2.0 Python/SQL Judge Execution Service.

---

## 1. Architecture & Design Principles

### Target Architecture
SmartZero 2.0 uses a dedicated execution worker (`deploy/judge-worker/server.ts`) that runs an in-process priority execution queue (`priorityJudgeQueue`) powered by Node.js worker pools and isolated runtimes:
- **Python**: Sandboxed child processes executing deterministic scripts with memory and CPU time guards.
- **SQL**: In-memory SQLite instances (`lib/judge/sqlEngine.ts`) executing isolated DDL/DML queries with schema validation and ASCII table formatting (`formatSqlTable`).

```
                    ┌────────────────────────────────────────────────────────┐
                    │            scripts/judge_concurrency_drill.ts           │
                    │   - Safe target validation & port 8080 enforcement     │
                    │   - Safe secret parser (.env.local / process.env)      │
                    │   - Deterministic PRNG payload generator              │
                    │   - Synchronized barrier wave dispatcher              │
                    │   - Circuit breaker: aborts in-flight + halts waves   │
                    └──────────────────────────┬─────────────────────────────┘
                                               │ HTTP POST (Bearer secret)
                                               ▼
                    ┌────────────────────────────────────────────────────────┐
                    │               Judge Worker Server                      │
                    │        (http://127.0.0.1:8080/api/judge/execute)        │
                    │                                                        │
                    │   ├── GET  /health                                     │
                    │   ├── GET  /ready                                      │
                    │   └── POST /api/judge/execute (or /execute)            │
                    │             │                                          │
                    │             ▼                                          │
                    │       priorityJudgeQueue (Concurrency: 6)              │
                    │        ├── Python Sandbox Process                      │
                    │        └── SQLite In-Memory Database                   │
                    └────────────────────────────────────────────────────────┘
```

### Why Direct Execution Target?
The mock drill intentionally targets the judge execution service (`/api/judge/execute`) directly. It **never** calls:
- Next.js contest submission endpoints (`/api/contest/[slug]/coding/submit`).
- Answer save endpoints (`/api/contest/[slug]/coding/save`).
- Contest state, user management, or database finalization routes.
- Supabase production databases or tables.

This ensures complete diagnostic isolation: compiler and sandbox capacity can be measured accurately without creating dummy student accounts, polluting contest tables, altering student marks, or corrupting production state.

---

## 2. Non-Negotiable Safety Rules & Guards

1. **Approved Loopback Target & Port**:
   Local target is strictly restricted to approved loopback hostnames (`127.0.0.1`, `localhost`, `::1`, `[::1]`) and the intended local judge port (`8080`). Protocol must strictly be `http:`. Binding addresses (`0.0.0.0`), other ports, and HTTPS on loopback are hard-rejected.
2. **Strict Rejection of Public Production Domains & Tunnels**:
   The validator automatically inspects target URLs and immediately rejects:
   - Vercel production domains (`vercel.app`, custom production domains).
   - Cloudflare Quick Tunnels (`trycloudflare.com`, `cloudflarepreview.com`).
   - Ngrok and localtunnel endpoints (`ngrok.io`, `ngrok-free.app`, `localtunnel.me`).
   - Cloud platforms (`supabase.co`, `workers.dev`, `herokuapp.com`, `fly.dev`, `render.com`, `railway.app`, `amazonaws.com`).
3. **Remote Staging Protection**:
   Targeting remote staging requires:
   - Strict HTTPS protocol (`https://...`). Insecure HTTP is rejected.
   - Explicit operator confirmation flag `--confirm-staging`.
   - Host inclusion in `--allow-remote-host <hostname>`.
   - Stripping and rejection of embedded credentials (`http://user:pass@...`), URL fragments (`#...`), and query parameters (`?...`).
4. **No Fallback Target**:
   The tool never falls back to an unverified URL. If the target fails validation, it fails closed immediately with exit code 2.
5. **Concurrency Cap**:
   Concurrency is hard-capped at 100 in-flight requests. Concurrency $> 100$ or $\le 0$ is rejected.
6. **Hardened Circuit Breaker & In-Flight Abort**:
   The dispatcher monitors real-time outcomes and halts immediately if:
   - Any authentication error (`401 Unauthorized` / `403 Forbidden`) occurs.
   - After 5 or more completed requests, the failure rate exceeds 20%.
   - 3 consecutive timeout events occur.
   
   **When Tripped**:
   - Scheduling of subsequent waves stops immediately.
   - In-flight HTTP requests are aborted via client-side `AbortController` and recorded as `ABORTED_BY_CIRCUIT_BREAKER`.
   - Unstarted requests are recorded as `CANCELLED_NOT_DISPATCHED`.
   
   > [!IMPORTANT]
   > **Cancellation Boundary**: Aborting in-flight HTTP requests closes the client-side socket connection. It does **not** cancel execution already running inside worker processes on the judge server.
7. **Zero Secret Leakage**:
   Authentication secrets (`JUDGE_WORKER_SECRET`) are parsed safely from the local environment or `.env.local` without ever being printed in terminal output, command history, error messages, or JSON reports.
8. **Operator Approval Requirement**:
   Live execution bursts must only be triggered with explicit operator consent. Dry-run mode (`--dry-run`) is provided to verify preflight readiness without sending execution requests.

---

## 3. Workloads & Payloads (Real API Schema)

The drill constructs payloads conforming directly to `JudgeWorkerJobRequest` (`lib/judge/types.ts`):

```typescript
export interface JudgeWorkerJobRequest {
  job_id: string;
  submission_id: string;
  contest_id: string;
  question_id: string;
  language: "python" | "sql";
  source_code: string;
  execution_mode: "run" | "submit";
  test_cases: JudgeTestCase[];
  time_limit_ms: number;
  memory_limit_mb: number;
  total_marks?: number;
  schema_sql?: string;
  sample_data_sql?: string;
  order_sensitive?: boolean;
}
```

| Language | Payload Characteristics | Expected Outcome | Verification |
| :--- | :--- | :--- | :--- |
| **Python** | Stdin integer arithmetic (`int(sys.stdin.read())`), printing `val * val`. | Single integer string matching square of input. | Exact stdout comparison and verdict check (`Accepted`). |
| **SQL** | In-memory SQLite DDL + DML (`CREATE TABLE drill_items`, `INSERT`, `SELECT id, val WHERE val >= 20 ORDER BY id`). | `id    val\n--    ---\n2     20 \n3     30` | Tabular comparison against `formatSqlTable`, column schema, and row count checks (`Accepted`). |
| **Mixed** | PRNG-seeded (Mulberry32) 50/50 distribution between Python and SQL. | Deterministic sequence based on `--seed <N>`. | Verifies concurrent multi-runtime switching under load. |

---

## 4. Strict Response Validation

The tool enforces complete terminal verification on every response:
- **Mandatory Fields**: `job_id`, `status: "COMPLETED"`, `verdict: "Accepted"`, `test_results: [...]`.
- **Missing Test Results**: Missing or empty `test_results: []` is strictly rejected and never counts as success.
- **Redirect Rejection**: Any 3xx redirect status is treated as an invalid target failure.
- **Output Verification**:
  - Python: Actual stdout normalized and verified against `${val * val}`.
  - SQL: Actual output verified against `formatSqlTable(["id", "val"], [[2, 20], [3, 30]])`, plus column count (2) and row count (2) validation.

---

## 5. Metrics & Accounting Transparency

The drill records granular execution telemetry with exact mathematical accounting:
$$\text{requestsPrepared} = \text{requestsDispatched} + \text{requestsSkipped}$$
$$\text{requestsDispatched} = \text{requestsCompleted} + \text{requestsAbortedInFlight}$$

- **Total Wall Clock Time**: Overall elapsed wall clock time in milliseconds.
- **Dispatch Window**: Time elapsed during the Node.js synchronous barrier release across concurrent promises.
- **Throughput (RPS)**: Completed requests divided by total elapsed wall clock seconds.
- **Latency Percentiles**: Nearest-rank percentiles (`min`, `mean`, `p50`, `p95`, `p99`, `max`).
- **Language Breakdown**: Separate throughput and latency percentiles for Python and SQL.
- **Failure Categories**: `SUCCESS`, `AUTH_ERROR`, `HTTP_ERROR`, `RATE_LIMITED`, `TIMEOUT`, `NETWORK_ERROR`, `UNEXPECTED_REDIRECT`, `INVALID_JSON`, `INVALID_RESPONSE_SCHEMA`, `UNEXPECTED_JOB_STATUS`, `VERDICT_MISMATCH`, `TEST_CASE_FAILURE`, `ABORTED_BY_CIRCUIT_BREAKER`, `CANCELLED_NOT_DISPATCHED`.

### Queue Wait Metric Transparency
The direct HTTP worker endpoint executes incoming jobs via an internal queue (`priorityJudgeQueue`). Because the HTTP response JSON returns the total elapsed time without separate queue wait timestamps, client-measured latency represents:
$$\text{Total Latency} = \text{Queue Wait Time} + \text{Execution Time}$$
The drill explicitly records `queueWaitMetric: "unavailable"` and includes an explanatory note in the report rather than manufacturing estimates.

---

## 6. Usage & PowerShell Commands

All commands should be executed from the project root: `d:\Coding\Hackwave3.0\SmartZero-V1-Deployable\smartzero-v1`.

### Preflight: Help & Options
```powershell
npx tsx scripts/judge_concurrency_drill.ts --help
```

### Preflight: Dry-Run Mode (Safe Read-Only Verification)
Validates local target, parses configuration, executes read-only `GET /health` and `GET /ready` probes, and confirms worker concurrency without sending ANY execution POST requests:
```powershell
npx tsx scripts/judge_concurrency_drill.ts --dry-run
```

### Baseline: Single Authenticated Canary (1 Request)
Validates credentials and executes exactly 1 authenticated Python execution to confirm end-to-end sandbox functionality before any load test:
```powershell
npx tsx scripts/judge_concurrency_drill.ts --scenario baseline
```

---

### Stage 1: Moderate Concurrency (20 Concurrency, 40 Total Requests)
Executes 2 waves of 20 concurrent requests with mixed Python and SQL workloads:
```powershell
npx tsx scripts/judge_concurrency_drill.ts --concurrency 20 --requests 40 --language mixed --output reports/drill_stage1.json --force
```

### Stage 2: Heavy Concurrency (50 Concurrency, 100 Total Requests)
Executes 2 waves of 50 concurrent requests:
```powershell
npx tsx scripts/judge_concurrency_drill.ts --concurrency 50 --requests 100 --language mixed --output reports/drill_stage2.json --force
```

### Stage 3: Stress Limit Concurrency (100 Concurrency, 200 Total Requests)
Executes 2 waves of 100 concurrent requests (maximum allowed concurrency cap):
```powershell
npx tsx scripts/judge_concurrency_drill.ts --concurrency 100 --requests 200 --language mixed --output reports/drill_stage3.json --force
```

### Stage 4: High Capacity Wave Concurrency (100 Concurrency, 400 Total Requests)
Executes 4 waves of 100 concurrent requests across extended queue depth:
```powershell
npx tsx scripts/judge_concurrency_drill.ts --concurrency 100 --requests 400 --language mixed --output reports/drill_stage4.json --force
```

---

### Language-Specific Workload Variations

**Pure Python Workload**:
```powershell
npx tsx scripts/judge_concurrency_drill.ts --concurrency 20 --requests 40 --language python
```

**Pure SQL Workload**:
```powershell
npx tsx scripts/judge_concurrency_drill.ts --concurrency 20 --requests 40 --language sql
```

**Custom Seed for Reproducible Mixed Workload**:
```powershell
npx tsx scripts/judge_concurrency_drill.ts --concurrency 20 --requests 40 --language mixed --seed 12345
```

---

## 7. Exit Codes

| Exit Code | Meaning | Cause |
| :---: | :--- | :--- |
| **`0`** | **PASSED** | Preflight checks and all executed requests completed with `SUCCESS` verdict. |
| **`1`** | **FAILED** | One or more requests failed, timed out, or returned unexpected output. |
| **`2`** | **CONFIG ERROR** | Invalid arguments, non-integer values, disallowed target domain, or missing secret. |
| **`3`** | **CIRCUIT BREAKER** | Safety trip: $>20\%$ failure rate, 3 consecutive timeouts, or auth failure. |
| **`4`** | **FATAL RUNTIME** | Unhandled network socket failure or worker unreachable during preflight. |

---

## 8. Verification Test Suite

Run the full hardened unit test suite covering target bounds, argument parsing, schema matching, response classification, circuit breaker in-flight abort, and dry-run execution:

```powershell
npx tsx tests/judge_concurrency_drill.test.ts
```

All 101 unit test assertions must pass before running any live drill.
