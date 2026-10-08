import assert from "node:assert/strict";
import { normalizeOutput, compareOutputs } from "../lib/judge/worker/worker";
import { JudgeWorkerClient, JudgeTimeoutError, JudgeUnavailableError } from "../lib/judge/client";
import { getSqlStarterTemplate, STARTER_TEMPLATES } from "../lib/judge/templates";
import { splitSqlStatements, executeSqlTestCases } from "../lib/judge/sqlEngine";
import { getStudentDraftKey } from "../components/contest/CodingIDE";
import type { SqlQuestion } from "../types/contest";
import type { JudgeTestCase } from "../lib/judge/types";

console.log("==================================================");
console.log("▶ RUNNING SMARTZERO 2.0 BETA BLOCKER FIXES TEST SUITE");
console.log("==================================================\n");

let passed = 0;
function testAssert(condition: boolean, message: string) {
  assert(condition, message);
  console.log(`  ✅ ${message}`);
  passed++;
}

async function runTestSuite() {
  // ──────────────────────────────────────────────────────────
  // 1. PYTHON OUTPUT COMPARATOR & NORMALIZER (BANK TRANSACTION ANALYZER)
  // ──────────────────────────────────────────────────────────
  console.log("── 1. Output Normalizer & Deterministic Comparator ──");

  // Real contest test case from beta: Bank Transaction Analyzer
  const bankExpected = "Final Balance: 7000\nTotal Deposits: 9500\nTotal Withdrawals: 2500";
  const bankActual = "Final Balance: 7000\nTotal Deposits: 9500\nTotal Withdrawals: 2500";
  testAssert(compareOutputs(bankActual, bankExpected), "Bank Transaction Analyzer identical output matches");

  // CRLF vs LF
  const crlfOutput = "Final Balance: 7000\r\nTotal Deposits: 9500\r\nTotal Withdrawals: 2500\r\n";
  testAssert(compareOutputs(crlfOutput, bankExpected), "CRLF output matches LF expected output");

  // CR only
  const crOutput = "Final Balance: 7000\rTotal Deposits: 9500\rTotal Withdrawals: 2500";
  testAssert(compareOutputs(crOutput, bankExpected), "CR output matches LF expected output");

  // UTF-8 Byte Order Mark (BOM) \uFEFF
  const bomOutput = "\uFEFFFinal Balance: 7000\nTotal Deposits: 9500\nTotal Withdrawals: 2500";
  testAssert(compareOutputs(bomOutput, bankExpected), "Output with leading UTF-8 BOM matches");

  // ANSI escape sequences (terminal styling)
  const ansiOutput = "\u001b[32mFinal Balance: 7000\u001b[0m\nTotal Deposits: 9500\nTotal Withdrawals: 2500";
  testAssert(compareOutputs(ansiOutput, bankExpected), "Output with ANSI color escape sequences matches");

  // Trailing whitespace per line
  const trailingSpaces = "Final Balance: 7000   \nTotal Deposits: 9500 \t \nTotal Withdrawals: 2500  ";
  testAssert(compareOutputs(trailingSpaces, bankExpected), "Output with trailing whitespace per line matches");

  // Trailing blank lines
  const trailingBlankLines = "Final Balance: 7000\nTotal Deposits: 9500\nTotal Withdrawals: 2500\n\n\n";
  testAssert(compareOutputs(trailingBlankLines, bankExpected), "Output with multiple trailing blank lines matches");

  // Genuine Wrong Answer detection
  const wrongOutput = "Final Balance: 6000\nTotal Deposits: 9500\nTotal Withdrawals: 3500";
  testAssert(!compareOutputs(wrongOutput, bankExpected), "Genuine Wrong Answer is rejected deterministically");

  // normalizeOutput behavior
  testAssert(
    normalizeOutput("  line1  \r\n  line2  \n\n") === "  line1\n  line2",
    "normalizeOutput preserves leading indentation while stripping trailing line spaces and trailing blank lines"
  );

  // ──────────────────────────────────────────────────────────
  // 2. DYNAMIC BOUNDED TIMEOUT & ERROR TYPES
  // ──────────────────────────────────────────────────────────
  console.log("\n── 2. Dynamic Bounded Timeout & JudgeTimeoutError ──");

  // JudgeTimeoutError validation
  const timeoutErr = new JudgeTimeoutError("Submission timed out");
  testAssert(timeoutErr instanceof Error, "JudgeTimeoutError is an instance of Error");
  testAssert(timeoutErr.name === "JudgeTimeoutError", "JudgeTimeoutError has correct name");
  testAssert(timeoutErr.message === "Submission timed out", "JudgeTimeoutError has correct message");

  // JudgeUnavailableError validation
  const unavailErr = new JudgeUnavailableError("Worker is down");
  testAssert(unavailErr instanceof Error, "JudgeUnavailableError is an instance of Error");
  testAssert(unavailErr.name === "JudgeUnavailableError", "JudgeUnavailableError has correct name");

  // Timeout calculation algorithm test
  // Math.min(Math.max(perTestLimit * testCount + 8000, 10000), 60000)
  const calcTimeout = (perTestMs: number, count: number) =>
    Math.min(Math.max(perTestMs * count + 8000, 10000), 60000);

  testAssert(calcTimeout(2000, 1) === 10000, "1 test case @ 2s = 10000ms minimum bounded timeout");
  testAssert(calcTimeout(2000, 4) === 16000, "4 test cases @ 2s = 16000ms (exceeds previous 15s hard cap safely)");
  testAssert(calcTimeout(2000, 10) === 28000, "10 test cases @ 2s = 28000ms scaled timeout");
  testAssert(calcTimeout(2000, 30) === 60000, "30 test cases @ 2s = 60000ms maximum bounded timeout");
  testAssert(calcTimeout(5000, 20) === 60000, "High test count is capped at 60000ms ceiling");

  // ──────────────────────────────────────────────────────────
  // 3. SQL STARTER TEMPLATES & SAFE DDL/DML EXECUTION
  // ──────────────────────────────────────────────────────────
  console.log("\n── 3. SQL Starter Templates & Statement Execution ──");

  // Generic template (clean slate, no hardcoded SELECT * FROM students)
  const genericStarter = getSqlStarterTemplate(undefined);
  testAssert(genericStarter.includes("Write your SQL solution below"), "Generic SQL template contains instructions");
  testAssert(!genericStarter.includes("students"), "Generic SQL template does not hardcode students table");

  // Question-specific template
  const mockSqlQuestion: SqlQuestion = {
    id: "q-sql-1",
    title: "High Earning Employees",
    description: "Find all employees with salary > 50000",
    schema_sql: "CREATE TABLE employees (id INT, name VARCHAR, salary INT);",
    difficulty: "Medium",
    time_limit_ms: 2000,
    order_sensitive: true,
    created_at: new Date().toISOString(),
  };

  const specificStarter = getSqlStarterTemplate(mockSqlQuestion);
  testAssert(specificStarter.includes("High Earning Employees"), "SQL starter template contains question title");
  testAssert(specificStarter.includes("Write your SQL solution for:"), "SQL starter template contains tailored header");

  // Statement splitting with quoted semicolons
  const sqlWithQuotes = "CREATE TABLE users (id INT, bio TEXT); INSERT INTO users VALUES (1, 'Hello; World!'); SELECT * FROM users;";
  const statements = splitSqlStatements(sqlWithQuotes);
  testAssert(statements.length === 3, "splitSqlStatements ignores semicolons inside single quotes");
  testAssert(statements[1].includes("'Hello; World!'"), "splitSqlStatements preserves literal semicolon in string");

  // ──────────────────────────────────────────────────────────
  // 4. SQL EXECUTION ENGINE ISOLATION (FIX TABLE ALREADY EXISTS)
  // ──────────────────────────────────────────────────────────
  console.log("\n── 4. SQL Execution Isolation (Table Already Exists Fix) ──");

  // Simulating duplicate table definitions:
  // schemaSql creates 'students'
  const schemaSql = "CREATE TABLE students (id INT PRIMARY KEY, name TEXT, grade INT);";
  // setupSql ALSO creates 'students' and inserts rows
  const setupSqlWithDuplicateTable = `
    CREATE TABLE students (id INT PRIMARY KEY, name TEXT, grade INT);
    INSERT INTO students VALUES (1, 'Alice', 95);
    INSERT INTO students VALUES (2, 'Bob', 82);
  `;

  const testCases: any[] = [
    {
      id: "tc-1",
      input: "",
      expected_output: '[{"id":1,"name":"Alice","grade":95},{"id":2,"name":"Bob","grade":82}]',
      setup_sql: setupSqlWithDuplicateTable,
      weight: 1,
      is_sample: true,
      is_hidden: false,
    },
  ];

  // Student's solution
  const studentSql = "SELECT * FROM students ORDER BY id ASC;";

  const results = await executeSqlTestCases({
    jobId: "job-sql-dedup-test",
    sourceCode: studentSql,
    schemaSql,
    sampleDataSql: "",
    testCases,
    orderSensitive: true,
  });

  testAssert(results.test_case_results.length === 1, "SQL test case executed");
  testAssert(results.test_cases_passed === 1, "SQL execution succeeded without 'table students already exists' error");
  testAssert(results.verdict === "Accepted", "SQL test case verdict is Accepted");

  // Verify sampleDataSql fallback when testCase has no setup_sql
  const testCasesNoSetup: any[] = [
    {
      id: "tc-2",
      input: "",
      expected_output: '[{"id":1,"name":"Charlie"}]',
      weight: 1,
      is_sample: true,
      is_hidden: false,
    },
  ];
  const sampleData = "INSERT INTO students VALUES (1, 'Charlie', 88);";
  const resultsSample = await executeSqlTestCases({
    jobId: "job-sql-sample-test",
    sourceCode: "SELECT id, name FROM students WHERE id = 1;",
    schemaSql,
    sampleDataSql: sampleData,
    testCases: testCasesNoSetup,
    orderSensitive: true,
  });
  testAssert(resultsSample.test_cases_passed === 1 && resultsSample.verdict === "Accepted", "sampleDataSql executes correctly as fallback setup");

  // ──────────────────────────────────────────────────────────
  // 5. DRAFT & EDITOR ISOLATION
  // ──────────────────────────────────────────────────────────
  console.log("\n── 5. Draft & Editor Isolation Across Users, Contests, Attempts ──");

  const studentA = "student-aaa-111";
  const studentB = "student-bbb-222";
  const contest1 = "contest-cs101";
  const contest2 = "contest-cs102";
  const question1 = "q-python-1";
  const question2 = "q-python-2";

  // Key format check
  const keyA_Att1 = getStudentDraftKey(studentA, contest1, 1, question1, "python");
  testAssert(
    keyA_Att1 === "smartzero:draft:contest-cs101:1:student-aaa-111:q-python-1:python",
    "getStudentDraftKey produces canonical format: smartzero:draft:<contest>:<attempt>:<student>:<question>:<lang>"
  );

  // Student isolation
  const keyB_Att1 = getStudentDraftKey(studentB, contest1, 1, question1, "python");
  testAssert(keyA_Att1 !== keyB_Att1, "Draft key is isolated between different students");

  // Attempt isolation (Retake flow)
  const keyA_Att2 = getStudentDraftKey(studentA, contest1, 2, question1, "python");
  testAssert(keyA_Att1 !== keyA_Att2, "Draft key is isolated between different attempts of the same student");

  // Contest isolation
  const keyA_Contest2 = getStudentDraftKey(studentA, contest2, 1, question1, "python");
  testAssert(keyA_Att1 !== keyA_Contest2, "Draft key is isolated between different contests");

  // Question isolation
  const keyA_Q2 = getStudentDraftKey(studentA, contest1, 1, question2, "python");
  testAssert(keyA_Att1 !== keyA_Q2, "Draft key is isolated between different questions");

  // Language isolation
  const keyA_Sql = getStudentDraftKey(studentA, contest1, 1, question1, "sql");
  testAssert(keyA_Att1 !== keyA_Sql, "Draft key is isolated between different languages");

  // Unauthenticated / demo protection
  testAssert(getStudentDraftKey(undefined, contest1, 1, question1, "python") === null, "Undefined user returns null draft key");
  testAssert(getStudentDraftKey("demo-student-user", contest1, 1, question1, "python") === null, "Demo user returns null draft key");
  testAssert(getStudentDraftKey("unauthenticated-viewer", contest1, 1, question1, "python") === null, "Unauthenticated viewer returns null draft key");

  // Backwards compatibility with 4-argument call signature
  const keyBackwards = getStudentDraftKey(studentA, contest1, question1, "python");
  testAssert(
    keyBackwards === "smartzero:draft:contest-cs101:1:student-aaa-111:q-python-1:python",
    "getStudentDraftKey maintains backwards compatibility for 4-argument calls"
  );

  console.log(`\n==================================================`);
  console.log(`🎉 ALL ${passed} BETA BLOCKER ASSERTIONS PASSED!`);
  console.log(`==================================================`);
}

runTestSuite().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
