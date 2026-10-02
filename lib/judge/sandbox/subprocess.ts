import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawn, execSync } from "node:child_process";
import type { ISandboxRunner, SandboxExecutionParams, SingleExecutionResult } from "./types";
import { LANGUAGE_CONFIGS, JUDGE_RESOURCE_LIMITS, HOST_SECRET_ENV_KEYS } from "../config";

export class HardenedSubprocessSandbox implements ISandboxRunner {
  readonly name = "hardened-subprocess";

  async isAvailable(): Promise<boolean> {
    return true; // Always available on host
  }

  /**
   * Sanitizes environment variables so NO host secrets, database URLs, or API keys
   * are exposed to executed student code.
   */
  private createSanitizedEnv(tmpDir: string): NodeJS.ProcessEnv {
    const cleanEnv: NodeJS.ProcessEnv = {
      PATH: process.env.PATH || "",
      HOME: tmpDir,
      TEMP: tmpDir,
      TMP: tmpDir,
      NODE_ENV: "production",
      PYTHONUNBUFFERED: "1",
      LANG: "en_US.UTF-8",
    };

    // Filter out any potential sensitive variables from host env
    for (const key of Object.keys(process.env)) {
      const upper = key.toUpperCase();
      const isSecret =
        HOST_SECRET_ENV_KEYS.includes(upper as (typeof HOST_SECRET_ENV_KEYS)[number]) ||
        upper.includes("SECRET") ||
        upper.includes("TOKEN") ||
        upper.includes("PASSWORD") ||
        upper.includes("KEY") ||
        upper.includes("SUPABASE") ||
        upper.includes("DATABASE");

      if (!isSecret && !cleanEnv[key] && !["PATH", "HOME", "TEMP", "TMP"].includes(key)) {
        // Keep non-sensitive standard system env vars
        if (key.startsWith("SYSTEM") || key.startsWith("WINDIR") || key.startsWith("COMSPEC")) {
          cleanEnv[key] = process.env[key];
        }
      }
    }

    return cleanEnv;
  }

  /**
   * Pre-execution static analysis check for dangerous patterns.
   */
  private checkSecurity(code: string, language: string): string | null {
    if (Buffer.byteLength(code, "utf-8") > JUDGE_RESOURCE_LIMITS.MAX_SOURCE_CODE_BYTES) {
      return "Code size exceeds the maximum limit (64 KB).";
    }

    // Security guard: attempt to traverse into host .env or shadow files
    const forbiddenPathPatterns = [
      /\.\.\/\.\.\/\.env/i,
      /\/etc\/shadow/i,
      /\/etc\/passwd/i,
      /C:\\Windows\\System32\\config/i,
    ];

    for (const pattern of forbiddenPathPatterns) {
      if (pattern.test(code)) {
        return "Security Violation: Access to restricted filesystem paths is forbidden.";
      }
    }

    // Security guard: attempt to kill host processes or send signals
    const forbiddenProcessPatterns = [
      /\bos\.kill\b/i,
      /\bprocess\.kill\b/i,
      /\btaskkill\b/i,
      /\bTerminateProcess\b/i,
    ];

    for (const pattern of forbiddenProcessPatterns) {
      if (pattern.test(code)) {
        return "Security Violation: Process termination and signal emission are forbidden.";
      }
    }

    return null;
  }

