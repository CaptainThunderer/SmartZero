/**
 * SmartZero 2.0 — Phase 4 Question Import Engine Test Suite
 *
 * Run: npx tsx tests/question_import.test.ts
 */

import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import {
  detectFormat,
  parseRawFile,
  validateImportQuestions,
  persistImportedQuestions,
} from "../lib/contest/importer";
import { createContest, getContestQuestions } from "../lib/contest/service";

console.log("▶ Running SmartZero Phase 4 Question Import Engine Tests...\n");

let passed = 0;
function testAssert(condition: boolean, name: string) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${name}`);
  } else {
    console.error(`  ❌ FAIL: ${name}`);
    throw new Error(`Assertion failed: ${name}`);
  }
}

async function run() {
  // ── 1. Format Detection ──
  console.log("── 1. Format Detection ──");
  testAssert(detectFormat("questions.json") === "json", "Detects JSON");
  testAssert(detectFormat("quiz_export.CSV") === "csv", "Detects CSV (case-insensitive)");
  testAssert(detectFormat("question_bank.xlsx") === "xlsx", "Detects XLSX");
  testAssert(detectFormat("legacy_sheet.xls") === "xlsx", "Detects XLS");
  testAssert(detectFormat("questions.docx") === "unsupported", "Rejects unsupported format (.docx)");

  // ── 2. JSON Import Parsing & Validation ──
  console.log("\n── 2. JSON Import Parsing & Validation ──");
  const validJsonData = [
    {
      type: "mcq",
      question_text: "What is the time complexity of binary search on a sorted array of size N?",
      explanation: "Divides array in half each step.",
      marks: 2,
      negative_marks: 0.5,
      options: [
        { option_text: "O(1)", is_correct: false },
        { option_text: "O(log N)", is_correct: true },
        { option_text: "O(N)", is_correct: false },
      ],
    },
    {
      type: "coding",
      title: "Valid Anagram",
      description: "Given two strings s and t, return true if t is an anagram of s.",
      marks: 10,
      test_cases: [
        { input: "'anagram', 'nagaram'", expected_output: "true", is_sample: true, is_hidden: false },
        { input: "'rat', 'car'", expected_output: "false", is_sample: false, is_hidden: true },
      ],
    },
  ];

  const jsonBuffer = Buffer.from(JSON.stringify(validJsonData), "utf-8");
  const parsedJsonRows = parseRawFile("json", jsonBuffer);
  testAssert(parsedJsonRows.length === 2, "JSON parses 2 raw question rows");

  const jsonValidation = validateImportQuestions(parsedJsonRows, "json");
  testAssert(jsonValidation.validQuestions.length === 2, "Both JSON questions validated successfully");
  testAssert(jsonValidation.errors.length === 0, "Zero errors on valid JSON payload");

  // ── 3. CSV Import Parsing & Validation ──
  console.log("\n── 3. CSV Import Parsing & Validation ──");
  const csvContent = `type,question_text,option_a,option_b,option_c,option_d,correct_answer,marks
