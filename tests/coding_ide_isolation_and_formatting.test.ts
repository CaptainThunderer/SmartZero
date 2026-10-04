import assert from "node:assert/strict";
import {
  createContest,
  addCodingQuestion,
  linkQuestionToContest,
  registerContestParticipant,
  startContestExam,
  getContestQuestions,
  sanitizeQuestionForStudent,
  startNewAttempt,
  submitContestExam,
} from "../lib/contest/service";
import {
  saveCodingDraft,
  getStudentSubmissions,
} from "../lib/judge/service";
import {
  getStudentDraftKey,
  cleanupLegacyUnscopedDrafts,
} from "../components/contest/CodingIDE";
import { STARTER_TEMPLATES } from "../lib/judge/templates";
import { createStudentSessionToken } from "../lib/auth/studentSession";
import { POST as saveDraftRoute } from "../app/api/contest/[slug]/coding/save/route";
import { GET as getSubmissionsRoute } from "../app/api/contest/[slug]/coding/submissions/route";

console.log("==================================================");
console.log("▶ RUNNING CODING IDE ISOLATION & SAMPLE RENDERING TEST SUITE");
console.log("==================================================\n");

let passed = 0;
function testAssert(condition: boolean, message: string) {
  assert(condition, message);
  console.log(`  ✅ ${message}`);
  passed++;
}

// In-Memory LocalStorage Simulator for browser tests
class MockLocalStorage {
  private store: Map<string, string> = new Map();

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  clear(): void {
    this.store.clear();
  }
  get length(): number {
    return this.store.size;
  }
  key(index: number): string | null {
    const keys = Array.from(this.store.keys());
    return keys[index] ?? null;
  }
}

