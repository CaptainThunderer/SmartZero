# SmartZero 2.0 — Judge Concurrency Mock-Drill Tool (`judge_concurrency_drill.ts`)

A production-grade, controlled, and reproducible stress-testing utility designed to discover and diagnose concurrency bottlenecks, queue overload, timeout behavior, worker instability, verdict mismatches, and execution isolation defects in the SmartZero 2.0 Python/SQL Judge Execution Service.

---

## 1. Architecture & Design Principles

### Target Architecture
SmartZero 2.0 uses a high-performance execution worker (`deploy/judge-worker/server.ts`) that runs an in-process priority execution queue (`priorityJudgeQueue`) powered by Node.js worker pools and isolated runtimes:
- **Python**: Sandboxed child processes executing deterministic scripts with memory and CPU time guards.
- **SQL**: In-memory SQLite instances (`lib/judge/sqlEngine.ts`) executing isolated DDL/DML queries with schema validation.

```
                    ┌────────────────────────────────────────────────────────┐
                    │            scripts/judge_concurrency_drill.ts           │
                    │   - Safe target validation & allowlist enforcement    │
                    │   - Safe secret parser (.env.local / process.env)      │
                    │   - Deterministic PRNG payload generator              │
                    │   - Synchronized barrier wave dispatcher              │
                    │   - Automatic circuit breaker (abort on >20% fail)    │
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

1. **Loopback Target by Default**:
   The default target URL is strictly loopback: `http://127.0.0.1:8080/api/judge/execute`.
2. **Strict Rejection of Public Production Domains & Tunnels**:
   The validator automatically inspects target URLs and immediately rejects:
   - Vercel production domains (`vercel.app`, custom production domains).
   - Cloudflare Quick Tunnels (`trycloudflare.com`, `cloudflarepreview.com`).
   - Ngrok and localtunnel endpoints (`ngrok.io`, `ngrok-free.app`, `localtunnel.me`).
   - Supabase databases or REST endpoints (`supabase.co`).
3. **Remote Staging Protection**:
   Targeting remote staging requires:
   - Explicit HTTPS protocol (`https://...`). Insecure HTTP is rejected.
   - Explicit operator flag `--confirm-staging`.
   - Host inclusion in `--allow-remote-host <hostname>`.
   - Stripping and rejection of embedded credentials (`http://user:pass@...`) or URL fragments (`#...`).
4. **Concurrency Cap**:
   Concurrency is hard-capped at 100 in-flight requests. Concurrency $> 100$ or $\le 0$ is rejected.
5. **Automatic Circuit Breaker**:
   The dispatcher monitors real-time outcomes and halts immediately if:
   - Any authentication error (`401 Unauthorized` / `403 Forbidden`) occurs.
   - After 5 or more requests, the failure rate exceeds 20%.
   - 3 consecutive timeout events occur.
6. **Zero Secret Leakage**:
   Authentication secrets (`JUDGE_WORKER_SECRET`) are parsed safely from the local environment or `.env.local` without being printed in terminal output, command history, error messages, or JSON reports.
7. **Operator Approval Requirement**:
   Live execution bursts must only be triggered with explicit operator consent. Dry-run mode (`--dry-run`) is provided to verify preflight readiness without sending execution requests.

---

## 3. Workloads & Payloads

The drill executes lightweight, deterministic payloads that verify both correctness and performance:

| Language | Payload Characteristics | Expected Outcome | Verification |
| :--- | :--- | :--- | :--- |
| **Python** | Deterministic integer arithmetic (`print(val * val)`), 2000ms CPU timeout. | Single integer string matching square of input. | Exact stdout comparison and verdict check (`Accepted`). |
| **SQL** | In-memory SQLite DDL + DML (`CREATE TABLE test`, `INSERT`, `SELECT WHERE val > 15`). | `id \| val\n2 \| 20\n3 \| 30` | Tabular output comparison and verdict check (`Accepted`). |
| **Mixed** | PRNG-seeded (Mulberry32) 50/50 distribution between Python and SQL. | Deterministic sequence based on `--seed <N>`. | Verifies concurrent multi-runtime switching under load. |

---

## 4. Metrics & Queue Transparency

The drill records granular execution telemetry:
- **Total Wall Clock Time**: Overall elapsed wall clock time in milliseconds.
- **Dispatch Window**: Time elapsed during the Node.js synchronous barrier release across all concurrent promises.
- **Throughput (RPS)**: Completed requests divided by total elapsed wall clock seconds.
- **Latency Percentiles**: Nearest-rank percentiles (`min`, `mean`, `p50`, `p95`, `p99`, `max`).
- **Language Breakdown**: Separate throughput and latency percentiles for Python and SQL.
- **Failure Categories**: `SUCCESS`, `AUTH_ERROR`, `HTTP_ERROR`, `RATE_LIMITED`, `TIMEOUT`, `NETWORK_ERROR`, `INVALID_JSON`, `UNEXPECTED_JOB_STATUS`, `VERDICT_MISMATCH`, `TEST_CASE_FAILURE`, `ABORTED_BY_CIRCUIT_BREAKER`.

### Important Note on Queue Wait Metric
The direct HTTP worker endpoint executes incoming jobs via an internal in-process queue (`priorityJudgeQueue`). Because the HTTP response JSON returns the total elapsed time without separate queue wait timestamps, client-measured latency represents:
$$\text{Total Latency} = \text{Queue Wait Time} + \text{Execution Time}$$
To maintain strict reporting integrity, the drill marks `queueWaitMetric: "unavailable"` and includes an explicit explanatory note in the report rather than manufacturing estimates.

---

## 5. Usage & PowerShell Commands

All commands should be executed from the project root: `d:\Coding\Hackwave3.0\SmartZero-V1-Deployable\smartzero-v1`.

### Preflight: Help & Options
```powershell
npx tsx scripts/judge_concurrency_drill.ts --help
```

### Preflight: Dry-Run Mode (Safe Verification)
Validates local target, parses configuration, executes read-only `GET /health` and `GET /ready` probes, and confirms worker concurrency without sending ANY execution POST requests:
```powershell
npx tsx scripts/judge_concurrency_drill.ts --dry-run
```

### Baseline: Canary Run (1 Request)
Validates credentials and executes exactly 1 authenticated Python execution to confirm end-to-end sandbox functionality:
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

### Staging Verification (Remote Staging Only)
When testing an isolated staging instance on a private network or dedicated test host:
```powershell
npx tsx scripts/judge_concurrency_drill.ts `
  --url "https://staging-judge.internal.net/api/judge/execute" `
  --confirm-staging `
  --allow-remote-host "staging-judge.internal.net" `
  --concurrency 10 `
  --requests 20
```

---

## 6. Exit Codes

| Exit Code | Meaning | Cause |
| :---: | :--- | :--- |
| **`0`** | **PASSED** | Preflight checks and all executed requests completed with `SUCCESS` verdict. |
| **`1`** | **FAILED** | One or more requests failed, timed out, or returned unexpected output. |
| **`2`** | **CONFIG ERROR** | Invalid arguments, disallowed target domain, or missing secret. |
| **`3`** | **CIRCUIT BREAKER** | Safety trip: $>20\%$ failure rate, 3 consecutive timeouts, or auth failure. |
| **`4`** | **FATAL RUNTIME** | Unhandled network failure or worker unreachable during preflight. |

---

## 7. Verification Test Suite

The test suite validates target rules, CLI flag parsing, percentile math, failure classifications, PRNG determinism, and secret loading without requiring a live worker or network access:

```powershell
npx tsx tests/judge_concurrency_drill.test.ts
```

All 56 unit test assertions must pass before running any live drill.
