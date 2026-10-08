import assert from "node:assert/strict";
import {
  sanitizeQuestionForStudent,
  normalizeQuestionDifficulty,
  addMcqQuestion,
  linkQuestionToContest,
  getContestQuestions,
  createContest,
} from "../lib/contest/service";
import { validateImportQuestions } from "../lib/contest/importer";
import type { ContestQuestion, McqQuestion } from "../types/contest";
import { GET as getQuestionsRoute } from "../app/api/contest/[slug]/questions/route";

console.log("==================================================");
console.log("▶ RUNNING MCQ PROMPT MAPPING & CANONICAL SHAPE TEST SUITE");
console.log("==================================================\n");

let passed = 0;
function testAssert(condition: boolean, message: string) {
  assert(condition, message);
  console.log(`  ✅ ${message}`);
  passed++;
}

async function runTests() {
  // ── 1. Difficulty Normalization ──
  console.log("── 1. Difficulty Normalization ──");
  testAssert(normalizeQuestionDifficulty("MEDIUM") === "Medium", "Uppercase 'MEDIUM' normalizes to 'Medium'");
  testAssert(normalizeQuestionDifficulty("medium") === "Medium", "Lowercase 'medium' normalizes to 'Medium'");
  testAssert(normalizeQuestionDifficulty("EASY") === "Easy", "Uppercase 'EASY' normalizes to 'Easy'");
  testAssert(normalizeQuestionDifficulty("easy") === "Easy", "Lowercase 'easy' normalizes to 'Easy'");
  testAssert(normalizeQuestionDifficulty("HARD") === "Hard", "Uppercase 'HARD' normalizes to 'Hard'");
  testAssert(normalizeQuestionDifficulty("hard") === "Hard", "Lowercase 'hard' normalizes to 'Hard'");
  testAssert(normalizeQuestionDifficulty(undefined) === "Medium", "Undefined difficulty defaults to 'Medium'");
  testAssert(normalizeQuestionDifficulty("unknown") === "Medium", "Invalid difficulty defaults to 'Medium'");

  // ── 2. Importer Normalization ──
  console.log("\n── 2. Importer Normalization ──");
  const rawRows = [
    {
      type: "mcq",
      question_text: "Which Pandas method reads CSV files?",
      difficulty: "MEDIUM",
      marks: 2,
      options: [
        { option_text: "pd.read_csv()", is_correct: true },
        { option_text: "pd.csv()", is_correct: false },
      ],
    },
    {
      type: "coding",
      title: "Sample Problem",
      description: "Description here",
      difficulty: "HARD",
      marks: 10,
      test_cases: [{ input: "1", expected_output: "1", is_sample: true }],
    },
  ];
  const validation = validateImportQuestions(rawRows, "json");
  testAssert(validation.errors.length === 0, "Validation passes without errors");
  testAssert(validation.validQuestions.length === 2, "Both questions parsed successfully");
  testAssert(validation.validQuestions[0].difficulty === "Medium", "MCQ 'MEDIUM' normalized to 'Medium'");
  testAssert(validation.validQuestions[1].difficulty === "Hard", "Coding 'HARD' normalized to 'Hard'");

  // ── 3. Canonical Shape & Sanitization for Students ──
  console.log("\n── 3. Canonical Shape & Sanitization for Students ──");
  const rawMcqDetails: McqQuestion = {
    id: "mcq-test-001",
    question_text: "What is the time complexity of quicksort in the average case?",
    explanation: "Quicksort has O(N log N) expected time complexity.",
    difficulty: "Medium",
    created_at: new Date().toISOString(),
    options: [
      { id: "opt-1", question_id: "mcq-test-001", option_text: "O(N log N)", is_correct: true, sort_order: 0 },
      { id: "opt-2", question_id: "mcq-test-001", option_text: "O(N^2)", is_correct: false, sort_order: 1 },
      { id: "opt-3", question_id: "mcq-test-001", option_text: "O(N)", is_correct: false, sort_order: 2 },
    ],
  };

  const rawCq: ContestQuestion = {
    id: "cq-test-001",
    contest_id: "contest-test-001",
    question_id: "mcq-test-001",
    question_type: "mcq",
    sort_order: 0,
    marks: 2,
    negative_marks: 0.5,
    mcq_details: rawMcqDetails,
  };

  const sanitized = sanitizeQuestionForStudent(rawCq);

  // Both nested and top-level fields populated
  testAssert(sanitized.mcq_details?.question_text === "What is the time complexity of quicksort in the average case?", "sanitized.mcq_details.question_text is populated");
  testAssert(sanitized.question_text === "What is the time complexity of quicksort in the average case?", "sanitized.question_text (canonical top-level) is populated");
  testAssert(sanitized.prompt === "What is the time complexity of quicksort in the average case?", "sanitized.prompt alias is populated");

  // Options populated
  testAssert(sanitized.mcq_details?.options?.length === 3, "sanitized.mcq_details.options has 3 items");
  testAssert(sanitized.options?.length === 3, "sanitized.options (canonical top-level) has 3 items");
  testAssert(sanitized.mcq_details?.options?.[0].option_text === "O(N log N)", "Option text is preserved");

  // Security: Zero leak of sensitive fields
  testAssert(sanitized.mcq_details?.explanation === undefined, "mcq_details.explanation is strictly stripped");
  testAssert(sanitized.mcq_details?.options?.[0].is_correct === undefined, "Option 1 is_correct is strictly stripped");
  testAssert(sanitized.mcq_details?.options?.[1].is_correct === undefined, "Option 2 is_correct is strictly stripped");
  testAssert(sanitized.mcq_details?.options?.[2].is_correct === undefined, "Option 3 is_correct is strictly stripped");
  testAssert(sanitized.options?.[0].is_correct === undefined, "Top-level options is_correct is strictly stripped");

  // ── 4. Fallback Aliases at Boundary (prompt / question / title) ──
  console.log("\n── 4. Fallback Aliases at Boundary ──");
  const fallbackCq: any = {
    id: "cq-fallback-001",
    contest_id: "contest-test-001",
    question_id: "mcq-fallback-001",
    question_type: "mcq",
    sort_order: 1,
    marks: 2,
    negative_marks: 0,
    prompt: "Which data structure is LIFO?", // flat prompt alias
    options: [
      { id: "o1", text: "Stack", correct: true }, // flat text and correct aliases
      { id: "o2", text: "Queue", correct: false },
    ],
  };

  const sanitizedFallback = sanitizeQuestionForStudent(fallbackCq);
  testAssert(sanitizedFallback.question_text === "Which data structure is LIFO?", "Flat prompt alias canonicalized to question_text");
  testAssert(sanitizedFallback.mcq_details?.question_text === "Which data structure is LIFO?", "Nested mcq_details.question_text populated from flat alias");
  testAssert(sanitizedFallback.options?.[0].option_text === "Stack", "Option text alias canonicalized to option_text");
  testAssert(sanitizedFallback.options?.[0].is_correct === undefined, "Option is_correct stripped even with alias");

  // ── 5. End-to-End Service Integration & Contest Hydration ──
  console.log("\n── 5. End-to-End Service Integration & Contest Hydration ──");
  const testContest = await createContest({
    title: "MCQ Prompt Mapping Suite Contest",
    description: "Regression contest testing question prompt delivery",
    start_at: new Date(Date.now() - 3600_000).toISOString(),
    end_at: new Date(Date.now() + 3600_000).toISOString(),
    duration_minutes: 60,
    passcode: "PROMPT-TEST",
    status: "PUBLISHED",
  });

  const mcq1 = await addMcqQuestion({
    question_text: "What is the output of print(2 ** 3)?",
    explanation: "2 to the power 3 equals 8.",
    difficulty: "EASY", // Tests normalization
    options: [
      { option_text: "8", is_correct: true },
      { option_text: "6", is_correct: false },
    ],
  });

  const mcq2 = await addMcqQuestion({
    prompt: "Which keyword defines a function in Python?", // Tests prompt input alias
    difficulty: "MEDIUM", // Tests normalization
    options: [
      { option_text: "def", is_correct: true },
      { option_text: "func", is_correct: false },
    ],
  });

  await linkQuestionToContest({
    contest_id: testContest.id,
    question_id: mcq1.id,
    question_type: "mcq",
    sort_order: 0,
    marks: 2,
  });

  await linkQuestionToContest({
    contest_id: testContest.id,
    question_id: mcq2.id,
    question_type: "mcq",
    sort_order: 1,
    marks: 2,
  });

  // Hydrate questions as student
  const studentQuestions = await getContestQuestions(testContest.id, "student");
  testAssert(studentQuestions.length === 2, "Retrieved 2 student questions");

  for (let i = 0; i < studentQuestions.length; i++) {
    const q = studentQuestions[i];
    testAssert(!!q.question_text && q.question_text.length > 0, `Question ${i + 1} has non-empty top-level question_text`);
    testAssert(!!q.mcq_details?.question_text && q.mcq_details.question_text.length > 0, `Question ${i + 1} has non-empty mcq_details.question_text`);
    testAssert(q.question_text === q.mcq_details?.question_text, `Question ${i + 1} top-level matches mcq_details.question_text`);
    testAssert(Array.isArray(q.options) && q.options.length === 2, `Question ${i + 1} has 2 options at top level`);
    testAssert(Array.isArray(q.mcq_details?.options) && q.mcq_details.options.length === 2, `Question ${i + 1} has 2 options in mcq_details`);
    testAssert(q.mcq_details?.explanation === undefined, `Question ${i + 1} explanation is undefined`);
    for (const opt of q.options || []) {
      testAssert(typeof opt.option_text === "string" && opt.option_text.length > 0, `Option has valid option_text`);
      testAssert(opt.is_correct === undefined, `Option is_correct is undefined`);
    }
  }

  // ── 6. Student API Route Endpoint Contract ──
  console.log("\n── 6. Student API Route Endpoint Contract ──");
  const req = new Request(`http://localhost/api/contest/${testContest.slug}/questions?user_id=student-prompt-tester`, {
    method: "GET",
  });
  const res = await getQuestionsRoute(req, { params: Promise.resolve({ slug: testContest.slug }) });
  testAssert(res.status === 200, "API route returns 200 OK");
  const payload = await res.json();
  testAssert(Array.isArray(payload.questions) && payload.questions.length === 2, "API payload contains 2 questions");

  const apiQ1 = payload.questions[0];
  testAssert(apiQ1.question_text === "What is the output of print(2 ** 3)?", "API returns canonical question_text at top level");
  testAssert(apiQ1.mcq_details.question_text === "What is the output of print(2 ** 3)?", "API returns question_text in mcq_details");
  testAssert(apiQ1.options.length === 2, "API returns options at top level");
  testAssert(apiQ1.options[0].option_text === "8", "API returns option_text");
  testAssert(apiQ1.options[0].is_correct === undefined, "API does NOT leak is_correct");
  testAssert(apiQ1.mcq_details.explanation === undefined, "API does NOT leak explanation");

  console.log(`\n==================================================`);
  console.log(`🎉 ALL ${passed} MCQ PROMPT MAPPING ASSERTIONS PASSED!`);
  console.log(`==================================================`);
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