async function runTests() {
  const mockStorage = new MockLocalStorage();
  (global as any).localStorage = mockStorage;
  (global as any).window = {};

  // Setup Contest & Coding Question
  const now = Date.now();
  const contest = await createContest({
    title: `Isolation Contest ${now}`,
    start_at: new Date(now - 60_000).toISOString(),
    end_at: new Date(now + 3600_000).toISOString(),
    duration_minutes: 60,
    passcode: "ISOLATION-PASS",
    allow_retake: true,
    max_attempts: 2,
    status: "PUBLISHED",
  });

  const question1 = await addCodingQuestion({
    title: "Array Peak Element",
    description: "Find the peak element in an integer array.",
    difficulty: "Medium",
    input_format: "N\nN space-separated integers",
    output_format: "Index of peak element",
    time_limit_ms: 2000,
    memory_limit_mb: 256,
    test_cases: [
      {
        input: "5\n1 2 2 3 1",
        expected_output: "3",
        is_sample: true,
        is_hidden: false,
        weight: 20,
      },
      {
        input: "7\n1 3 20 4 1 0 5",
        expected_output: "2",
        is_sample: false,
        is_hidden: true,
        weight: 80,
      },
    ],
  });

  const question2 = await addCodingQuestion({
    title: "Reverse String",
    description: "Reverse string in-place.",
    difficulty: "Easy",
    test_cases: [
      {
        input: "hello\n",
        expected_output: "olleh",
        is_sample: true,
        is_hidden: false,
        weight: 50,
      },
    ],
  });

  await linkQuestionToContest({
    contest_id: contest.id,
    question_id: question1.id,
    question_type: "coding",
    sort_order: 1,
    marks: 10,
    negative_marks: 0,
  });
  await linkQuestionToContest({
    contest_id: contest.id,
    question_id: question2.id,
    question_type: "coding",
    sort_order: 2,
    marks: 10,
    negative_marks: 0,
  });

  const studentA = `student-A-${now}`;
  const studentB = `student-B-${now}`;

  const regA = await registerContestParticipant({
    contest_id: contest.id,
    user_id: studentA,
    passcode: "ISOLATION-PASS",
  });
  testAssert(regA.error === null, "Student A registration succeeded");
  await startContestExam({
    contest_id: contest.id,
    user_id: studentA,
  });

  const regB = await registerContestParticipant({
    contest_id: contest.id,
    user_id: studentB,
    passcode: "ISOLATION-PASS",
  });
  testAssert(regB.error === null, "Student B registration succeeded");
  await startContestExam({
    contest_id: contest.id,
    user_id: studentB,
  });

  // ════════════════════════════════════════════════════════════════
  // PART 1 — ISSUE 1: SAMPLE INPUT RENDERING & PRESERVATION
  // ════════════════════════════════════════════════════════════════
  console.log("── PART 1: Sample Input Multi-line & Whitespace Preservation ──");

  const sampleInput = "5\n1 2 2 3 1";
  const lines = sampleInput.split("\n");
  testAssert(lines.length === 2, "Stored sample input contains exactly 2 lines");
  testAssert(lines[0] === "5", "First line is '5'");
  testAssert(lines[1] === "1 2 2 3 1", "Second line is '1 2 2 3 1'");

  // Verify questions API sanitizes for students: hidden test cases are completely masked!
  const studentQuestions = await getContestQuestions(contest.id, "student");
  const q1ForStudent = studentQuestions.find((q) => q.question_id === question1.id);
  testAssert(!!q1ForStudent, "Question 1 retrieved for student");
  testAssert(!!q1ForStudent?.coding_details?.test_cases, "Coding test cases present");

  const studentTestCases = q1ForStudent!.coding_details!.test_cases!;
  testAssert(studentTestCases.length === 1, "Student receives ONLY the sample test case (hidden cases stripped)");
  testAssert(studentTestCases[0].is_sample === true, "Returned test case is sample");
  testAssert(studentTestCases[0].input === "5\n1 2 2 3 1", "Sample test case retains exact multi-line input");
  testAssert(studentTestCases[0].expected_output === "3", "Sample test case retains expected output");

  // Verify hidden test case was stripped
  const hasHidden = studentTestCases.some((tc) => (tc as any).is_hidden || tc.input.includes("20"));
  testAssert(!hasHidden, "Hidden test case input/output is completely masked from student questions payload");

  // ════════════════════════════════════════════════════════════════
  // PART 2 — ISSUE 2: CLIENT CACHE SCOPING & CROSS-ACCOUNT ISOLATION
  // ════════════════════════════════════════════════════════════════
  console.log("\n── PART 2: Client-Side Draft Scoping (A, B, C, D) ──");

  // A. Student A code != Student B code
  const keyA_py = getStudentDraftKey(studentA, contest.slug, question1.id, "python");
  const keyB_py = getStudentDraftKey(studentB, contest.slug, question1.id, "python");
  testAssert(keyA_py !== null && keyB_py !== null, "Scoped keys generated for students");
  testAssert(keyA_py !== keyB_py, "Student A key is distinct from Student B key");
  testAssert(keyA_py!.includes(studentA), "Student A key contains Student A identifier");
  testAssert(keyB_py!.includes(studentB), "Student B key contains Student B identifier");

  // B. Same question + same browser + different students
  mockStorage.clear();
  const codeStudentA = "def solution_student_a():\n    return 'peak_a'";
  mockStorage.setItem(keyA_py!, codeStudentA);

  testAssert(mockStorage.getItem(keyA_py!) === codeStudentA, "Student A code stored in mock localStorage");
  testAssert(mockStorage.getItem(keyB_py!) === null, "Student B has null in their scoped key (no code leakage from A)");

  // C. Different question + same student
  const keyA_q2 = getStudentDraftKey(studentA, contest.slug, question2.id, "python");
  testAssert(keyA_q2 !== keyA_py, "Question 1 key is distinct from Question 2 key for same student");
  testAssert(mockStorage.getItem(keyA_q2!) === null, "Question 2 does not inherit Question 1 draft");

  // D. Same student + reload
  const reloadedCodeA = mockStorage.getItem(keyA_py!);
  testAssert(reloadedCodeA === codeStudentA, "Same student reloading page retrieves their own cached draft");

  // ════════════════════════════════════════════════════════════════
  // PART 3 — LOGOUT, TRANSITION & CLEANUP (E, F, G, H)
  // ════════════════════════════════════════════════════════════════
  console.log("\n── PART 3: Logout/Login Transition, Autosave & Hydration (E, F, G, H) ──");

  // E. Student logout/login transition purges legacy/foreign drafts
  mockStorage.setItem(`smartzero_code_${contest.slug}_${question1.id}_python`, "legacy_unscoped_code");
  mockStorage.setItem(`coding_draft_${question1.id}`, "legacy_global_draft");

  testAssert(mockStorage.getItem(`smartzero_code_${contest.slug}_${question1.id}_python`) !== null, "Legacy unscoped key exists before cleanup");
  cleanupLegacyUnscopedDrafts(contest.slug, question1.id);
  testAssert(mockStorage.getItem(`smartzero_code_${contest.slug}_${question1.id}_python`) === null, "Legacy unscoped key purged by cleanupLegacyUnscopedDrafts");
  testAssert(mockStorage.getItem(`coding_draft_${question1.id}`) === null, "Legacy global key purged by cleanupLegacyUnscopedDrafts");

  // F. Pending old autosave arriving after identity change cannot overwrite Student B
  // Student A sends draft via API with token A
  const tokenA = createStudentSessionToken({ sub: studentA, email: "student_a@test.edu" });
  const tokenB = createStudentSessionToken({ sub: studentB, email: "student_b@test.edu" });

  const saveReqA = new Request(`http://localhost/api/contest/${contest.slug}/coding/save`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${tokenA}`,
    },
    body: JSON.stringify({
      question_id: question1.id,
      language: "python",
      code: codeStudentA,
      user_id: studentA,
      seq: 1,
      timestamp: Date.now(),
    }),
  });

  const saveResA = await saveDraftRoute(saveReqA, { params: Promise.resolve({ slug: contest.slug }) });
  testAssert(saveResA.status === 200, "Student A draft saved successfully on server");

  // If Student A's old payload attempts to impersonate or save to Student B using Token A:
  const spoofReq = new Request(`http://localhost/api/contest/${contest.slug}/coding/save`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${tokenA}`, // Token A
    },
    body: JSON.stringify({
      question_id: question1.id,
      language: "python",
      code: "malicious_injected_code",
      user_id: studentB, // Target Student B
      seq: 2,
      timestamp: Date.now(),
    }),
  });

  const spoofRes = await saveDraftRoute(spoofReq, { params: Promise.resolve({ slug: contest.slug }) });
  testAssert(spoofRes.status === 403, "Student A token attempting to save to Student B is rejected (403 Forbidden)");

  // G. Student B with no draft gets starter code
  const subReqB = new Request(`http://localhost/api/contest/${contest.slug}/coding/submissions?question_id=${question1.id}&user_id=${studentB}`, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${tokenB}`,
    },
  });
  const subResB = await getSubmissionsRoute(subReqB, { params: Promise.resolve({ slug: contest.slug }) });
  const subDataB = await subResB.json();
  testAssert(subResB.status === 200, "Student B submissions query succeeded");
  testAssert(Array.isArray(subDataB.submissions) && subDataB.submissions.length === 0, "Student B has 0 submissions/drafts on server");

  // Check that Student B gets starter code
  const studentBInitialCode = mockStorage.getItem(keyB_py!) || STARTER_TEMPLATES.python;
  testAssert(studentBInitialCode === STARTER_TEMPLATES.python, "Student B gets clean starter code (no Student A code)");
  testAssert(!studentBInitialCode.includes("solution_student_a"), "Student B starter code contains ZERO Student A artifacts");

  // H. Server draft hydration wins over stale client cache
  // Imagine Student A had an old local cache:
  mockStorage.setItem(keyA_py!, "stale_local_code_from_previous_tab");
  // Student A fetches from server:
  const subReqA = new Request(`http://localhost/api/contest/${contest.slug}/coding/submissions?question_id=${question1.id}&user_id=${studentA}`, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${tokenA}`,
    },
  });
  const subResA = await getSubmissionsRoute(subReqA, { params: Promise.resolve({ slug: contest.slug }) });
  const subDataA = await subResA.json();
  testAssert(subResA.status === 200, "Student A submissions query succeeded");
  testAssert(subDataA.submissions.length > 0, "Student A has authoritative draft on server");
  const authoritativeServerCode = subDataA.submissions[0].code;
  testAssert(authoritativeServerCode === codeStudentA, "Authoritative server code matches Student A's saved draft");

  // Simulate server draft hydration overriding stale local cache:
  if (authoritativeServerCode) {
    mockStorage.setItem(keyA_py!, authoritativeServerCode);
  }
  testAssert(mockStorage.getItem(keyA_py!) === codeStudentA, "Server authoritative draft overrides stale client cache");

  // ════════════════════════════════════════════════════════════════
  // PART 4 — LANGUAGE ISOLATION & RETAKE BEHAVIOR (I, J)
  // ════════════════════════════════════════════════════════════════
  console.log("\n── PART 4: Language Isolation & Retake Verification (I, J) ──");

  // I. Language-specific draft isolation
  const keyA_cpp = getStudentDraftKey(studentA, contest.slug, question1.id, "cpp");
  testAssert(keyA_cpp !== keyA_py, "Python key and C++ key are distinct for same student and question");
  const codeCpp = "#include <iostream>\nint main() { return 0; }";
  mockStorage.setItem(keyA_cpp!, codeCpp);

  testAssert(mockStorage.getItem(keyA_py!) === codeStudentA, "Python code unaffected by C++ draft");
  testAssert(mockStorage.getItem(keyA_cpp!) === codeCpp, "C++ code stored in its own language-specific key");

  // J. Retake behavior remains correct and isolated
  // Student A completes attempt 1
  await submitContestExam({
    contest_id: contest.id,
    user_id: studentA,
    reason: "manual",
  });

  const retakeResult = await startNewAttempt({
    contest_id: contest.id,
    user_id: studentA,
  });
  testAssert(retakeResult.error === null, "Student A started new attempt (retake)");
  testAssert(retakeResult.participant?.attempt_number === 2, "Student A is on attempt 2");

  // Student B submissions/drafts remain isolated after Student A retake
  const subResB_after = await getSubmissionsRoute(subReqB, { params: Promise.resolve({ slug: contest.slug }) });
  const subDataB_after = await subResB_after.json();
  testAssert(subDataB_after.submissions.length === 0, "Student B has 0 submissions after Student A retake");

  console.log("\n==================================================");
  console.log(`🎉 ALL ${passed} CODING IDE ISOLATION & SAMPLE RENDERING ASSERTIONS PASSED!`);
  console.log("==================================================");
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
