import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import type { DatabaseSync as DatabaseSyncType } from "node:sqlite";
import type {
  CodingVerdict,
  TestCaseVerdictResult,
} from "@/types/contest";
import type {
  JudgeExecutionSummary,
  JudgeTestCase,
  SafeTestCaseResult,
} from "./types";
import { JUDGE_RESOURCE_LIMITS } from "./config";

import { createRequire } from "node:module";

// Dynamically resolve node:sqlite DatabaseSync
let DatabaseSyncClass: typeof DatabaseSyncType | null = null;
try {
  const requireMod = createRequire(import.meta.url);
  const sqlite = requireMod("node:sqlite");
  DatabaseSyncClass = sqlite.DatabaseSync;
} catch {
  DatabaseSyncClass = null;
}

export interface SqlNormalizedResult {
  columns: string[];
  rows: (string | number | null)[][];
  rowCount: number;
}

/**
 * Normalizes a cell value for comparison:
 * - Trims strings and normalizes internal whitespace
 * - Handles numbers (1 == 1.0)
 * - Normalizes null/undefined
 */
export function normalizeCellValue(val: unknown): string | number | null {
  if (val === null || val === undefined) return null;
  if (typeof val === "number") {
    // Return float with up to 6 decimal precision or integer
    return Number.isInteger(val) ? val : Number(val.toFixed(6));
  }
  if (typeof val === "bigint") {
    return Number(val);
  }
  const s = String(val).trim();
  if (s.toUpperCase() === "NULL" || s === "(null)") {
    return null;
  }
  // Check if string represents a pure number
  if (/^-?\d+(\.\d+)?$/.test(s)) {
    const num = Number(s);
    if (!isNaN(num)) {
      return Number.isInteger(num) ? num : Number(num.toFixed(6));
    }
  }
  return s;
}

/**
 * Parses expected output from JSON or delimited text formats.
 */
export function parseExpectedOutput(raw: string): SqlNormalizedResult {
  if (!raw || !raw.trim()) {
    return { columns: [], rows: [], rowCount: 0 };
  }

  const trimmed = raw.trim();

  // 1. Try parsing JSON format
  if ((trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === "object") {
        if (Array.isArray(parsed.columns) && Array.isArray(parsed.rows)) {
          return {
            columns: parsed.columns.map((c: unknown) => String(c).trim().toLowerCase()),
            rows: parsed.rows.map((r: unknown[]) => r.map(normalizeCellValue)),
            rowCount: parsed.rows.length,
          };
        }
        if (Array.isArray(parsed) && parsed.length > 0) {
          if (typeof parsed[0] === "object" && !Array.isArray(parsed[0]) && parsed[0] !== null) {
            const columns = Object.keys(parsed[0]).map((c) => c.trim().toLowerCase());
            const rows = parsed.map((obj: Record<string, unknown>) =>
              columns.map((col) => {
                // Find matching key case-insensitively
                const key = Object.keys(obj).find((k) => k.trim().toLowerCase() === col);
                return normalizeCellValue(key ? obj[key] : null);
              })
            );
            return { columns, rows, rowCount: rows.length };
          }
          if (Array.isArray(parsed[0])) {
            // Array of arrays
            const rows = (parsed as unknown[][]).map((r) => r.map(normalizeCellValue));
            return {
              columns: rows[0] ? rows[0].map((c) => String(c).trim().toLowerCase()) : [],
              rows: rows.slice(1),
              rowCount: rows.length - 1,
            };
          }
        }
      }
    } catch {
      // Fall through to plain text parsing
    }
  }

  // 2. Parse Delimited / Tabular Text
  const lines = trimmed
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !/^[-+|= ]+$/.test(l)); // filter separator lines like +---+---+

  if (lines.length === 0) {
    return { columns: [], rows: [], rowCount: 0 };
  }

  // Determine delimiter: pipe |, tab \t, comma ,, or whitespace
  const firstLine = lines[0];
  let delimiter: string | RegExp = /\s+/;
  if (firstLine.includes("|")) {
    delimiter = "|";
  } else if (firstLine.includes("\t")) {
    delimiter = "\t";
  } else if (firstLine.includes(",") && !firstLine.includes(" ")) {
    delimiter = ",";
  }

  const splitLine = (l: string): string[] => {
    if (delimiter === "|") {
      return l
        .split("|")
        .map((p) => p.trim())
        .filter((_, idx, arr) => !(idx === 0 && arr[0] === "") && !(idx === arr.length - 1 && arr[arr.length - 1] === ""));
    }
    if (delimiter instanceof RegExp) {
      return l.split(delimiter).map((p) => p.trim());
    }
    return l.split(delimiter).map((p) => p.trim());
  };

  const parsedHeader = splitLine(lines[0]);
  const columns = parsedHeader.map((c) => c.toLowerCase());
  const rows = lines.slice(1).map((line) => {
    const parts = splitLine(line);
    return parts.map(normalizeCellValue);
  });

  return { columns, rows, rowCount: rows.length };
}