mcq,Which data structure uses LIFO order?,Queue,Stack,Array,Tree,B,1
mcq,What is the time complexity of hash table lookup on average?,O(1),O(N),O(log N),O(N^2),A,2
coding,Fibonacci Number,,,,,,5
`;

  const csvBuffer = Buffer.from(csvContent, "utf-8");
  const parsedCsvRows = parseRawFile("csv", csvBuffer);
  testAssert(parsedCsvRows.length === 3, "CSV parses 3 raw question rows");

  const csvValidation = validateImportQuestions(parsedCsvRows, "csv");
  testAssert(csvValidation.validQuestions.length === 2, "2 valid MCQ questions parsed from flat columns");
  testAssert(csvValidation.errors.length === 1, "Detected missing description for coding row");
  testAssert(csvValidation.errors[0].row === 3, "Error pinpointed to row 3");

  const mcq1 = csvValidation.validQuestions[0];
  if (mcq1.type === "mcq") {
    testAssert(mcq1.options.length === 4, "MCQ mapped 4 flat options");
    testAssert(mcq1.options[1].option_text === "Stack", "Option B is Stack");
    testAssert(mcq1.options[1].is_correct === true, "Option B correctly assigned is_correct: true");
    testAssert(mcq1.options[0].is_correct === false, "Option A correctly assigned is_correct: false");
  }

  // ── 4. XLSX Import Parsing & Validation ──
  console.log("\n── 4. XLSX Import Parsing & Validation ──");
  const xlsxWorkbook = XLSX.utils.book_new();
  const xlsxData = [
    {
      type: "mcq",
      question_text: "What is the degree of a binary tree root with 2 children?",
      option_a: "0",
      option_b: "1",
      option_c: "2",
      option_d: "3",
      correct_answer: "C",
      marks: 1,
    },
    {
      type: "coding",
      title: "Palindrome Number",
      description: "Determine whether an integer is a palindrome.",
      marks: 5,
      sample_input: "121",
      sample_output: "true",
    },
  ];
  const xlsxSheet = XLSX.utils.json_to_sheet(xlsxData);
  XLSX.utils.book_append_sheet(xlsxWorkbook, xlsxSheet, "Questions");
  const xlsxBuffer = XLSX.write(xlsxWorkbook, { type: "buffer", bookType: "xlsx" });

  const parsedXlsxRows = parseRawFile("xlsx", xlsxBuffer);
  testAssert(parsedXlsxRows.length === 2, "XLSX parses 2 rows from worksheet");

  const xlsxValidation = validateImportQuestions(parsedXlsxRows, "xlsx");
  testAssert(xlsxValidation.validQuestions.length === 2, "Both XLSX questions validated successfully");
  testAssert(xlsxValidation.validQuestions[1].type === "coding", "Second question is coding problem");

  // ── 5. Validation Diagnostics (Missing fields, invalid marks, duplicates) ──
  console.log("\n── 5. Validation Diagnostics & Error Pinpointing ──");
  const invalidRows = [
    { type: "invalid_type", question_text: "Test" },
    { type: "mcq", question_text: "", option_a: "A", option_b: "B", correct_answer: "A" },
    { type: "mcq", question_text: "MCQ with no correct answer", option_a: "A", option_b: "B" },
    { type: "mcq", question_text: "MCQ with only one option", option_a: "A", correct_answer: "A" },
    { type: "coding", title: "", description: "Desc" },
    { type: "mcq", question_text: "Negative marks question", option_a: "A", option_b: "B", correct_answer: "A", marks: -5 },
    { type: "mcq", question_text: "Duplicate text", option_a: "A", option_b: "B", correct_answer: "A" },
    { type: "mcq", question_text: "Duplicate text", option_a: "A", option_b: "B", correct_answer: "A" },
  ];

  const diagResult = validateImportQuestions(invalidRows, "json");
  testAssert(diagResult.errors.length >= 6, "Detected all 6 invalid rows");
  testAssert(diagResult.warnings.length >= 1, "Detected duplicate warning on row 8");

  // ── 6. Persistence of Imported Questions ──
  console.log("\n── 6. Persistence of Imported Questions ──");
  const testContest = await createContest({
    title: "Batch Import Contest",
    passcode: "IMPORT_PASS",
    start_at: new Date(Date.now() + 60000).toISOString(),
    end_at: new Date(Date.now() + 3600000).toISOString(),
    duration_minutes: 60,
  });

  const persistResult = await persistImportedQuestions(testContest.id, jsonValidation.validQuestions);
  testAssert(persistResult.importedCount === 2, "Persisted 2 valid questions");

  const retrieved = await getContestQuestions(testContest.id, "admin");
  testAssert(retrieved.length === 2, "Retrieved 2 persisted questions from contest");
  testAssert(retrieved[0].question_type === "mcq", "First imported question is MCQ");
  testAssert(retrieved[1].question_type === "coding", "Second imported question is Coding");

  console.log(`\n══════════════════════════════════════════════════`);
  console.log(`  Phase 4 Question Import Engine: ${passed} passed, 0 failed`);
  console.log(`══════════════════════════════════════════════════\n`);
}

run();
