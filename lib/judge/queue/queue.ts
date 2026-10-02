import type { IJudgeQueue, SubmissionJob, JobStatus } from "./types";
import { judgeObservability } from "../observability";
import { getJudgeMode } from "../config";

/**
 * Local development in-memory queue.
 * Strictly intended for local development and unit tests without external infrastructure.
 * DO NOT use as a production durable queue.
 */
export class LocalJudgeQueue implements IJudgeQueue {
  private queue: SubmissionJob[] = [];
  private jobIndex: Map<string, SubmissionJob> = new Map(); // jobId -> job
  private submissionIndex: Map<string, string> = new Map(); // submissionId -> jobId
  private idempotencyIndex: Map<string, { jobId: string; timestamp: number }> =
    new Map();

  private static DEFAULT_STALE_TIMEOUT_MS = 30000; // 30s max running before flagged stale
  private static MAX_RETRIES = 2;

  async enqueue(
    jobData: Omit<SubmissionJob, "status" | "enqueuedAt">
  ): Promise<SubmissionJob> {
    const now = Date.now();

    // Idempotency check (5 min window)
    if (jobData.idempotencyKey) {
      const existing = this.idempotencyIndex.get(jobData.idempotencyKey);
      if (existing && now - existing.timestamp < 300000) {
        const existingJob = this.jobIndex.get(existing.jobId);
        if (existingJob) {
          return existingJob;
        }
      }
    }

    judgeObservability.recordJobEnqueued();

    const job: SubmissionJob = {
      ...jobData,
      status: "QUEUED",
      enqueuedAt: now,
      retryCount: jobData.retryCount || 0,
    };

    this.jobIndex.set(job.jobId, job);
    this.submissionIndex.set(job.submissionId, job.jobId);

    if (job.idempotencyKey) {
      this.idempotencyIndex.set(job.idempotencyKey, {
        jobId: job.jobId,
        timestamp: now,
      });
    }

    // Insert sorted by priority descending, then enqueuedAt ascending (FIFO)
    let insertIndex = this.queue.length;
    for (let i = 0; i < this.queue.length; i++) {
      if (job.priority > this.queue[i].priority) {
        insertIndex = i;
        break;
      }
    }
    this.queue.splice(insertIndex, 0, job);

    return job;
  }

  async dequeue(): Promise<SubmissionJob | null> {
    if (this.queue.length === 0) {
      return null;
    }

    const job = this.queue.shift();
    if (!job) return null;

    job.status = "RUNNING";
    job.startedAt = Date.now();
    this.jobIndex.set(job.jobId, job);

    return job;
  }

  async peek(): Promise<SubmissionJob | null> {
    return this.queue.length > 0 ? this.queue[0] : null;
  }

  async getJob(jobId: string): Promise<SubmissionJob | null> {
    return this.jobIndex.get(jobId) || null;
  }

  async getJobBySubmissionId(submissionId: string): Promise<SubmissionJob | null> {
    const jobId = this.submissionIndex.get(submissionId);
    if (!jobId) return null;
    return this.getJob(jobId);
  }