/**
 * Deterministically formats columns and rows into an ASCII table.
 */
export function formatSqlTable(columns: string[], rows: (string | number | null)[][]): string {
  if (columns.length === 0 && rows.length === 0) {
    return "(empty set)";
  }

  const headers = columns.length > 0 ? columns : (rows[0] || []).map((_, i) => `col_${i + 1}`);
  const colWidths = headers.map((h) => h.length);

  for (const row of rows) {
    row.forEach((val, colIdx) => {
      const s = val === null ? "NULL" : String(val);
      if (colIdx < colWidths.length) {
        colWidths[colIdx] = Math.max(colWidths[colIdx], s.length);
      }
    });
  }

  const formatRow = (values: (string | number | null)[]) => {
    return values
      .map((val, idx) => {
        const s = val === null ? "NULL" : String(val);
        const w = colWidths[idx] || s.length;
        return s.padEnd(w);
      })
      .join("    ");
  };

  const headerLine = formatRow(headers);
  const separatorLine = colWidths.map((w) => "-".repeat(w)).join("    ");
  const dataLines = rows.map((r) => formatRow(r)).join("\n");

  return `${headerLine}\n${separatorLine}\n${dataLines}`.trim();
}

/**
 * Compares actual SQL query output with expected output.
 * If orderSensitive is true: strict index-by-index row equality.
 * If orderSensitive is false: multiset (bag of rows) equality.
 */
export function compareSqlResults(
  actual: SqlNormalizedResult,
  expected: SqlNormalizedResult,
  orderSensitive = true
): { matches: boolean; reason?: string } {
  // 1. Column count check
  if (actual.columns.length !== expected.columns.length) {
    return {
      matches: false,
      reason: `Column count mismatch: expected ${expected.columns.length}, received ${actual.columns.length}.`,
    };
  }

  // 2. Row count check
  if (actual.rows.length !== expected.rows.length) {
    return {
      matches: false,
      reason: `Row count mismatch: expected ${expected.rows.length} rows, received ${actual.rows.length} rows.`,
    };
  }

  // 3. Row contents comparison
  if (orderSensitive) {
    for (let i = 0; i < actual.rows.length; i++) {
      const actRow = actual.rows[i];
      const expRow = expected.rows[i];
      for (let j = 0; j < actRow.length; j++) {
        const aVal = actRow[j];
        const eVal = expRow[j];
        if (aVal !== eVal) {
          return {
            matches: false,
            reason: `Row ${i + 1} mismatch at column '${actual.columns[j]}': expected '${eVal}', received '${aVal}'.`,
          };
        }
      }
    }
    return { matches: true };
  } else {
    // Multiset / Bag comparison (order-insensitive)
    const rowToKey = (row: (string | number | null)[]) =>
      JSON.stringify(row.map((v) => (v === null ? "__SQL_NULL__" : v)));

    const expectedBag = new Map<string, number>();
    for (const r of expected.rows) {
      const k = rowToKey(r);
      expectedBag.set(k, (expectedBag.get(k) || 0) + 1);
    }

    const actualBag = new Map<string, number>();
    for (const r of actual.rows) {
      const k = rowToKey(r);
      actualBag.set(k, (actualBag.get(k) || 0) + 1);
    }

    if (expectedBag.size !== actualBag.size) {
      return { matches: false, reason: "Distinct row contents do not match." };
    }

    for (const [key, count] of expectedBag.entries()) {
      const actCount = actualBag.get(key) || 0;
      if (actCount !== count) {
        return {
          matches: false,
          reason: `Row occurrence count mismatch for row values: expected count ${count}, found ${actCount}.`,
        };
      }
    }

    return { matches: true };
  }
}

