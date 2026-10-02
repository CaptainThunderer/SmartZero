import type { CodingLanguage } from "@/types/contest";
import type { JudgeExecutionSummary } from "../types";

export type JobStatus =
  | "QUEUED"
  | "RUNNING"
  | "COMPLETED"
  | "FAILED"
  | "SYSTEM_ERROR";

export interface SubmissionJob {
  jobId: string;
  submissionId: string;
  contestId: string;
  questionId: string;
  userId: string;
  language: CodingLanguage;
  code: string;
  status: JobStatus;
  priority: number;
  idempotencyKey?: string;
  enqueuedAt: number;
  startedAt?: number;
  completedAt?: number;
  result?: JudgeExecutionSummary;
  error?: string;
  workerId?: string;
  retryCount?: number;
}

export interface IJudgeQueue {
  enqueue(
    jobData: Omit<SubmissionJob, "status" | "enqueuedAt">
  ): Promise<SubmissionJob>;
  dequeue(): Promise<SubmissionJob | null>;
  peek(): Promise<SubmissionJob | null>;
  getJob(jobId: string): Promise<SubmissionJob | null>;
  getJobBySubmissionId(submissionId: string): Promise<SubmissionJob | null>;
  updateJobStatus(
    jobId: string,
    status: JobStatus,
    updates?: Partial<SubmissionJob>
  ): Promise<void>;
  getQueueLength(): Promise<number>;
  cleanupStaleJobs(staleTimeoutMs?: number): Promise<number>;
  clear(): Promise<void>;
}
