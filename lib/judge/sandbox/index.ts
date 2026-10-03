import type { ISandboxRunner, SandboxExecutionParams, SingleExecutionResult } from "./types";
import { HardenedSubprocessSandbox } from "./subprocess";
import { DockerSandboxRunner } from "./docker";
import { getJudgeMode } from "../config";
import { judgeObservability } from "../observability";

const subprocessRunner = new HardenedSubprocessSandbox();
const dockerRunner = new DockerSandboxRunner();

/**
 * Production Fail-Closed Sandbox Runner.
 * When in production mode and Docker/gVisor is unavailable, strictly rejects execution
 * to prevent any hostile code from touching the host process.
 */
export class FailClosedSandboxRunner implements ISandboxRunner {
  readonly name = "fail-closed-production";

  async isAvailable(): Promise<boolean> {
    return false;
  }

  async execute(_params: SandboxExecutionParams): Promise<SingleExecutionResult> {
    judgeObservability.recordSandboxUnavailable();
    return {
      verdict: "SYSTEM_ERROR",
      execution_time_ms: 0,
      actual_output: "",
      error:
        "JUDGE_UNAVAILABLE: Production isolated container sandbox (Docker/gVisor) is unavailable on this host. Host-process execution fallback is strictly prohibited in production mode.",
      timed_out: false,
    };
  }
}

const failClosedRunner = new FailClosedSandboxRunner();

let lastMode: string | null = null;
let cachedRunner: ISandboxRunner | null = null;

/**
 * Resolves the appropriate sandbox runner based on SMARTZERO_JUDGE_MODE:
 * - 'production': Mandates Docker/gVisor. If unavailable, fails closed immediately.
 * - 'local': Allows HardenedSubprocessSandbox (Development Sandbox) for Docker-free local development.
 */
export async function getSandboxRunner(): Promise<ISandboxRunner> {
  const currentMode = getJudgeMode();

  if (cachedRunner && lastMode === currentMode) {
    return cachedRunner;
  }

  // When running inside a dedicated containerized worker (Docker/gVisor),
  // the container boundary itself isolates the processes.
  if (process.env.SMARTZERO_CONTAINER_WORKER === "true") {
    cachedRunner = subprocessRunner;
    lastMode = currentMode;
    return cachedRunner;
  }

  if (currentMode === "production") {
    const isDockerAvail = await dockerRunner.isAvailable();
    if (isDockerAvail) {
      cachedRunner = dockerRunner;
    } else {
      // PRODUCTION FAIL-CLOSED POLICY:
      // Host execution is strictly forbidden in production.
      cachedRunner = failClosedRunner;
    }
  } else {
    // LOCAL MODE: Docker Desktop is NOT required on developer laptop.
    if (process.env.SMARTZERO_SANDBOX_RUNNER === "docker") {
      const isDockerAvail = await dockerRunner.isAvailable();
      if (isDockerAvail) {
        cachedRunner = dockerRunner;
        lastMode = currentMode;
        return cachedRunner;
      }
    }
    // Default to HardenedSubprocessSandbox (Development Sandbox)
    cachedRunner = subprocessRunner;
  }

  lastMode = currentMode;
  return cachedRunner;
}

/**
 * Main sandbox entrypoint.
 * Executes code in the best available isolated sandbox runner adhering to mode policies.
 */
export async function executeInSandbox(
  params: SandboxExecutionParams
): Promise<SingleExecutionResult> {
  const runner = await getSandboxRunner();
  return runner.execute(params);
}

/**
 * Force clear runner cache (useful for testing mode switches).
 */
export function clearSandboxRunnerCache(): void {
  cachedRunner = null;
  lastMode = null;
}

export { HardenedSubprocessSandbox, DockerSandboxRunner };
export type { ISandboxRunner, SandboxExecutionParams, SingleExecutionResult };