/**
 * Validates untrusted student SQL for security violations.
 */
export function checkSqlSecurity(query: string): string | null {
  if (Buffer.byteLength(query, "utf-8") > JUDGE_RESOURCE_LIMITS.MAX_SOURCE_CODE_BYTES) {
    return "Query size exceeds maximum allowed limit (64 KB).";
  }

  // Disallow SQLite dangerous features and host access
  const forbiddenPatterns: { regex: RegExp; message: string }[] = [
    { regex: /\bATTACH\b/i, message: "Restricted command: ATTACH DATABASE is forbidden." },
    { regex: /\bDETACH\b/i, message: "Restricted command: DETACH DATABASE is forbidden." },
    { regex: /\bload_extension\b/i, message: "Restricted command: load_extension is forbidden." },
    { regex: /\bPRAGMA\b/i, message: "Restricted command: PRAGMA commands are forbidden." },
    { regex: /\breadfile\b/i, message: "Restricted function: readfile is forbidden." },
    { regex: /\bwritefile\b/i, message: "Restricted function: writefile is forbidden." },
    { regex: /\bedit\b/i, message: "Restricted command: edit is forbidden." },
    { regex: /\.\.\//i, message: "Filesystem path traversal is forbidden." },
    { regex: /\/etc\//i, message: "Host filesystem access is forbidden." },
    { regex: /C:\\Windows/i, message: "Host filesystem access is forbidden." },
  ];

  for (const { regex, message } of forbiddenPatterns) {
    if (regex.test(query)) {
      return `Security Violation: ${message}`;
    }
  }

  return null;
}

export interface SqlExecutionResult {
  verdict: CodingVerdict;
  execution_time_ms: number;
  actual_output: string;
  columns?: string[];
  rows?: (string | number | null)[][];
  row_count: number;
  error?: string;
  passed: boolean;
}

/**
 * Executes a single test case query in a freshly created isolated SQLite database.
 * The database is ALWAYS cleaned up and destroyed in finally.
 */
export async function executeSingleSqlTestCase(params: {
  jobId: string;
  schemaSql: string;
  sampleDataSql?: string;
  setupSql?: string;
  studentQuery: string;
  expectedOutput: string;
  orderSensitive?: boolean;
  timeLimitMs?: number;
}): Promise<SqlExecutionResult> {
  const timeLimitMs = Math.min(
    params.timeLimitMs || JUDGE_RESOURCE_LIMITS.DEFAULT_TIME_LIMIT_MS,
    JUDGE_RESOURCE_LIMITS.MAX_TIME_LIMIT_MS
  );

  const securityErr = checkSqlSecurity(params.studentQuery);
  if (securityErr) {
    return {
      verdict: "Runtime Error",
      execution_time_ms: 0,
      actual_output: "",
      row_count: 0,
      error: securityErr,
      passed: false,
    };
  }

  if (!DatabaseSyncClass) {
    return {
      verdict: "SYSTEM_ERROR",
      execution_time_ms: 0,
      actual_output: "",
      row_count: 0,
      error: "SQLite runtime (node:sqlite) is not available in the current environment.",
      passed: false,
    };
  }

  // Ensure isolated temp directory exists
  const tempDir = path.join(os.tmpdir(), "smartzero-sql");
  try {
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
  } catch {
    // Directory might already exist
  }

  const uniqueDbName = `${params.jobId}-${Math.random().toString(36).slice(2, 8)}.db`;
  const dbPath = path.join(tempDir, uniqueDbName);

  let db: InstanceType<typeof DatabaseSyncType> | null = null;
  const startTime = process.hrtime.bigint();

  try {
    db = new DatabaseSyncClass(dbPath);

    // Hardened safety controls
    db.exec("PRAGMA busy_timeout = 2000;");
    db.exec("PRAGMA max_page_count = 5000;"); // Limit DB size to ~20MB max

    // 1. Execute schema DDL
    if (params.schemaSql && params.schemaSql.trim()) {
      db.exec(params.schemaSql);
    }

    // 2. Execute question base sample/seed data DML
    if (params.sampleDataSql && params.sampleDataSql.trim()) {
      db.exec(params.sampleDataSql);
    }

    // 3. Execute test case setup / seed DML
    if (params.setupSql && params.setupSql.trim()) {
      db.exec(params.setupSql);
    }

    // 3. Execute student query
    const trimmedQuery = params.studentQuery.trim().replace(/;+\s*$/, "");
    if (!trimmedQuery) {
      return {
        verdict: "Runtime Error",
        execution_time_ms: 0,
        actual_output: "",
        row_count: 0,
        error: "Query cannot be empty.",
        passed: false,
      };
    }

    // Check if query is a SELECT statement or DML
    const isSelect = /^\s*(SELECT|WITH)\b/i.test(trimmedQuery);
    let rawRows: Record<string, unknown>[] = [];

    if (isSelect) {
      const stmt = db.prepare(trimmedQuery);
      rawRows = stmt.all() as Record<string, unknown>[];
    } else {
      // DML (INSERT, UPDATE, DELETE)
      db.exec(trimmedQuery);
      // For DML, return affected rows or state
      rawRows = [];
    }

    const elapsedMs = Math.round(Number(process.hrtime.bigint() - startTime) / 1_000_000);

    if (elapsedMs > timeLimitMs) {
      return {
        verdict: "TLE",
        execution_time_ms: elapsedMs,
        actual_output: "",
        row_count: rawRows.length,
        error: `Execution timed out (${elapsedMs} ms > ${timeLimitMs} ms).`,
        passed: false,
      };
    }

    // Extract columns and normalize rows (cap rows to 1000)
    const cappedRows = rawRows.slice(0, 1000);
    const columns = cappedRows.length > 0
      ? Object.keys(cappedRows[0]).map((c) => c.toLowerCase())
      : [];

    const normalizedRows: (string | number | null)[][] = cappedRows.map((r) =>
      columns.map((col) => {
        const key = Object.keys(r).find((k) => k.toLowerCase() === col);
        return normalizeCellValue(key ? r[key] : null);
      })
    );

    const actualResult: SqlNormalizedResult = {
      columns,
      rows: normalizedRows,
      rowCount: cappedRows.length,
    };

    const formattedOutput = formatSqlTable(columns, normalizedRows);

    // 4. Compare with expected output
    const expected = parseExpectedOutput(params.expectedOutput);
    const comparison = compareSqlResults(
      actualResult,
      expected,
      params.orderSensitive ?? false
    );

    const passed = comparison.matches;
    const verdict: CodingVerdict = passed ? "Accepted" : "Wrong Answer";

    return {
      verdict,
      execution_time_ms: elapsedMs,
      actual_output: formattedOutput,
      columns,
      rows: normalizedRows,
      row_count: cappedRows.length,
      error: comparison.matches ? undefined : comparison.reason,
      passed,
    };
  } catch (err: unknown) {
    const elapsedMs = Math.round(Number(process.hrtime.bigint() - startTime) / 1_000_000);
    const rawMsg = err instanceof Error ? err.message : String(err);
    // Sanitize error message to prevent leaking internal database paths
    const sanitizedMsg = rawMsg.replace(new RegExp(tempDir.replace(/\\/g, "\\\\"), "g"), "/tmp/smartzero-sql");

    return {
      verdict: "Runtime Error",
      execution_time_ms: elapsedMs,
      actual_output: "",
      row_count: 0,
      error: `SQL Error: ${sanitizedMsg}`,
      passed: false,
    };
  } finally {
    // 5. CRITICAL CLEANUP: Ensure DB connection is closed and temp DB file deleted
    if (db) {
      try {
        db.close();
      } catch {
        // Ignore close errors
      }
    }
    // Delete database file and any SQLite WAL/journal files
    const filesToClean = [dbPath, `${dbPath}-wal`, `${dbPath}-shm`, `${dbPath}-journal`];
    for (const f of filesToClean) {
      try {
        if (fs.existsSync(f)) {
          fs.unlinkSync(f);
        }
      } catch {
        // Non-blocking cleanup
      }
    }
  }
}

/**
 * Executes a full suite of test cases for an SQL submission or run job.
 * Enforces zero-leakage masking of hidden test cases.
 */
export async function executeSqlTestCases(params: {
  jobId: string;
  sourceCode: string;
  testCases: JudgeTestCase[];
  schemaSql?: string;
  sampleDataSql?: string;
  orderSensitive?: boolean;
  timeLimitMs?: number;
  totalMarks?: number;
  executionMode?: "run" | "submit";
}): Promise<JudgeExecutionSummary> {
  const totalMarks = params.totalMarks !== undefined ? params.totalMarks : 20;
  const timeLimitMs = params.timeLimitMs || 2000;
  const testCases = params.testCases || [];

  const testCaseResults: TestCaseVerdictResult[] = [];
  let totalWeight = 0;
  let passedWeight = 0;
  let testCasesPassed = 0;
  let maxTimeMs = 0;
  let hasRuntimeError = false;
  let hasTle = false;
  let hasSystemError = false;
  let compileOutput = "";

  for (let idx = 0; idx < testCases.length; idx++) {
    const tc = testCases[idx];
    const weight = tc.weight || 1;
    totalWeight += weight;

    // Resolve schema SQL & sample data SQL from question or test case
    const schemaSql = tc.schema_sql || params.schemaSql || "";
    const sampleDataSql = tc.sample_data_sql || params.sampleDataSql || "";
    const setupSql = tc.setup_sql || tc.input || "";
    const orderSensitive = tc.order_sensitive ?? params.orderSensitive ?? false;

    const execRes = await executeSingleSqlTestCase({
      jobId: `${params.jobId}-tc${idx + 1}`,
      schemaSql,
      sampleDataSql,
      setupSql,
      studentQuery: params.sourceCode,
      expectedOutput: tc.expected_output,
      orderSensitive,
      timeLimitMs,
    });

    maxTimeMs = Math.max(maxTimeMs, execRes.execution_time_ms);

    if (execRes.verdict === "SYSTEM_ERROR") {
      hasSystemError = true;
      compileOutput = execRes.error || "SYSTEM_ERROR";
      testCaseResults.push({
        test_case_id: tc.id,
        verdict: "SYSTEM_ERROR",
        execution_time_ms: execRes.execution_time_ms,
        is_sample: tc.is_sample,
        error: execRes.error,
      });
      break;
    }

    if (execRes.passed) {
      testCasesPassed++;
      passedWeight += weight;
    } else {
      if (execRes.verdict === "Runtime Error") hasRuntimeError = true;
      if (execRes.verdict === "TLE") hasTle = true;
    }

    // Build verdict result adhering to zero-leakage of hidden tests
    const verdictItem: TestCaseVerdictResult = {
      test_case_id: tc.id,
      verdict: execRes.verdict,
      execution_time_ms: execRes.execution_time_ms,
      is_sample: tc.is_sample,
    };

    if (tc.is_sample) {
      verdictItem.input = tc.input || setupSql;
      verdictItem.expected_output = tc.expected_output;
      verdictItem.actual_output = execRes.actual_output;
      verdictItem.error = execRes.error;
      verdictItem.columns = execRes.columns;
      verdictItem.rows = execRes.rows;
      verdictItem.row_count = execRes.row_count;
    }

    testCaseResults.push(verdictItem);
  }

  // Calculate score
  const score = hasSystemError
    ? 0
    : params.executionMode === "run"
    ? 0
    : totalWeight > 0
    ? Math.round((passedWeight / totalWeight) * totalMarks)
    : 0;

  // Determine overall verdict
  let overallVerdict: CodingVerdict = "Wrong Answer";
  if (hasSystemError) {
    overallVerdict = "SYSTEM_ERROR";
  } else if (testCasesPassed === testCases.length && testCases.length > 0) {
    overallVerdict = "Accepted";
  } else if (testCasesPassed > 0) {
    overallVerdict = "Partial Accepted";
  } else if (hasTle) {
    overallVerdict = "TLE";
  } else if (hasRuntimeError) {
    overallVerdict = "Runtime Error";
  } else {
    overallVerdict = "Wrong Answer";
  }

  return {
    verdict: overallVerdict,
    score,
    test_cases_passed: testCasesPassed,
    total_test_cases: testCases.length,
    execution_time_ms: maxTimeMs,
    memory_kb: 0,
    compile_output: compileOutput,
    test_case_results: testCaseResults,
  };
}
