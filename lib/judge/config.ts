import type { CodingLanguage } from "@/types/contest";

export interface LanguageRuntimeConfig {
  language: CodingLanguage;
  name: string;
  sourceFile: string;
  command: string;
  args: string[];
  compileCommand?: string;
  compileArgs?: (sourceFile: string, outFile: string) => string[];
  timeoutMultiplier: number;
  memoryMultiplier: number;
  dockerImage?: string;
}

export const JUDGE_RESOURCE_LIMITS = {
  DEFAULT_TIME_LIMIT_MS: 2000,
  MIN_TIME_LIMIT_MS: 100,
  MAX_TIME_LIMIT_MS: 10000,
  DEFAULT_MEMORY_LIMIT_MB: 256,
  MAX_MEMORY_LIMIT_MB: 512,
  MAX_OUTPUT_BYTES: 65536, // 64 KB cap against stdout/stderr flooding
  MAX_SOURCE_CODE_BYTES: 65536, // 64 KB code size limit
  PID_LIMIT: 64, // Fork bomb barrier
  CPU_QUOTA: 1.0, // 1 CPU core max
  TMPFS_SIZE: "64m",
} as const;

export const LANGUAGE_CONFIGS: Record<CodingLanguage, LanguageRuntimeConfig> = {
  python: {
    language: "python",
    name: "Python 3.11+",
    sourceFile: "solution.py",
    command: process.platform === "win32" ? "python" : "python3",
    args: ["-u", "solution.py"],
    timeoutMultiplier: 1.0,
    memoryMultiplier: 1.0,
    dockerImage: "python:3.11-alpine",
  },
  javascript: {
    language: "javascript",
    name: "Node.js JavaScript (ES2024)",
    sourceFile: "solution.js",
    command: "node",
    args: ["--max-old-space-size=128", "solution.js"],
    timeoutMultiplier: 1.0,
    memoryMultiplier: 1.0,
    dockerImage: "node:20-alpine",
  },
  typescript: {
    language: "typescript",
    name: "Node.js TypeScript",
    sourceFile: "solution.ts",
    command: "node",
    args: ["--experimental-strip-types", "--max-old-space-size=128", "solution.ts"],
    timeoutMultiplier: 1.0,
    memoryMultiplier: 1.0,
    dockerImage: "node:22-alpine",
  },
  cpp: {
    language: "cpp",
    name: "C++ (g++ 17)",
    sourceFile: "solution.cpp",
    command: process.platform === "win32" ? "solution.exe" : "./solution",
    args: [],
    compileCommand: "g++",
    compileArgs: (source, out) => ["-O2", "-std=c++17", source, "-o", out],
    timeoutMultiplier: 0.8,
    memoryMultiplier: 0.8,
    dockerImage: "gcc:13-alpine",
  },
  java: {
    language: "java",
    name: "Java (OpenJDK 21)",
    sourceFile: "Main.java",
    command: "java",
    args: ["-Xmx256m", "-Xms64m", "Main"],
    compileCommand: "javac",
    compileArgs: (source) => [source],
    timeoutMultiplier: 1.5,
    memoryMultiplier: 1.5,
    dockerImage: "eclipse-temurin:21-alpine",
  },
};

/**
 * Docker container security flags for isolated production worker execution.
 */
export const DOCKER_SANDBOX_FLAGS = [
  "--rm",
  "--network", "none",
  "--cpus", "1.0",
  "-m", "256m",
  "--memory-swap", "256m",
  "--pids-limit", "64",
  "--read-only",
  "--tmpfs", "/tmp:rw,noexec,nosuid,size=64m",
  "--cap-drop", "ALL",
  "--security-opt", "no-new-privileges",
] as const;

/**
 * Host secrets environment blocklist.
 * Ensures NO database keys, Supabase credentials, or AI tokens leak into the sandbox.
 */
export const HOST_SECRET_ENV_KEYS = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "DATABASE_URL",
  "POSTGRES_PASSWORD",
  "OPENAI_API_KEY",
  "GEMINI_API_KEY",
  "OPENROUTER_API_KEY",
  "FEATHERLESS_API_KEY",
  "REDIS_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "JWT_SECRET",
  "AUTH_SECRET",
  "SESSION_SECRET",
  "SMARTZERO_SESSION_SECRET",
  "STUDENT_SESSION_SECRET",
] as const;

export type JudgeMode = "local" | "production";

/**
 * Determines current judge execution mode:
 * - 'local': Development sandbox (HardenedSubprocessSandbox), in-memory queue, local worker, Docker NOT required.
 * - 'production': External durable queue, dedicated worker, Docker/gVisor mandatory. Fail-closed if container sandbox unavailable.
 */
export function getJudgeMode(): JudgeMode {
  if (process.env.SMARTZERO_JUDGE_MODE === "production") {
    return "production";
  }
  if (process.env.SMARTZERO_JUDGE_MODE === "local") {
    return "local";
  }
  if (process.env.NODE_ENV === "production") {
    return "production";
  }
  return "local";
}
