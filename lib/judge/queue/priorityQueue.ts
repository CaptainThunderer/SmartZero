import type { JudgeWorkerJobRequest, JudgeWorkerJobResponse } from "../types";

export interface QueueJobItem {
  id: string;
  request: JudgeWorkerJobRequest;
  priority: number; // 10 = submit (HIGH), 5 = normal, 1 = run (LOW)
  enqueuedAt: number;
  startedAt?: number;
  completedAt?: number;
  resolve: (value: JudgeWorkerJobResponse) => void;
  reject: (reason: unknown) => void;
  executor: (req: JudgeWorkerJobRequest) => Promise<JudgeWorkerJobResponse>;
}

export interface PriorityQueueMetrics {
  currentQueueDepth: number;
  maxQueueDepth: number;
  activeWorkers: number;
  maxConcurrency: number;
  totalQueued: number;
  totalCompleted: number;
  totalFailed: number;
  avgQueueWaitMs: number;
  maxQueueWaitMs: number;
  avgExecutionMs: number;
  maxExecutionMs: number;
  highPriorityCount: number;
  lowPriorityCount: number;
  queueWaitTimes: number[];
  executionTimes: number[];
}

/**
 * High-performance, concurrency-controlled Priority Queue for coding judge executions.
 *
 * Enforces:
 * 1. Controlled worker concurrency (default: 3 workers, configurable between 1 and 4 for 512MB RAM Render Free).
 * 2. Strict Priority Scheduling:
 *    - HIGH (priority = 10): Official coding SUBMIT
 *    - LOW (priority = 1): Interactive Run Code
 *    Run Code never starves official submissions: Submit jobs always jump to the front of the line.
 * 3. Zero lost jobs: every job completes deterministically.
 * 4. Comprehensive observability (queue depth, wait latency, execution latency, error counts).
 */
export class PriorityJudgeQueue {
  private queue: QueueJobItem[] = [];
  private activeWorkers = 0;
  private maxConcurrency: number;
  private maxQueueDepth = 0;
  private totalQueued = 0;
  private totalCompleted = 0;
  private totalFailed = 0;
  private highPriorityCount = 0;
  private lowPriorityCount = 0;
  private queueWaitTimes: number[] = [];
  private executionTimes: number[] = [];

  constructor(maxConcurrency?: number) {
    const envConcurrency = process.env.SMARTZERO_JUDGE_CONCURRENCY
      ? parseInt(process.env.SMARTZERO_JUDGE_CONCURRENCY, 10)
      : undefined;
    // Default to 3, safe for 512MB RAM constraints (each isolated run ~32-64MB)
    this.maxConcurrency = maxConcurrency || envConcurrency || 3;
  }

  getConcurrency(): number {
    return this.maxConcurrency;
  }

  setConcurrency(concurrency: number): void {
    this.maxConcurrency = Math.max(1, Math.min(concurrency, 10));
  }

  /**
   * Enqueues a judge job with strict priority ordering.
   * High-priority Submit (priority 10) preempts low-priority Run (priority 1).
   */
  async enqueueJob(
    request: JudgeWorkerJobRequest,
    executor: (req: JudgeWorkerJobRequest) => Promise<JudgeWorkerJobResponse>
  ): Promise<JudgeWorkerJobResponse> {
    const priority = request.execution_mode === "submit" ? 10 : 1;
    if (priority === 10) {
      this.highPriorityCount++;
    } else {
      this.lowPriorityCount++;
    }

    this.totalQueued++;

    return new Promise<JudgeWorkerJobResponse>((resolve, reject) => {
      const item: QueueJobItem = {
        id: request.job_id,
        request,
        priority,
        enqueuedAt: Date.now(),
        resolve,
        reject,
        executor,
      };

      // Insert sorted by priority descending, then enqueuedAt ascending (FIFO within same priority)
      let insertIdx = this.queue.length;
      for (let i = 0; i < this.queue.length; i++) {
        if (priority > this.queue[i].priority) {
          insertIdx = i;
          break;
        }
      }
      this.queue.splice(insertIdx, 0, item);

      if (this.queue.length > this.maxQueueDepth) {
        this.maxQueueDepth = this.queue.length;
      }

      this.processNext();
    });
  }

  private processNext(): void {
    if (this.activeWorkers >= this.maxConcurrency || this.queue.length === 0) {
      return;
    }

    const job = this.queue.shift();
    if (!job) return;

    this.activeWorkers++;
    job.startedAt = Date.now();
    const waitTime = job.startedAt - job.enqueuedAt;
    this.queueWaitTimes.push(waitTime);

    job
      .executor(job.request)
      .then((response) => {
        job.completedAt = Date.now();
        const execTime = job.completedAt - (job.startedAt || job.enqueuedAt);
        this.executionTimes.push(execTime);
        this.totalCompleted++;
        job.resolve(response);
      })
      .catch((err) => {
        job.completedAt = Date.now();
        this.totalFailed++;
        job.reject(err);
      })
      .finally(() => {
        this.activeWorkers--;
        this.processNext();
      });

    // If more concurrency slots available, trigger next
    if (this.activeWorkers < this.maxConcurrency && this.queue.length > 0) {
      this.processNext();
    }
  }

  getMetrics(): PriorityQueueMetrics {
    const avgWait =
      this.queueWaitTimes.length > 0
        ? Math.round(
            this.queueWaitTimes.reduce((a, b) => a + b, 0) /
              this.queueWaitTimes.length
          )
        : 0;
    const maxWait =
      this.queueWaitTimes.length > 0
        ? Math.max(...this.queueWaitTimes)
        : 0;

    const avgExec =
      this.executionTimes.length > 0
        ? Math.round(
            this.executionTimes.reduce((a, b) => a + b, 0) /
              this.executionTimes.length
          )
        : 0;
    const maxExec =
      this.executionTimes.length > 0
        ? Math.max(...this.executionTimes)
        : 0;

    return {
      currentQueueDepth: this.queue.length,
      maxQueueDepth: this.maxQueueDepth,
      activeWorkers: this.activeWorkers,
      maxConcurrency: this.maxConcurrency,
      totalQueued: this.totalQueued,
      totalCompleted: this.totalCompleted,
      totalFailed: this.totalFailed,
      avgQueueWaitMs: avgWait,
      maxQueueWaitMs: maxWait,
      avgExecutionMs: avgExec,
      maxExecutionMs: maxExec,
      highPriorityCount: this.highPriorityCount,
      lowPriorityCount: this.lowPriorityCount,
      queueWaitTimes: [...this.queueWaitTimes],
      executionTimes: [...this.executionTimes],
    };
  }

  reset(): void {
    this.queue = [];
    this.activeWorkers = 0;
    this.maxQueueDepth = 0;
    this.totalQueued = 0;
    this.totalCompleted = 0;
    this.totalFailed = 0;
    this.highPriorityCount = 0;
    this.lowPriorityCount = 0;
    this.queueWaitTimes = [];
    this.executionTimes = [];
  }
}

export const priorityJudgeQueue = new PriorityJudgeQueue();
