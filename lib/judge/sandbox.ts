/**
 * Sandbox Execution Facade
 * Delegates to the isolated hardened sandbox runner (or Docker if available).
 */
export {
  executeInSandbox,
  getSandboxRunner,
  clearSandboxRunnerCache,
  HardenedSubprocessSandbox,
  DockerSandboxRunner,
  FailClosedSandboxRunner,
} from "./sandbox/index";

export type {
  ISandboxRunner,
  SandboxExecutionParams,
  SingleExecutionResult,
} from "./sandbox/types";
