# SmartZero 2.0 — Production Isolated Coding Judge Deployment Guide

This document outlines the architecture, host provisioning, security policies, and operational runbook for deploying the dedicated, container-isolated coding judge for SmartZero 2.0.

---

## A. Architecture

```
   [Contestant Browser]
            │
            ▼ (HTTPS POST /api/contest/[slug]/coding/submit)
   [Next.js App / Vercel API Gateway]
            │
            ▼ (Enqueue Job with Idempotency Token)
   [Production Redis / Upstash Queue]
            ▲
            │ (Pull Job via Dedicated Worker)
   [Linux Judge Worker Host]
   (scripts/judge_worker_daemon.ts)
            │
            ▼ (Spawn Isolated Container per Submission)
   [Hardened OCI Container / gVisor Sandbox]
   (Flags: --network none, --cpus 1.0, -m 256m, --pids-limit 64, --read-only)
            │
            ▼ (Compile & Execute Test Cases sequentially)
   [Deterministic Output Normalizer & Evaluator]
            │
            ▼ (Write Verdict & Scores)
   [Supabase PostgreSQL `coding_submissions`]
            │
            ▼ (Realtime WebSocket Broadcast)
   [Live Contest Leaderboard]
```

---

## B. Linux Host Requirements

- **Operating System**: Ubuntu 22.04 LTS, Debian 12, Rocky Linux 9, or Alpine Linux 3.19.
- **Kernel Version**: Linux kernel $\ge 5.10$ with **cgroups v2** unified hierarchy enabled:
  ```bash
  grep cgroup2 /proc/filesystems
  # Verify systemd.unified_cgroup_hierarchy=1
  ```
- **Compute Sizing**:
  - Minimum: 2 vCPUs, 4 GB RAM, 20 GB SSD.
  - Recommended Production: 4–8 vCPUs, 8–16 GB RAM, NVMe SSD (capable of 10–20 concurrent student sandboxes).

---

## C. Docker / Podman Requirements

- **Docker CE $\ge 24.0$** or **Podman $\ge 4.5$**.
- Rootless mode or dedicated `judge-runner` non-root service account with access to container runtime.
- **Pre-pulled Runtime Images**:
  ```bash
  docker pull python:3.11-alpine
  docker pull node:20-alpine
  docker pull gcc:13-alpine
  docker pull eclipse-temurin:21-alpine
  ```

---

## D. Optional gVisor Runtime (`runsc`)

For ultra-high-security environments requiring defense-in-depth against kernel zero-days:
1. Install `runsc` (gVisor container runtime).
2. Configure Docker daemon `/etc/docker/daemon.json`:
   ```json
   {
     "runtimes": {
       "runsc": {
         "path": "/usr/local/bin/runsc"
       }
     }
   }
   ```
3. Restart Docker: `sudo systemctl restart docker`.
4. Configure environment: `DOCKER_DEFAULT_RUNTIME=runsc`.

---

## E. Redis Queue Requirements

- **Engine**: Redis $\ge 7.0$ or Upstash Serverless Redis.
- **Data Persistence**: AOF (`appendonly yes`) enabled for durable job queuing across network blips.
- **Deduplication**: Key TTL enforcement for sliding 5-minute idempotency tracking.

---

## F. Supabase Requirements

- Live PostgreSQL instance with schema containing:
  - `public.contests`
  - `public.coding_questions`
  - `public.coding_test_cases`
  - `public.coding_submissions`
  - `public.contest_participants`
- RLS enabled with service role access for judge worker updates.

---

## G. Environment Variables

Configure on the **Judge Worker Host** (do not commit to version control):

```bash
# Judge Mode
NODE_ENV=production
SMARTZERO_JUDGE_MODE=production
SMARTZERO_SANDBOX_RUNNER=docker

# Queue Configuration
REDIS_URL=rediss://default:YOUR_REDIS_PASSWORD@your-redis-host:6379

# Database Configuration (for Authoritative lookups)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJh...YOUR_SERVICE_KEY

# Worker Settings
JUDGE_POLL_INTERVAL_MS=500
JUDGE_MAX_CONCURRENCY=4
```

