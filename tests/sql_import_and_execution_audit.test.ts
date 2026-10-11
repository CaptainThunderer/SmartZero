import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { parseRawFile, validateImportQuestions } from "../lib/contest/importer";
import { executeSingleSqlTestCase } from "../lib/judge/sqlEngine";
import { sanitizeQuestionForStudent, createContest, getContestQuestions } from "../lib/contest/service";
import { persistImportedQuestions } from "../lib/contest/importer";
import type { ContestQuestion } from "../types/contest";

console.log("==================================================");
console.log("▶ SMARTZERO 2.0: SQL IMPORT, EXECUTION & JUDGING AUDIT");
console.log("==================================================\n");

let passed = 0;
function testAssert(cond: boolean, msg: string) {
  assert(cond, msg);
  console.log(`  ✅ ${msg}`);
  passed++;
}

// Reference solutions for each of the 5 SQL questions
const REFERENCE_SOLUTIONS: Record<string, string> = {
  "Student Database": `
    SELECT name
    FROM Students
    WHERE marks > 80
    ORDER BY marks DESC, name ASC;
  `.trim(),

  "Employee Departments": `
    SELECT department, AVG(salary) AS average_salary
    FROM Employees
    GROUP BY department
    HAVING AVG(salary) > 40000
    ORDER BY department ASC;
  `.trim(),

  "Online Store": `
    SELECT customer_id, SUM(amount) AS total_spending
    FROM Orders
    GROUP BY customer_id
    HAVING SUM(amount) > 10000
    ORDER BY customer_id ASC;
  `.trim(),

  "Library Management": `
    SELECT b.title, a.author_name
    FROM Books b
    JOIN Authors a ON b.author_id = a.author_id
    ORDER BY b.book_id ASC;
  `.trim(),

  "Employee Search": `
    SELECT employee_id, employee_name, department, salary
    FROM Employees
    WHERE employee_name GLOB 'A*' AND salary > 30000
    ORDER BY employee_id ASC;
  `.trim(),
};

