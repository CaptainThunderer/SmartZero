import assert from "node:assert/strict";
import * as fs from "node:fs";
import { parseRawFile, validateImportQuestions, detectFormat } from "../lib/contest/importer";
import { sanitizeQuestionForStudent } from "../lib/contest/service";
import { defaultJudgeWorker } from "../lib/judge/worker/worker";
import { executeSingleSqlTestCase } from "../lib/judge/sqlEngine";
import type { ContestQuestion } from "../types/contest";

console.log("==================================================");
console.log("▶ RUNNING TEMPLATE CONSISTENCY AUDIT & VALIDATION");
console.log("==================================================\n");

let passed = 0;
function testAssert(cond: boolean, msg: string) {
  assert(cond, msg);
  console.log(`  ✅ ${msg}`);
  passed++;
}

async function runAudit() {
  const templateFiles = [
    { path: "examples/import/example_questions.json", format: "json" as const },
    { path: "public/templates/smartzero_questions_template.json", format: "json" as const },
    { path: "examples/import/example_questions.csv", format: "csv" as const },
    { path: "public/templates/smartzero_questions_template.csv", format: "csv" as const },
    { path: "examples/import/example_questions.xlsx", format: "xlsx" as const },
    { path: "public/templates/smartzero_questions_template.xlsx", format: "xlsx" as const },
  ];

  // ── 1. Parse and Validate All Template Files ──
  console.log("── 1. Importer Validation on All Templates ──");
  for (const item of templateFiles) {
    testAssert(fs.existsSync(item.path), `Template file exists: ${item.path}`);
    testAssert(detectFormat(item.path) === item.format, `Format detected correctly as ${item.format}`);

    const buffer = fs.readFileSync(item.path);
    const rawRows = parseRawFile(item.format, buffer);
    testAssert(rawRows.length === 5, `${item.path} parses exactly 5 raw rows`);

    const result = validateImportQuestions(rawRows, item.format);
    testAssert(result.errors.length === 0, `${item.path} produces 0 validation errors`);
    testAssert(result.validQuestions.length === 5, `${item.path} produces 5 valid questions`);

    const mcqs = result.validQuestions.filter((q) => q.type === "mcq");
    const codings = result.validQuestions.filter((q) => q.type === "coding");
    const sqls = result.validQuestions.filter((q) => q.type === "sql");

    testAssert(mcqs.length === 3, `${item.path} contains exactly 3 MCQs`);
    testAssert(codings.length === 1, `${item.path} contains exactly 1 Coding question`);
    testAssert(sqls.length === 1, `${item.path} contains exactly 1 SQL question`);
  }

  // ── 2. Equivalence Check Between JSON and CSV ──
  console.log("\n── 2. Equivalence Check: JSON vs CSV ──");
  const jsonBuf = fs.readFileSync("examples/import/example_questions.json");
  const csvBuf = fs.readFileSync("examples/import/example_questions.csv");

  const jsonResult = validateImportQuestions(parseRawFile("json", jsonBuf), "json");
  const csvResult = validateImportQuestions(parseRawFile("csv", csvBuf), "csv");

  for (let i = 0; i < 5; i++) {
    const qJson = jsonResult.validQuestions[i];
    const qCsv = csvResult.validQuestions[i];

    testAssert(qJson.type === qCsv.type, `Question ${i + 1} types match (${qJson.type})`);
    testAssert(qJson.marks === qCsv.marks, `Question ${i + 1} marks match (${qJson.marks})`);
    testAssert(qJson.difficulty === qCsv.difficulty, `Question ${i + 1} difficulty matches (${qJson.difficulty})`);

    if (qJson.type === "mcq" && qCsv.type === "mcq") {
      testAssert(qJson.question_text === qCsv.question_text, `MCQ ${i + 1} question_text matches`);
      testAssert(qJson.options.length === qCsv.options.length, `MCQ ${i + 1} options count matches`);
      const correctJson = qJson.options.findIndex((o) => o.is_correct);
      const correctCsv = qCsv.options.findIndex((o) => o.is_correct);
      testAssert(correctJson === correctCsv, `MCQ ${i + 1} correct answer index matches`);
    }

    if (qJson.type === "coding" && qCsv.type === "coding") {
      testAssert(qJson.title === qCsv.title, `Coding title matches`);
      testAssert(qJson.test_cases.length === qCsv.test_cases.length, `Coding test cases count matches (2)`);
      testAssert(qJson.test_cases[0].is_sample === true, `Coding test case 0 is sample`);
      testAssert(qJson.test_cases[1].is_hidden === true, `Coding test case 1 is hidden`);
      testAssert(qJson.test_cases[0].weight === 1, `Coding test case 0 weight is 1`);
      testAssert(qJson.test_cases[1].weight === 2, `Coding test case 1 weight is 2`);
    }

    if (qJson.type === "sql" && qCsv.type === "sql") {
      testAssert(qJson.title === qCsv.title, `SQL title matches`);
      testAssert(qJson.schema_sql === qCsv.schema_sql, `SQL schema matches`);
      testAssert(qJson.order_sensitive === true, `SQL order_sensitive is true`);
      testAssert(qCsv.order_sensitive === true, `CSV SQL order_sensitive is true`);
      testAssert(qJson.test_cases.length === qCsv.test_cases.length, `SQL test cases count matches`);
      testAssert(qJson.test_cases[0].is_sample === true, `SQL test case 0 is sample`);
      testAssert(qJson.test_cases[1].is_hidden === true, `SQL test case 1 is hidden`);
      testAssert(qJson.test_cases[0].weight === 1, `SQL test case 0 weight is 1`);
      testAssert(qJson.test_cases[1].weight === 2, `SQL test case 1 weight is 2`);
    }
  }

  // ── 3. Reference Solutions and Judge Verification ──
  console.log("\n── 3. Reference Solutions and Judge Verification ──");
  const codingQ = jsonResult.validQuestions.find((q) => q.type === "coding");
  assert(codingQ && codingQ.type === "coding");

  const pySolution = `
n = int(input())
arr = list(map(int, input().split()))
avg = sum(arr) / len(arr)
ans = sum(x for x in arr if x > avg)
print(ans)
`.trim();

  for (let i = 0; i < codingQ.test_cases.length; i++) {
    const tc = codingQ.test_cases[i];
    const res = await defaultJudgeWorker.executeTestCases({
      code: pySolution,
      language: "python",
      timeLimitMs: 2000,
      memoryLimitMb: 256,
      testCases: [
        {
          id: `tc-${i}`,
          input: tc.input,
          expected_output: tc.expected_output,
          is_sample: tc.is_sample ?? false,
          is_hidden: tc.is_hidden ?? true,
          weight: tc.weight ?? 1,
          setup_sql: "",
        },
      ],
    });
    const tcResult = res.test_case_results?.[0];
    testAssert(tcResult?.verdict === "Accepted", `Python TC ${i + 1} (${tc.is_sample ? "Sample" : "Hidden"}) verdict is Accepted`);
  }

  const sqlQ = jsonResult.validQuestions.find((q) => q.type === "sql");
  assert(sqlQ && sqlQ.type === "sql");

  const sqlSolution = `
SELECT name, price
FROM products
WHERE price > 50
ORDER BY price DESC;
`.trim();

  for (let i = 0; i < sqlQ.test_cases.length; i++) {
    const tc = sqlQ.test_cases[i];
    const res = await executeSingleSqlTestCase({
      jobId: `audit-sql-${i}`,
      schemaSql: sqlQ.schema_sql,
      sampleDataSql: sqlQ.sample_data_sql,
      setupSql: tc.setup_sql,
      studentQuery: sqlSolution,
      expectedOutput: tc.expected_output,
      orderSensitive: sqlQ.order_sensitive,
    });
    testAssert(res.verdict === "Accepted", `SQL TC ${i + 1} (${tc.is_sample ? "Sample" : "Hidden"}) verdict is Accepted`);
  }

  // ── 4. Student Sanitization (Zero-Leakage) ──
  console.log("\n── 4. Student Sanitization (Zero-Leakage) ──");
  for (const validQ of jsonResult.validQuestions) {
    const mockCq: ContestQuestion = {
      id: `cq-${validQ.type}`,
      contest_id: "test-contest",
      question_id: `q-${validQ.type}`,
      question_type: validQ.type,
      sort_order: 0,
      marks: validQ.marks,
      negative_marks: (validQ as any).negative_marks || 0,
      created_at: new Date().toISOString(),
      question_text: (validQ as any).question_text,
      prompt: (validQ as any).question_text,
      options: (validQ as any).options,
      mcq_details: validQ.type === "mcq" ? {
        id: "q-mcq",
        question_text: validQ.question_text,
        explanation: validQ.explanation,
        difficulty: validQ.difficulty || "Medium",
        options: validQ.options.map((opt, idx) => ({
          id: `opt-${idx}`,
          question_id: "q-mcq",
          option_text: opt.option_text,
          is_correct: opt.is_correct,
          sort_order: idx,
        })),
      } : undefined,
      coding_details: validQ.type === "coding" ? {
        id: "q-coding",
        title: validQ.title,
        description: validQ.description,
        input_format: validQ.input_format || "",
        output_format: validQ.output_format || "",
        constraints: validQ.constraints || "",
        difficulty: validQ.difficulty || "Medium",
        time_limit_ms: validQ.time_limit_ms || 2000,
        memory_limit_mb: validQ.memory_limit_mb || 256,
        test_cases: validQ.test_cases.map((tc, idx) => ({
          id: `tc-${idx}`,
          question_id: "q-coding",
          input: tc.input,
          expected_output: tc.expected_output,
          is_sample: tc.is_sample ?? false,
          is_hidden: tc.is_hidden ?? true,
          weight: tc.weight ?? 1,
          sort_order: idx,
        })),
      } : undefined,
      sql_details: validQ.type === "sql" ? {
        id: "q-sql",
        title: validQ.title,
        description: validQ.description,
        difficulty: validQ.difficulty || "Medium",
        time_limit_ms: validQ.time_limit_ms || 2000,
        schema_sql: validQ.schema_sql,
        sample_data_sql: validQ.sample_data_sql,
        sample_expected_output: validQ.sample_expected_output,
        order_sensitive: validQ.order_sensitive,
        test_cases: validQ.test_cases.map((tc, idx) => ({
          id: `tc-${idx}`,
          question_id: "q-sql",
          setup_sql: tc.setup_sql || "",
          expected_output: tc.expected_output,
          is_sample: tc.is_sample ?? false,
          is_hidden: tc.is_hidden ?? true,
          weight: tc.weight ?? 1,
          sort_order: idx,
        })),
      } : undefined,
    };

    const sanitized = sanitizeQuestionForStudent(mockCq);

    if (validQ.type === "mcq") {
      testAssert(sanitized.mcq_details?.explanation === undefined, "MCQ explanation stripped for student");
      const hasIsCorrect = sanitized.mcq_details?.options?.some((o: any) => o.is_correct !== undefined);
      testAssert(!hasIsCorrect, "MCQ is_correct stripped for student");
      const topHasIsCorrect = (sanitized.options as any[])?.some((o: any) => o.is_correct !== undefined);
      testAssert(!topHasIsCorrect, "MCQ top-level options is_correct stripped for student");
    }

    if (validQ.type === "coding") {
      const studentTcs = sanitized.coding_details?.test_cases || [];
      testAssert(studentTcs.length === 1, "Coding questions return only sample test case (1 of 2)");
      testAssert(studentTcs[0].is_sample === true, "Returned test case is sample");
      testAssert(studentTcs[0].is_hidden === false, "Returned test case is not hidden");
    }

    if (validQ.type === "sql") {
      const studentTcs = sanitized.sql_details?.test_cases || [];
      testAssert(studentTcs.length === 1, "SQL questions return only sample test case (1 of 2)");
      testAssert(studentTcs[0].is_sample === true, "Returned SQL test case is sample");
      testAssert(studentTcs[0].is_hidden === false, "Returned SQL test case is not hidden");
    }
  }

  console.log("\n==================================================");
  console.log(`🎉 ALL ${passed} TEMPLATE CONSISTENCY AUDIT ASSERTIONS PASSED!`);
  console.log("==================================================\n");
}

runAudit().catch((err) => {
  console.error("Audit failed:", err);
  process.exit(1);
});
