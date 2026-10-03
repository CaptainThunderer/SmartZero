import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawn, execSync } from "node:child_process";
import type { ISandboxRunner, SandboxExecutionParams, SingleExecutionResult } from "./types";
import { LANGUAGE_CONFIGS, JUDGE_RESOURCE_LIMITS, DOCKER_SANDBOX_FLAGS } from "../config";

export class DockerSandboxRunner implements ISandboxRunner {
  readonly name = "docker-sandbox";
  private dockerChecked = false;
  private dockerAvailable = false;

  async isAvailable(): Promise<boolean> {
    if (process.env.SMARTZERO_DOCKER_AVAILABLE === "false") {
      return false;
    }
    if (this.dockerChecked) {
      return this.dockerAvailable;
    }

    try {
      execSync("docker --version", { stdio: "ignore", timeout: 2000 });
      execSync("docker info", { stdio: "ignore", timeout: 3000 });
      this.dockerAvailable = true;
    } catch {
      this.dockerAvailable = false;
    }

    this.dockerChecked = true;
    return this.dockerAvailable;
  }

  async execute(params: SandboxExecutionParams): Promise<SingleExecutionResult> {
    const isAvail = await this.isAvailable();
    if (!isAvail) {
      throw new Error(
        "Docker daemon is not available on this host. Run worker in hardened-subprocess mode or start Docker."
      );
    }

    const langConfig = LANGUAGE_CONFIGS[params.language];
    if (!langConfig || !langConfig.dockerImage) {
      return {
        verdict: "Runtime Error",
        execution_time_ms: 0,
        actual_output: "",
        error: `Docker image not defined for language: ${params.language}`,
        timed_out: false,
      };
    }

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "sz-docker-"));
    const sourceFilePath = path.join(tmpDir, langConfig.sourceFile);

    try {
      fs.writeFileSync(sourceFilePath, params.code, "utf-8");

      const timeLimitMs = Math.min(
        Math.max(params.timeLimitMs || JUDGE_RESOURCE_LIMITS.DEFAULT_TIME_LIMIT_MS, JUDGE_RESOURCE_LIMITS.MIN_TIME_LIMIT_MS),
        JUDGE_RESOURCE_LIMITS.MAX_TIME_LIMIT_MS
      );

      // Mount host directory as /workspace:ro inside container
      const dockerArgs = [
        "run",
        ...DOCKER_SANDBOX_FLAGS,
        "-v", `${tmpDir}:/workspace:ro`,
        "-w", "/workspace",
        "-i",
        langConfig.dockerImage,
        langConfig.command,
        ...langConfig.args,
      ];

      return await new Promise<SingleExecutionResult>((resolve) => {
        const startTime = process.hrtime.bigint();
        let timedOut = false;
        let stdout = "";
        let stderr = "";
        let stdoutBytes = 0;
        let stderrBytes = 0;

        const child = spawn("docker", dockerArgs, {
          stdio: ["pipe", "pipe", "pipe"],
          windowsHide: true,
        });

        const timer = setTimeout(() => {
          timedOut = true;
          try {
            if (process.platform === "win32") {
              if (child.pid) spawn("taskkill", ["/pid", child.pid.toString(), "/f", "/t"]);
            } else {
              child.kill("SIGKILL");
            }
          } catch {
            // best effort kill
          }
        }, timeLimitMs + 1000); // 1s buffer for docker container initialization

        child.stdout?.on("data", (chunk: Buffer) => {
          if (stdoutBytes < JUDGE_RESOURCE_LIMITS.MAX_OUTPUT_BYTES) {
            const remaining = JUDGE_RESOURCE_LIMITS.MAX_OUTPUT_BYTES - stdoutBytes;
            const slice = chunk.subarray(0, remaining);
            stdout += slice.toString("utf-8");
            stdoutBytes += slice.length;
          }
        });

        child.stderr?.on("data", (chunk: Buffer) => {
          if (stderrBytes < JUDGE_RESOURCE_LIMITS.MAX_OUTPUT_BYTES) {
            const remaining = JUDGE_RESOURCE_LIMITS.MAX_OUTPUT_BYTES - stderrBytes;
            const slice = chunk.subarray(0, remaining);
            stderr += slice.toString("utf-8");
            stderrBytes += slice.length;
          }
        });

        child.on("error", (err) => {
          clearTimeout(timer);
          const endTime = process.hrtime.bigint();
          const durationMs = Number(endTime - startTime) / 1_000_000;

          resolve({
            verdict: "Runtime Error",
            execution_time_ms: Math.round(durationMs),
            actual_output: "",
            error: `Docker execution error: ${err.message}`,
            timed_out: false,
          });
        });

        child.on("close", (code) => {
          clearTimeout(timer);
          const endTime = process.hrtime.bigint();
          const durationMs = Number(endTime - startTime) / 1_000_000;

          if (timedOut) {
            return resolve({
              verdict: "TLE",
              execution_time_ms: timeLimitMs,
              actual_output: stdout,
              error: `Time Limit Exceeded (${timeLimitMs}ms)`,
              timed_out: true,
            });
          }

          if (code !== 0) {
            return resolve({
              verdict: stderr.includes("SyntaxError") ? "Compilation Error" : "Runtime Error",
              execution_time_ms: Math.round(durationMs),
              actual_output: stdout,
              error: stderr.trim() || `Container exited with code ${code}`,
              timed_out: false,
            });
          }

          resolve({
            verdict: "Accepted",
            execution_time_ms: Math.round(durationMs),
            actual_output: stdout,
            timed_out: false,
          });
        });

        if (child.stdin) {
          try {
            if (params.input) {
              child.stdin.write(params.input);
            }
            child.stdin.end();
          } catch {
            // stdin closed early
          }
        }
      });
    } finally {
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch {
        // best effort cleanup
      }
    }
  }
}
