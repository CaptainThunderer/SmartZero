import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  normalizeCellValue,
  parseExpectedOutput,
  formatSqlTable,
  compareSqlResults,
  checkSqlSecurity,
  executeSingleSqlTestCase,
  executeSqlTestCases,
} from "../lib/judge/sqlEngine";
import {
  addSqlQuestion,
  getSqlQuestionRaw,
  linkQuestionToContest,
  getContestQuestions,
  createContest,
} from "../lib/contest/service";
import type { JudgeTestCase } from "../lib/judge/types";

console.log("==================================================");
console.log("▶ RUNNING SQL CONTEST JUDGING TEST SUITE");
console.log("==================================================\n");

let passedCount = 0;
function testAssert(condition: boolean, msg: string) {
  assert(condition, msg);
  console.log(`  ✅ ${msg}`);
  passedCount++;
}

async function runTests() {
  const schemaSql = `
    CREATE TABLE students (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      department TEXT NOT NULL,
      marks INTEGER NOT NULL
    );
    CREATE TABLE courses (
      course_id INTEGER PRIMARY KEY,
      student_id INTEGER,
      course_name TEXT NOT NULL,
      grade TEXT
    );
  `;

  const sampleDataSql = `
    INSERT INTO students VALUES
    (1, 'Sai', 'DS', 92),
    (2, 'Rahul', 'CSE', 81),
    (3, 'Anu', 'DS', 88),
    (4, 'Ravi', 'CSE', 75);

    INSERT INTO courses VALUES
    (101, 1, 'Machine Learning', 'A'),
    (102, 1, 'Data Mining', 'A'),
    (103, 2, 'Operating Systems', 'B'),
    (104, 3, 'Machine Learning', 'A');
  `;

  // ─────────────────────────────────────────────────────────────
  // 1. ENGINE QUERY CAPABILITIES
  // ─────────────────────────────────────────────────────────────
  console.log("── 1. SQL Query Engine Capabilities ──");

  // 1.1 Basic SELECT with WHERE
  const res1 = await executeSingleSqlTestCase({
    jobId: "test-query-1",
    schemaSql,
    setupSql: sampleDataSql,
    studentQuery: "SELECT name, marks FROM students WHERE marks >= 85 ORDER BY marks DESC;",
    expectedOutput: "name | marks\nSai | 92\nAnu | 88",
    orderSensitive: true,
  });
  testAssert(res1.passed && res1.verdict === "Accepted", "Basic SELECT with WHERE and ORDER BY works");
  testAssert(res1.row_count === 2, "Returns expected 2 rows");

  // 1.2 GROUP BY and HAVING with Aggregates
  const res2 = await executeSingleSqlTestCase({
    jobId: "test-query-2",
    schemaSql,
    setupSql: sampleDataSql,
    studentQuery: `
      SELECT department, COUNT(*) as cnt, AVG(marks) as avg_marks
      FROM students
      GROUP BY department
      HAVING cnt >= 2
      ORDER BY department ASC;
    `,
    expectedOutput: "department | cnt | avg_marks\nCSE | 2 | 78\nDS | 2 | 90",
    orderSensitive: true,
  });
  testAssert(res2.passed && res2.verdict === "Accepted", "GROUP BY, HAVING, and Aggregates (COUNT, AVG) work");

  // 1.3 INNER and LEFT JOIN
  const res3 = await executeSingleSqlTestCase({
    jobId: "test-query-3",
    schemaSql,
    setupSql: sampleDataSql,
    studentQuery: `
      SELECT s.name, c.course_name
      FROM students s
      LEFT JOIN courses c ON s.id = c.student_id
      WHERE s.name = 'Ravi';
    `,
    expectedOutput: "name | course_name\nRavi | NULL",
    orderSensitive: true,
  });
  testAssert(res3.passed && res3.verdict === "Accepted", "LEFT JOIN with NULL matching works");

  // 1.4 Subquery (Scalar subquery)
  const res4 = await executeSingleSqlTestCase({
    jobId: "test-query-4",
    schemaSql,
    setupSql: sampleDataSql,
    studentQuery: `
      SELECT name, marks
      FROM students
      WHERE marks > (SELECT AVG(marks) FROM students)
      ORDER BY marks DESC;
    `,
    expectedOutput: "name | marks\nSai | 92\nAnu | 88",
    orderSensitive: true,
  });
  testAssert(res4.passed && res4.verdict === "Accepted", "Scalar subquery in WHERE clause works");

  // 1.5 DML (INSERT, UPDATE, DELETE)
  const res5 = await executeSingleSqlTestCase({
    jobId: "test-query-5",
    schemaSql,
    setupSql: sampleDataSql,
    studentQuery: "DELETE FROM students WHERE id = 4;",
    expectedOutput: "",
  });
  testAssert(res5.verdict === "Accepted", "DML statement executed without runtime error");

  // ─────────────────────────────────────────────────────────────
  // 2. NORMALIZATION & COMPARISON RULES
  // ─────────────────────────────────────────────────────────────
  console.log("\n── 2. Result Normalization & Deterministic Comparison ──");

  // 2.1 Numeric representation normalization (1 vs 1.0)
  testAssert(normalizeCellValue(1) === normalizeCellValue(1.0), "Numeric normalization: 1 equals 1.0");
  testAssert(normalizeCellValue("92.000") === normalizeCellValue(92), "String numeric normalization: '92.000' equals 92");

  // 2.2 Whitespace trimming
  testAssert(normalizeCellValue("  Engineering  ") === "Engineering", "Whitespace is trimmed in cell values");

  // 2.3 Column count mismatch
  const colMismatch = compareSqlResults(
    { columns: ["id", "name"], rows: [[1, "Sai"]], rowCount: 1 },
    { columns: ["id"], rows: [[1]], rowCount: 1 }
  );
  testAssert(!colMismatch.matches && !!colMismatch.reason?.includes("Column count mismatch"), "Detects column count mismatch");

  // 2.4 Row count mismatch
  const rowMismatch = compareSqlResults(
    { columns: ["id"], rows: [[1], [2]], rowCount: 2 },
    { columns: ["id"], rows: [[1]], rowCount: 1 }
  );
  testAssert(!rowMismatch.matches && !!rowMismatch.reason?.includes("Row count mismatch"), "Detects row count mismatch");

  // 2.5 Order sensitive comparison
  const orderAct = { columns: ["name"], rows: [["Sai"], ["Anu"]], rowCount: 2 };
  const orderExp = { columns: ["name"], rows: [["Anu"], ["Sai"]], rowCount: 2 };
  const sensitiveCheck = compareSqlResults(orderAct, orderExp, true);
  testAssert(!sensitiveCheck.matches, "order_sensitive = true rejects inverted row order");

  // 2.6 Order insensitive (multiset) comparison
  const insensitiveCheck = compareSqlResults(orderAct, orderExp, false);
  testAssert(insensitiveCheck.matches, "order_sensitive = false accepts reordered rows via multiset");

  // 2.7 Multiset handles duplicates accurately
  const dupAct = { columns: ["val"], rows: [[1], [1], [2]], rowCount: 3 };
  const dupExp = { columns: ["val"], rows: [[1], [2], [2]], rowCount: 3 };
  const dupCheck = compareSqlResults(dupAct, dupExp, false);
  testAssert(!dupCheck.matches, "Multiset comparison verifies exact frequency of duplicate rows");

  // ─────────────────────────────────────────────────────────────
  // 3. SECURITY & SANDBOX CONTROLS
  // ─────────────────────────────────────────────────────────────
  console.log("\n── 3. Security & Sandbox Controls ──");

  testAssert(checkSqlSecurity("ATTACH DATABASE '/tmp/pwned.db' AS pwn;") !== null, "Blocks ATTACH DATABASE");
  testAssert(checkSqlSecurity("DETACH DATABASE pwn;") !== null, "Blocks DETACH DATABASE");
  testAssert(checkSqlSecurity("SELECT load_extension('malicious.so');") !== null, "Blocks load_extension");
  testAssert(checkSqlSecurity("PRAGMA journal_mode = WAL;") !== null, "Blocks PRAGMA statements");
  testAssert(checkSqlSecurity("SELECT * FROM '../../etc/passwd';") !== null, "Blocks path traversal");
  testAssert(checkSqlSecurity("SELECT * FROM '/etc/shadow';") !== null, "Blocks host filesystem path");

  // 3.1 Security rejection execution verdict
  const secExec = await executeSingleSqlTestCase({
    jobId: "test-sec-1",
    schemaSql,
    studentQuery: "ATTACH DATABASE 'x.db' AS bad;",
    expectedOutput: "",
  });
  testAssert(secExec.verdict === "Runtime Error" && !secExec.passed, "Forbidden security query returns Runtime Error");

  // 3.2 Temporary database cleanup verification
  const tempDir = path.join(os.tmpdir(), "smartzero-sql");
  const filesBefore = fs.existsSync(tempDir) ? fs.readdirSync(tempDir) : [];
  await executeSingleSqlTestCase({
    jobId: "test-cleanup-verify",
    schemaSql,
    setupSql: sampleDataSql,
    studentQuery: "SELECT * FROM students;",
    expectedOutput: "id | name | department | marks\n1 | Sai | DS | 92",
  });
  const filesAfter = fs.existsSync(tempDir) ? fs.readdirSync(tempDir) : [];
  testAssert(filesAfter.length <= filesBefore.length, "Temporary SQLite DB file deleted in finally block (zero dangling DBs)");

  // ─────────────────────────────────────────────────────────────
  // 4. CONTEST INTEGRATION: RUN VS. SUBMIT & MASKING
  // ─────────────────────────────────────────────────────────────
  console.log("\n── 4. Contest Run vs. Submit Semantics ──");

  const testCases: JudgeTestCase[] = [
    {
      id: "tc-sample",
      input: "",
      setup_sql: "",
      expected_output: "name | marks\nSai | 92\nAnu | 88",
      is_sample: true,
      is_hidden: false,
      weight: 1,
    },
    {
      id: "tc-hidden-1",
      input: "",
      setup_sql: "INSERT INTO students VALUES (5, 'Zack', 'IT', 95);",
      expected_output: "name | marks\nZack | 95\nSai | 92\nAnu | 88",
      is_sample: false,
      is_hidden: true,
      weight: 2,
    },
    {
      id: "tc-hidden-2",
      input: "",
      setup_sql: "INSERT INTO students VALUES (6, 'Elena', 'DS', 99);",
      expected_output: "name | marks\nElena | 99\nSai | 92\nAnu | 88",
      is_sample: false,
      is_hidden: true,
      weight: 2,
    },
  ];

  // 4.1 Run Mode: Returns sample details, awards 0 marks
  const runResult = await executeSqlTestCases({
    jobId: "contest-run-job",
    sourceCode: `
      SELECT name, marks
      FROM students
      WHERE marks > (SELECT AVG(marks) FROM students)
      ORDER BY marks DESC;
    `,
    testCases,
    schemaSql,
    sampleDataSql,
    orderSensitive: true,
    totalMarks: 20,
    executionMode: "run",
  });
  testAssert(runResult.score === 0, "Run mode strictly awards 0 marks");
  testAssert(runResult.test_case_results?.[0].columns !== undefined, "Run mode exposes sample columns for IDE table display");
  testAssert(runResult.test_case_results?.[0].rows !== undefined, "Run mode exposes sample rows for IDE table display");

  // 4.2 Submit Mode: Correct solution awards full marks
  const submitResult = await executeSqlTestCases({
    jobId: "contest-submit-job",
    sourceCode: `
      SELECT name, marks
      FROM students
      WHERE marks > (SELECT AVG(marks) FROM students)
      ORDER BY marks DESC;
    `,
    testCases,
    schemaSql,
    sampleDataSql,
    orderSensitive: true,
    totalMarks: 20,
    executionMode: "submit",
  });
  testAssert(submitResult.verdict === "Accepted", "Correct SQL query achieves Accepted verdict");
  testAssert(submitResult.score === 20, "Submit mode awards full 20 marks when all tests pass");

  // 4.3 Zero-leakage verification: Hidden test outputs masked
  const hiddenTc1 = submitResult.test_case_results?.find((tc) => tc.test_case_id === "tc-hidden-1");
  testAssert(hiddenTc1?.expected_output === undefined, "Hidden test expected_output is strictly masked");
  testAssert(hiddenTc1?.actual_output === undefined, "Hidden test actual_output is strictly masked");
  testAssert(hiddenTc1?.columns === undefined, "Hidden test columns are strictly masked");

  // 4.4 Partial scoring
  // A query that works on sample but fails on hidden test
  const partialResult = await executeSqlTestCases({
    jobId: "contest-partial-job",
    sourceCode: "SELECT 'Sai' as name, 92 as marks UNION ALL SELECT 'Anu', 88;", // Hardcoded sample query
    testCases,
    schemaSql,
    sampleDataSql,
    orderSensitive: true,
    totalMarks: 20,
    executionMode: "submit",
  });
  testAssert(partialResult.verdict === "Partial Accepted", "Hardcoded sample achieves Partial Accepted");
  testAssert(partialResult.score === 4, "Partial scoring calculated: weight 1/5 of 20 marks = 4 marks");

  // ─────────────────────────────────────────────────────────────
  // 5. SERVICE PERSISTENCE & CONTEST LINKING
  // -------------------------------------------------------------
  console.log("\n── 5. Service Persistence & Question Bank ──");

  const createdQ = await addSqlQuestion({
    title: "Find Top Performers",
    description: "Write a SQL query to find students scoring above average.",
    schema_sql: schemaSql,
    sample_data_sql: sampleDataSql,
    sample_expected_output: "name | marks\nSai | 92\nAnu | 88",
    order_sensitive: true,
    time_limit_ms: 2000,
    test_cases: [
      {
        setup_sql: "",
        expected_output: "name | marks\nSai | 92\nAnu | 88",
        is_sample: true,
        is_hidden: false,
        weight: 1,
      },
    ],
  });
  testAssert(!!createdQ.id, "SQL question persisted successfully");

  const rawQ = await getSqlQuestionRaw(createdQ.id);
  testAssert(rawQ !== null && rawQ.title === "Find Top Performers", "getSqlQuestionRaw retrieves complete definition");

  const newContest = await createContest({
    title: "SQL Contest 2026",
    start_at: new Date().toISOString(),
    end_at: new Date(Date.now() + 3600000).toISOString(),
    duration_minutes: 60,
    passcode: "SQL-PASS",
  });
  await linkQuestionToContest({
    contest_id: newContest.id,
    question_id: createdQ.id,
    question_type: "sql",
    marks: 10,
    negative_marks: 0,
    sort_order: 1,
  });

  const contestQs = await getContestQuestions(newContest.id);
  testAssert(contestQs.length === 1 && contestQs[0].question_type === "sql", "Contest retrieves linked SQL question");
  testAssert(contestQs[0].sql_details?.title === "Find Top Performers", "Question details populated on contest question");

  // ─────────────────────────────────────────────────────────────
  // 6. CONCURRENCY & PERFORMANCE BENCHMARK
  // -------------------------------------------------------------
  console.log("\n── 6. Concurrency & Performance Load Testing ──");

  async function benchmarkConcurrency(concurrencyCount: number) {
    const latencies: number[] = [];
    const promises: Promise<boolean>[] = [];

    const query = `
      SELECT department, COUNT(*) as cnt
      FROM students
      GROUP BY department
      ORDER BY department ASC;
    `;

    for (let i = 0; i < concurrencyCount; i++) {
      const p = (async () => {
        const t0 = Date.now();
        const res = await executeSingleSqlTestCase({
          jobId: `bench-${concurrencyCount}-${i}`,
          schemaSql,
          setupSql: sampleDataSql,
          studentQuery: query,
          expectedOutput: "department | cnt\nCSE | 2\nDS | 2",
          orderSensitive: true,
        });
        const lat = Date.now() - t0;
        latencies.push(lat);
        return res.passed;
      })();
      promises.push(p);
    }

    const results = await Promise.all(promises);
    const successCount = results.filter(Boolean).length;
    latencies.sort((a, b) => a - b);
    const p50 = latencies[Math.floor(latencies.length * 0.5)];
    const p95 = latencies[Math.floor(latencies.length * 0.95)];

    console.log(
      `    Concurrency ${concurrencyCount}: ${successCount}/${concurrencyCount} passed | p50: ${p50}ms | p95: ${p95}ms`
    );

    testAssert(successCount === concurrencyCount, `All ${concurrencyCount} concurrent SQL executions succeeded`);
  }

  await benchmarkConcurrency(1);
  await benchmarkConcurrency(10);
  await benchmarkConcurrency(20);
  await benchmarkConcurrency(30);

  console.log("\n==================================================");
  console.log(`🎉 ALL ${passedCount} SQL CONTEST JUDGING ASSERTIONS PASSED!`);
  console.log("==================================================\n");
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
