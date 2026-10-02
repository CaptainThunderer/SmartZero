import type { CodingVerdict } from "@/types/contest";

export interface JudgeMetrics {
  totalReceived: number;
  totalCompleted: number;
  totalFailed: number;
  verdicts: Record<CodingVerdict | "SYSTEM_ERROR", number>;
  avgExecutionTimeMs: number;
  avgQueueWaitTimeMs: number;
  activeWorkers: number;
  sandboxUnavailable: number;
  queueFailures: number;
  workerRestarts: number;
  containerFailures: number;
  staleJobsRecovered: number;
  lastUpdated: string;
}

class JudgeObservability {
  private totalReceived = 0;
  private totalCompleted = 0;
  private totalFailed = 0;
  private totalExecutionTimeMs = 0;
  private totalQueueWaitTimeMs = 0;
  private activeWorkers = 0;
  private sandboxUnavailable = 0;
  private queueFailures = 0;
  private workerRestarts = 0;
  private containerFailures = 0;
  private staleJobsRecovered = 0;
  private verdicts: Record<string, number> = {
    Accepted: 0,
    "Partial Accepted": 0,
    "Wrong Answer": 0,
    TLE: 0,
    "Runtime Error": 0,
    "Compilation Error": 0,
    SYSTEM_ERROR: 0,
  };

  recordJobEnqueued(): void {
    this.totalReceived++;
  }

  recordWorkerStart(): void {
    this.activeWorkers++;
  }

  recordWorkerEnd(): void {
    this.activeWorkers = Math.max(0, this.activeWorkers - 1);
  }

  recordWorkerRestart(): void {
    this.workerRestarts++;
  }

  recordSandboxUnavailable(): void {
    this.sandboxUnavailable++;
  }

  recordQueueFailure(): void {
    this.queueFailures++;
  }

  recordContainerFailure(): void {
    this.containerFailures++;
  }

  recordStaleJobsRecovered(count = 1): void {
    this.staleJobsRecovered += count;
  }

  recordJobCompleted(params: {
    verdict: CodingVerdict;
    executionTimeMs: number;
    queueWaitTimeMs: number;
  }): void {
    this.totalCompleted++;
    this.totalExecutionTimeMs += params.executionTimeMs;
    this.totalQueueWaitTimeMs += params.queueWaitTimeMs;
    this.verdicts[params.verdict] = (this.verdicts[params.verdict] || 0) + 1;
  }

  recordJobFailed(verdict: CodingVerdict | "SYSTEM_ERROR" = "SYSTEM_ERROR"): void {
    this.totalFailed++;
    this.verdicts[verdict] = (this.verdicts[verdict] || 0) + 1;
  }

  getMetricsSnapshot(): JudgeMetrics {
    const avgExec =
      this.totalCompleted > 0
        ? Math.round(this.totalExecutionTimeMs / this.totalCompleted)
        : 0;
    const avgWait =
      this.totalCompleted > 0
        ? Math.round(this.totalQueueWaitTimeMs / this.totalCompleted)
        : 0;

    return {
      totalReceived: this.totalReceived,
      totalCompleted: this.totalCompleted,
      totalFailed: this.totalFailed,
      verdicts: { ...this.verdicts } as Record<CodingVerdict | "SYSTEM_ERROR", number>,
      avgExecutionTimeMs: avgExec,
      avgQueueWaitTimeMs: avgWait,
      activeWorkers: this.activeWorkers,
      sandboxUnavailable: this.sandboxUnavailable,
      queueFailures: this.queueFailures,
      workerRestarts: this.workerRestarts,
      containerFailures: this.containerFailures,
      staleJobsRecovered: this.staleJobsRecovered,
      lastUpdated: new Date().toISOString(),
    };
  }

  reset(): void {
    this.totalReceived = 0;
    this.totalCompleted = 0;
    this.totalFailed = 0;
    this.totalExecutionTimeMs = 0;
    this.totalQueueWaitTimeMs = 0;
    this.activeWorkers = 0;
    this.sandboxUnavailable = 0;
    this.queueFailures = 0;
    this.workerRestarts = 0;
    this.containerFailures = 0;
    this.staleJobsRecovered = 0;
    for (const key of Object.keys(this.verdicts)) {
      this.verdicts[key] = 0;
    }
  }
}

export const judgeObservability = new JudgeObservability();
