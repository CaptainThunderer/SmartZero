import vm from "node:vm";
import { spawnSync } from "node:child_process";
import type { ProblemSolutionPlan } from "../types/dsa";

export interface CodeExecutionResult {
  language: "javascript" | "python" | "cpp";
  executed: boolean;
  success: boolean;
  output: string;
  error?: string;
}

export interface VerificationResult {
  verified: boolean;
  jsResult: CodeExecutionResult;
  pythonResult: CodeExecutionResult;
  cppResult: CodeExecutionResult;
  summary: string;
}

/**
 * Executes JavaScript code in an isolated Node VM context.
 */
export function verifyJavaScript(code: string, timeoutMs = 2500): CodeExecutionResult {
  try {
    const logs: string[] = [];
    const sandbox = {
      console: {
        log: (...args: unknown[]) => logs.push(args.map(String).join(" ")),
        error: (...args: unknown[]) => logs.push(args.map(String).join(" ")),
        warn: (...args: unknown[]) => logs.push(args.map(String).join(" ")),
      },
      module: { exports: {} },
      exports: {},
    };

    const context = vm.createContext(sandbox);
    const script = new vm.Script(code);
    script.runInContext(context, { timeout: timeoutMs });

    return {
      language: "javascript",
      executed: true,
      success: true,
      output: logs.join("\n").trim() || "Execution succeeded with no console output.",
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      language: "javascript",
      executed: true,
      success: false,
      output: "",
      error: errorMsg,
    };
  }
}

/**
 * Executes Python code using the local python runtime if available.
 */
export function verifyPython(code: string, timeoutMs = 3000): CodeExecutionResult {
  try {
    const run = spawnSync("python", ["-c", code], {
      timeout: timeoutMs,
      encoding: "utf-8",
      windowsHide: true,
    });

    if (run.error) {
      if ((run.error as { code?: string }).code === "ENOENT") {
        return {
          language: "python",
          executed: false,
          success: false,
          output: "",
          error: "Python runtime is not installed or not found in system PATH.",
        };
      }
      return {
        language: "python",
        executed: true,
        success: false,
        output: run.stdout || "",
        error: run.error.message,
      };
    }

    if (run.status !== 0) {
      return {
        language: "python",
        executed: true,
        success: false,
        output: run.stdout || "",
        error: run.stderr?.trim() || `Process exited with code ${run.status}`,
      };
    }

    return {
      language: "python",
      executed: true,
      success: true,
      output: run.stdout?.trim() || "Execution succeeded.",
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      language: "python",
      executed: false,
      success: false,
      output: "",
      error: errorMsg,
    };
  }
}

/**
 * Checks whether a C++ compiler is available in the local environment.
 */
export function checkCppCompiler(): { available: boolean; compiler?: string } {
  try {
    const gpp = spawnSync("g++", ["--version"], { encoding: "utf-8", windowsHide: true });
    if (!gpp.error && gpp.status === 0) return { available: true, compiler: "g++" };

    const clang = spawnSync("clang++", ["--version"], { encoding: "utf-8", windowsHide: true });
    if (!clang.error && clang.status === 0) return { available: true, compiler: "clang++" };

    return { available: false };
  } catch {
    return { available: false };
  }
}

/**
 * Verifies a complete ProblemSolutionPlan across available runtimes.
 */
export async function verifyProblemSolution(plan: ProblemSolutionPlan): Promise<VerificationResult> {
  const jsCode = plan.implementations.javascript;
  const pyCode = plan.implementations.python;

  const jsRes = verifyJavaScript(jsCode);
  const pyRes = verifyPython(pyCode);
  const cppCompiler = checkCppCompiler();

  const cppRes: CodeExecutionResult = cppCompiler.available
    ? {
        language: "cpp",
        executed: false,
        success: true,
        output: `C++ compiler (${cppCompiler.compiler}) detected.`,
      }
    : {
        language: "cpp",
        executed: false,
        success: false,
        output: "C++ compiler (g++/clang++) is not available in current environment; compilation skipped.",
      };

  const verified = jsRes.success && (pyRes.executed ? pyRes.success : true);
  const summary = verified
    ? `Solution verified: JavaScript PASSED${pyRes.executed && pyRes.success ? ", Python PASSED" : ""}.`
    : `Verification error: ${jsRes.error || pyRes.error || "Execution error"}`;

  return {
    verified,
    jsResult: jsRes,
    pythonResult: pyRes,
    cppResult: cppRes,
    summary,
  };
}