async function run() {
  const jsonPath = "C:\\Users\\VICTUS\\Downloads\\smartzero_qp_reviewed_questions.json";
  testAssert(fs.existsSync(jsonPath), `Found source questions file: ${jsonPath}`);

  const rawBuffer = fs.readFileSync(jsonPath);
  const rawRows = parseRawFile("json", rawBuffer);
  testAssert(rawRows.length === 25, `Parsed exactly 25 raw questions from reviewed JSON`);

  // ── 1. Import Validation & SQL Badge Auto-Detection ──
  console.log("\n── 1. Import Validation & SQL Badge Auto-Detection ──");
  const validationResult = validateImportQuestions(rawRows, "json");
  testAssert(validationResult.errors.length === 0, `Validation produced 0 errors`);
  testAssert(validationResult.validQuestions.length === 25, `All 25 questions successfully validated`);

  const sqlQuestions = validationResult.validQuestions.filter((q) => q.type === "sql");
  testAssert(sqlQuestions.length === 5, `Auto-detected exactly 5 SQL questions (badges display 'SQL')`);

  const expectedSqlTitles = [
    "Student Database",
    "Employee Departments",
    "Online Store",
    "Library Management",
    "Employee Search",
  ];

  for (const title of expectedSqlTitles) {
    const found = sqlQuestions.find((q) => q.title === title);
    testAssert(!!found, `SQL question '${title}' recognized with type='sql'`);
  }

  // ── 2. Verification of All 5 SQL Questions & 30 Test Cases ──
  console.log("\n── 2. Verification of All 5 SQL Questions & 30 Test Cases ──");
  let totalTestCasesTested = 0;

  for (const sqlQ of sqlQuestions) {
    if (sqlQ.type !== "sql") continue;
    console.log(`\n  Checking: ${sqlQ.title} (${sqlQ.difficulty}, ${sqlQ.marks} marks)`);
    testAssert(sqlQ.schema_sql.length > 0, `  • Schema SQL preserved: ${sqlQ.schema_sql.slice(0, 50)}...`);
    testAssert(!!sqlQ.sample_data_sql, `  • Sample data SQL preserved`);
    testAssert(!!sqlQ.sample_expected_output, `  • Sample expected output preserved: ${(sqlQ.sample_expected_output || "").replace(/\n/g, " ")}`);
    testAssert(sqlQ.test_cases.length === 6, `  • Exactly 6 test cases present`);

    const refQuery = REFERENCE_SOLUTIONS[sqlQ.title];
    assert(refQuery, `Missing reference query for ${sqlQ.title}`);

    for (let tcIdx = 0; tcIdx < sqlQ.test_cases.length; tcIdx++) {
      const tc = sqlQ.test_cases[tcIdx];
      const tcType = tc.is_sample ? "Sample" : "Hidden";

      // Execute reference solution
      const result = await executeSingleSqlTestCase({
        jobId: `audit-${sqlQ.title}-${tcIdx}`,
        schemaSql: sqlQ.schema_sql,
        sampleDataSql: sqlQ.sample_data_sql,
        setupSql: tc.setup_sql,
        studentQuery: refQuery,
        expectedOutput: tc.expected_output,
        orderSensitive: sqlQ.order_sensitive,
      });

      if (result.verdict !== "Accepted") {
        console.error(`FAILED TC ${tcIdx + 1}:`, {
          verdict: result.verdict,
          error: result.error,
          actual: result.actual_output,
          expected: tc.expected_output,
          columns: result.columns,
          rows: result.rows,
        });
      }
      testAssert(
        result.verdict === "Accepted",
        `    [TC ${tcIdx + 1}/6 ${tcType}] Reference query is Accepted (rows: ${result.row_count})`
      );
      totalTestCasesTested++;
    }

    // Deliberately incorrect query must return Wrong Answer
    const wrongResult = await executeSingleSqlTestCase({
      jobId: `audit-wrong-${sqlQ.title}`,
      schemaSql: sqlQ.schema_sql,
      sampleDataSql: sqlQ.sample_data_sql,
      setupSql: sqlQ.test_cases[0].setup_sql,
      studentQuery: "SELECT 999999 AS wrong_val;",
      expectedOutput: sqlQ.test_cases[0].expected_output,
      orderSensitive: sqlQ.order_sensitive,
    });
    testAssert(wrongResult.verdict === "Wrong Answer", `  • Deliberately incorrect query returns 'Wrong Answer'`);

    // Invalid SQL syntax must return Runtime Error without crashing
    const syntaxErrResult = await executeSingleSqlTestCase({
      jobId: `audit-syntax-${sqlQ.title}`,
      schemaSql: sqlQ.schema_sql,
      sampleDataSql: sqlQ.sample_data_sql,
      setupSql: sqlQ.test_cases[0].setup_sql,
      studentQuery: "THIS IS COMPLETELY INVALID SQL STATEMENT;",
      expectedOutput: sqlQ.test_cases[0].expected_output,
      orderSensitive: sqlQ.order_sensitive,
    });
    testAssert(syntaxErrResult.verdict === "Runtime Error", `  • Invalid SQL syntax trapped safely as 'Runtime Error'`);

    // Security sandbox check: Forbidden ATTACH DATABASE blocked
    const forbiddenResult = await executeSingleSqlTestCase({
      jobId: `audit-security-${sqlQ.title}`,
      schemaSql: sqlQ.schema_sql,
      sampleDataSql: sqlQ.sample_data_sql,
      setupSql: sqlQ.test_cases[0].setup_sql,
      studentQuery: "ATTACH DATABASE 'test.db' AS evil;",
      expectedOutput: sqlQ.test_cases[0].expected_output,
      orderSensitive: sqlQ.order_sensitive,
    });
    testAssert(forbiddenResult.verdict === "Runtime Error", `  • Security violation (ATTACH DATABASE) blocked cleanly`);
  }

  testAssert(totalTestCasesTested === 30, `All 30 SQL test cases passed with Accepted verdict`);

  // ── 3. Test-Case Isolation & Fresh Database Verification ──
  console.log("\n── 3. Test-Case Isolation & Clean Database Lifecycle ──");
  const studentDbQ = sqlQuestions.find((q) => q.title === "Student Database");
  assert(studentDbQ && studentDbQ.type === "sql");

  // Run TC 1 (Rahul, Kiran)
  const res1 = await executeSingleSqlTestCase({
    jobId: "iso-1",
    schemaSql: studentDbQ.schema_sql,
    setupSql: studentDbQ.test_cases[0].setup_sql,
    studentQuery: REFERENCE_SOLUTIONS["Student Database"],
    expectedOutput: studentDbQ.test_cases[0].expected_output,
    orderSensitive: studentDbQ.order_sensitive,
  });
  testAssert(res1.verdict === "Accepted", `TC 1 isolated run accepted`);

  // Run TC 2 (Srishanth, Raghavi, Phani)
  const res2 = await executeSingleSqlTestCase({
    jobId: "iso-2",
    schemaSql: studentDbQ.schema_sql,
    setupSql: studentDbQ.test_cases[1].setup_sql,
    studentQuery: REFERENCE_SOLUTIONS["Student Database"],
    expectedOutput: studentDbQ.test_cases[1].expected_output,
    orderSensitive: studentDbQ.order_sensitive,
  });
  testAssert(res2.verdict === "Accepted", `TC 2 isolated run accepted (Rahul/Kiran from TC 1 not present)`);
  testAssert(!res2.rows?.some((r) => r.includes("Rahul")), `Zero contamination: TC 1 data absent in TC 2`);

  // ── 4. Student Sanitization (Zero Hidden Test Leakage) ──
  console.log("\n── 4. Student Sanitization (Zero Hidden Test Leakage) ──");
  for (const sqlQ of sqlQuestions) {
    if (sqlQ.type !== "sql") continue;
    const mockCq: ContestQuestion = {
      id: "cq-" + sqlQ.title,
      contest_id: "test-contest",
      question_id: "q-" + sqlQ.title,
      question_type: "sql",
      sort_order: 0,
      marks: sqlQ.marks,
      negative_marks: 0,
      created_at: new Date().toISOString(),
      sql_details: {
        id: "q-" + sqlQ.title,
        title: sqlQ.title,
        description: sqlQ.description,
        difficulty: sqlQ.difficulty || "Medium",
        time_limit_ms: sqlQ.time_limit_ms || 2000,
        schema_sql: sqlQ.schema_sql,
        sample_data_sql: sqlQ.sample_data_sql,
        sample_expected_output: sqlQ.sample_expected_output,
        order_sensitive: sqlQ.order_sensitive,
        test_cases: sqlQ.test_cases.map((tc, idx) => ({
          id: `tc-${idx}`,
          question_id: "q-" + sqlQ.title,
          setup_sql: tc.setup_sql || "",
          expected_output: tc.expected_output,
          is_sample: tc.is_sample ?? false,
          is_hidden: tc.is_hidden ?? true,
          weight: tc.weight ?? 1,
          sort_order: idx,
        })),
      },
    };

    const sanitized = sanitizeQuestionForStudent(mockCq);
    const studentTcs = sanitized.sql_details?.test_cases || [];

    testAssert(studentTcs.length === 2, `${sqlQ.title}: Student receives exactly 2 public sample cases (out of 6)`);
    testAssert(studentTcs.every((tc) => tc.is_sample && !tc.is_hidden), `${sqlQ.title}: All student test cases have is_sample=true and is_hidden=false`);
  }

  // ── 5. Persistence and Linking Lifecycle ──
  console.log("\n── 5. Persistence and Linking Lifecycle ──");
  const testContest = await createContest({
    title: "SQL Audit Test Contest",
    passcode: "AUDIT-SQL",
    start_at: new Date(Date.now() + 60000).toISOString(),
    end_at: new Date(Date.now() + 3600000).toISOString(),
    duration_minutes: 60,
  });

  const persistResult = await persistImportedQuestions(testContest.id, sqlQuestions);
  testAssert(persistResult.importedCount === 5, `All 5 SQL questions persisted into test contest`);

  const linkedList = await getContestQuestions(testContest.id, "admin");
  testAssert(linkedList.length === 5, `Retrieved 5 linked questions`);
  testAssert(linkedList.every((q) => q.question_type === "sql"), `All 5 linked questions have question_type='sql'`);
  testAssert(linkedList.every((q) => !!q.sql_details), `All 5 linked questions have complete sql_details attached`);

  console.log("\n==================================================");
  console.log(`🎉 ALL ${passed} SQL AUDIT ASSERTIONS PASSED!`);
  console.log("==================================================\n");
}

run().catch((err) => {
  console.error("SQL audit failed:", err);
  process.exit(1);
});