---

## H. Secret Handling

- **Zero-Secret Propagation**: The worker strictly scrubs all host environment variables prior to container execution.
- Student code containers receive **zero credentials**: no `SUPABASE_SERVICE_ROLE_KEY`, no `REDIS_URL`, no AI API keys, no host paths.
- The control socket `/var/run/docker.sock` is **NEVER** mounted into student execution containers.

---

## I. Firewall & Network Rules

- **Inbound**: Port 22 (SSH with ed25519 keys only) restricted to admin bastions. Zero public HTTP ingress needed on the worker host (worker acts strictly as an outbound queue consumer).
- **Outbound**:
  - Outbound HTTPS (TCP 443) allowed to Supabase API and Redis queue endpoint.
  - Zero internet access from within student execution containers (`--network none`).

---

## J. Worker Startup & Systemd Service

Deploy as a systemd service `/etc/systemd/system/smartzero-judge.service`:

```ini
[Unit]
Description=SmartZero Dedicated Judge Worker Daemon
After=network.target docker.service
Requires=docker.service

[Service]
Type=simple
User=judge-runner
WorkingDirectory=/opt/smartzero-judge
EnvironmentFile=/etc/smartzero/judge.env
ExecStart=/usr/bin/npx tsx scripts/judge_worker_daemon.ts
Restart=always
RestartSec=5
LimitNOFILE=65536
LimitNPROC=4096

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now smartzero-judge
sudo journalctl -u smartzero-judge -f
```

---

## K. Health Checks

- Process liveness check: `systemctl is-active smartzero-judge`.
- Observability snapshot: invoke `judgeObservability.getMetricsSnapshot()`.
- Sandbox check: execute container ping test in `scripts/verify_production_judge.sh`.

---

## L. Scaling

- **Horizontal Scaling**: Multiple worker hosts can concurrently poll the shared Redis queue using atomic dequeue primitives (`BRPOP` / `BLMOVE`).
- **Concurrency Quota**: Set `JUDGE_MAX_CONCURRENCY` according to host core count ($N_{\text{workers}} \le 2 \times N_{\text{cores}}$).

---

## M. Monitoring & Telemetry

Monitor through `judgeObservability`:
- `totalReceived`: Volume of incoming submission jobs.
- `totalCompleted`: Completed verdicts.
- `avgExecutionTimeMs`: Sandbox latency.
- `avgQueueWaitTimeMs`: Queue latency (indicates if more workers are needed).
- `sandboxUnavailable`: Trigger PagerDuty / alert if $> 0$.
- `queueFailures`: Trigger alert if Redis is unreachable.

---

## N. Failure Recovery & Watchdog

- **Worker Crash**: If a worker node crashes mid-execution, `cleanupStaleJobs()` automatically reclaims jobs in `RUNNING` status exceeding 30 seconds and requeues them up to 2 retries before marking `SYSTEM_ERROR`.
- **Sandbox Hangs**: Containers are terminated strictly after `timeLimitMs + 1000ms` via Docker kill signals.
- **Fail-Closed Guarantee**: In `production` mode, if Docker is unavailable, the judge rejects student execution with `SYSTEM_ERROR` / `JUDGE_UNAVAILABLE` rather than falling back to host execution.

---

## O. Security Verification

Run the automated Linux security suite on the deployed host:
```bash
chmod +x scripts/verify_production_judge.sh
./scripts/verify_production_judge.sh
```

---

## P. Local Development Without Docker

On local development machines (Windows, macOS, Linux):
- **Default Mode**: `SMARTZERO_JUDGE_MODE=local`.
- **Zero Docker Prerequisite**: Docker Desktop is **NOT required**.
- **Development Sandbox**: Uses `HardenedSubprocessSandbox` featuring sanitized environment variables, process-tree cleanup, timeout limits, and a 64 KB output buffer.
- Runs all development commands seamlessly:
  ```bash
  npm install
  npm run dev
  npm test
  npm run build
  npm run typecheck
  npm run lint
  ```