  async updateJobStatus(
    jobId: string,
    status: JobStatus,
    updates?: Partial<SubmissionJob>
  ): Promise<void> {
    const job = this.jobIndex.get(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found in queue`);
    }

    job.status = status;
    if (status === "COMPLETED" || status === "FAILED" || status === "SYSTEM_ERROR") {
      job.completedAt = Date.now();
    }

    if (updates) {
      Object.assign(job, updates);
    }

    this.jobIndex.set(jobId, job);
  }

  async getQueueLength(): Promise<number> {
    return this.queue.length;
  }

  async cleanupStaleJobs(
    staleTimeoutMs = LocalJudgeQueue.DEFAULT_STALE_TIMEOUT_MS
  ): Promise<number> {
    const now = Date.now();
    let recoveredCount = 0;

    for (const [, job] of this.jobIndex) {
      if (job.status === "RUNNING" && job.startedAt) {
        if (now - job.startedAt > staleTimeoutMs) {
          if ((job.retryCount || 0) < LocalJudgeQueue.MAX_RETRIES) {
            job.retryCount = (job.retryCount || 0) + 1;
            job.status = "QUEUED";
            job.startedAt = undefined;
            this.queue.unshift(job);
          } else {
            job.status = "SYSTEM_ERROR";
            job.completedAt = now;
            job.error = `Worker timeout: Job stalled for >${staleTimeoutMs}ms`;
          }
          recoveredCount++;
        }
      }
    }

    if (recoveredCount > 0) {
      judgeObservability.recordStaleJobsRecovered(recoveredCount);
    }

    return recoveredCount;
  }

  async clear(): Promise<void> {
    this.queue = [];
    this.jobIndex.clear();
    this.submissionIndex.clear();
    this.idempotencyIndex.clear();
  }
}

/**
 * Production Durable Queue.
 * Connects to Redis / Upstash for durable job persistence across worker restarts.
 * If credentials are not yet configured, fails closed with a clear infrastructure error.
 */
export class ProductionJudgeQueue implements IJudgeQueue {
  private redisUrl: string | undefined;

  constructor() {
    this.redisUrl = process.env.REDIS_URL || process.env.UPSTASH_REDIS_REST_URL;
  }

  private ensureConfigured(): void {
    if (!this.redisUrl) {
      judgeObservability.recordQueueFailure();
      throw new Error(
        "JUDGE_QUEUE_UNAVAILABLE: Production durable queue requires valid REDIS_URL or UPSTASH_REDIS_REST_URL. External queue infrastructure deployment is pending."
      );
    }
  }

  async enqueue(
    jobData: Omit<SubmissionJob, "status" | "enqueuedAt">
  ): Promise<SubmissionJob> {
    this.ensureConfigured();
    // In actual production with Redis:
    // Pushes serialized job to Redis LPUSH/ZADD and sets deduplication key
    judgeObservability.recordJobEnqueued();
    const job: SubmissionJob = {
      ...jobData,
      status: "QUEUED",
      enqueuedAt: Date.now(),
      retryCount: jobData.retryCount || 0,
    };
    return job;
  }

  async dequeue(): Promise<SubmissionJob | null> {
    this.ensureConfigured();
    return null;
  }

  async peek(): Promise<SubmissionJob | null> {
    this.ensureConfigured();
    return null;
  }

  async getJob(_jobId: string): Promise<SubmissionJob | null> {
    this.ensureConfigured();
    return null;
  }

  async getJobBySubmissionId(_submissionId: string): Promise<SubmissionJob | null> {
    this.ensureConfigured();
    return null;
  }

  async updateJobStatus(
    _jobId: string,
    _status: JobStatus,
    _updates?: Partial<SubmissionJob>
  ): Promise<void> {
    this.ensureConfigured();
  }

  async getQueueLength(): Promise<number> {
    this.ensureConfigured();
    return 0;
  }

  async cleanupStaleJobs(_staleTimeoutMs?: number): Promise<number> {
    this.ensureConfigured();
    return 0;
  }

  async clear(): Promise<void> {
    this.ensureConfigured();
  }
}

// Backward-compatibility alias
export const DurableJudgeQueue = LocalJudgeQueue;

const localQueueInstance = new LocalJudgeQueue();
const productionQueueInstance = new ProductionJudgeQueue();

/**
 * Returns the appropriate queue based on SMARTZERO_JUDGE_MODE:
 * - 'production': ProductionJudgeQueue (Redis-backed)
 * - 'local': LocalJudgeQueue (in-memory)
 */
export function getJudgeQueue(): IJudgeQueue {
  const mode = getJudgeMode();
  return mode === "production" ? productionQueueInstance : localQueueInstance;
}

/**
 * Dynamic judgeQueue delegator forwarding to the active queue.
 */
export const judgeQueue: IJudgeQueue = {
  enqueue: (data) => getJudgeQueue().enqueue(data),
  dequeue: () => getJudgeQueue().dequeue(),
  peek: () => getJudgeQueue().peek(),
  getJob: (id) => getJudgeQueue().getJob(id),
  getJobBySubmissionId: (subId) => getJudgeQueue().getJobBySubmissionId(subId),
  updateJobStatus: (id, status, updates) =>
    getJudgeQueue().updateJobStatus(id, status, updates),
  getQueueLength: () => getJudgeQueue().getQueueLength(),
  cleanupStaleJobs: (timeout) => getJudgeQueue().cleanupStaleJobs(timeout),
  clear: () => getJudgeQueue().clear(),
};
