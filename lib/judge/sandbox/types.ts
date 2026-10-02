import type { CodingLanguage, SingleExecutionResult } from "../types";

export interface SandboxExecutionParams {
  code: string;
  language: CodingLanguage;
  input: string;
  timeLimitMs: number;
  memoryLimitMb?: number;
}

export interface ISandboxRunner {
  readonly name: string;
  isAvailable(): Promise<boolean>;
  execute(params: SandboxExecutionParams): Promise<SingleExecutionResult>;
}

export type { SingleExecutionResult };