  async execute(params: SandboxExecutionParams): Promise<SingleExecutionResult> {
    const langConfig = LANGUAGE_CONFIGS[params.language];
    if (!langConfig) {
      return {
        verdict: "Runtime Error",
        execution_time_ms: 0,
        actual_output: "",
        error: `Unsupported language: ${params.language}`,
        timed_out: false,
      };
    }

    const securityError = this.checkSecurity(params.code, params.language);
    if (securityError) {
      return {
        verdict: "Runtime Error",
        execution_time_ms: 0,
        actual_output: "",
        error: securityError,
        timed_out: false,
      };
    }

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "sz-hardened-"));
    const sourceFilePath = path.join(tmpDir, langConfig.sourceFile);

    try {
      fs.writeFileSync(sourceFilePath, params.code, "utf-8");

      const sanitizedEnv = this.createSanitizedEnv(tmpDir);
      const outFileName = process.platform === "win32" ? "solution.exe" : "solution";

      // ── Compilation Step (if applicable) ──
      if (langConfig.compileCommand && langConfig.compileArgs) {
        const compileArgs = langConfig.compileArgs(langConfig.sourceFile, outFileName);

        try {
          execSync(`${langConfig.compileCommand} ${compileArgs.join(" ")}`, {
            cwd: tmpDir,
            env: sanitizedEnv,
            timeout: 8000,
            stdio: "pipe",
          });
        } catch (compileErr: unknown) {
          const err = compileErr as { stderr?: Buffer; stdout?: Buffer; message?: string };
          const compileOutput = (err.stderr?.toString() || err.stdout?.toString() || err.message || "Compilation failed").slice(
            0,
            JUDGE_RESOURCE_LIMITS.MAX_OUTPUT_BYTES
          );

          return {
            verdict: "Compilation Error",
            execution_time_ms: 0,
            actual_output: "",
            error: compileOutput,
            timed_out: false,
          };
        }
      }

      // ── Execution Step ──
      const timeLimitMs = Math.min(
        Math.max(params.timeLimitMs || JUDGE_RESOURCE_LIMITS.DEFAULT_TIME_LIMIT_MS, JUDGE_RESOURCE_LIMITS.MIN_TIME_LIMIT_MS),
        JUDGE_RESOURCE_LIMITS.MAX_TIME_LIMIT_MS
      );

      return await new Promise<SingleExecutionResult>((resolve) => {
        const startTime = process.hrtime.bigint();
        let timedOut = false;
        let stdout = "";
        let stderr = "";
        let stdoutBytes = 0;
        let stderrBytes = 0;

        let child: ReturnType<typeof spawn>;
        const commandToRun = (langConfig.command === "solution.exe" || langConfig.command === "./solution")
          ? path.join(tmpDir, outFileName)
          : langConfig.command;

        try {
          child = spawn(commandToRun, langConfig.args, {
            cwd: tmpDir,
            env: sanitizedEnv,
            stdio: ["pipe", "pipe", "pipe"],
            windowsHide: true,
          });
        } catch (spawnErr) {
          return resolve({
            verdict: "Runtime Error",
            execution_time_ms: 0,
            actual_output: "",
            error: `Failed to spawn runtime: ${(spawnErr as Error).message}`,
            timed_out: false,
          });
        }

        // Strict timeout watchdog
        const timer = setTimeout(() => {
          timedOut = true;
          try {
            if (process.platform === "win32") {
              if (child.pid) {
                spawn("taskkill", ["/pid", child.pid.toString(), "/f", "/t"]);
              }
            } else {
              child.kill("SIGKILL");
            }
          } catch {
            // best effort kill
          }
        }, timeLimitMs);

        // Safe stream consumption with strict 64KB cap
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

          // If the binary doesn't exist (e.g. g++ or java not installed on worker)
          if ((err as NodeJS.ErrnoException).code === "ENOENT") {
            return resolve({
              verdict: "Compilation Error",
              execution_time_ms: Math.round(durationMs),
              actual_output: "",
              error: `Runtime/compiler binary '${langConfig.command}' is not installed or available on this host.`,
              timed_out: false,
            });
          }

          resolve({
            verdict: "Runtime Error",
            execution_time_ms: Math.round(durationMs),
            actual_output: "",
            error: `Execution error: ${err.message}`,
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
            const isCompileErr =
              stderr.includes("SyntaxError") ||
              stderr.includes("IndentationError") ||
              stderr.includes("error:") ||
              stderr.includes("fatal error:");

            return resolve({
              verdict: isCompileErr ? "Compilation Error" : "Runtime Error",
              execution_time_ms: Math.round(durationMs),
              actual_output: stdout,
              error: stderr.trim() || `Process exited with code ${code}`,
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

        // Feed input to stdin
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
      // Guaranteed workspace removal
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch {
        // best effort cleanup
      }
    }
  }
}
