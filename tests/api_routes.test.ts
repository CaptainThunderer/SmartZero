/**
 * SmartZero — API Routes JSON Error & Contract Test Suite
 *
 * Run: npx tsx tests/api_routes.test.ts
 */

import { POST as interpretHandler } from "../app/api/interpret/route";
import { POST as lessonHandler } from "../app/api/lesson/route";
import { POST as hintHandler } from "../app/api/hint/route";
import { POST as evaluateHandler } from "../app/api/evaluate/route";

let passed = 0;
let failed = 0;

function assert(condition: boolean, name: string) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${name}`);
  } else {
    failed++;
    console.error(`  ❌ FAIL: ${name}`);
  }
}

async function run() {
  console.log("── Testing /api/interpret Route ──");
  {
    // Valid DSA question
    const req = new Request("http://localhost:3000/api/interpret", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question: "Find the maximum subarray sum with Kadane's algorithm",
        context: { language: "python" },
      }),
    });
    const res = await interpretHandler(req);
    assert(res.status === 200, "/api/interpret returns 200 for valid DSA question");
    assert(res.headers.get("content-type")?.includes("application/json") === true, "/api/interpret returns application/json");
    const data = await res.json();
    assert(Boolean(data.intent), "/api/interpret response contains intent");
  }

  {
    // Teach mode question with canvas context
    const req = new Request("http://localhost:3000/api/interpret", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question: "How does binary search work on this array?",
        context: {
          mode: "teach",
          teachSummary: "Array: [1, 3, 5, 7, 9] | Pointers: mid@2",
          language: "javascript",
        },
      }),
    });
    const res = await interpretHandler(req);
    assert(res.status === 200, "/api/interpret handles Teach mode context with 200");
    const data = await res.json();
    assert(Boolean(data.explanation || data.problemPlan), "/api/interpret provides explanation for Teach mode query");
  }

  {
    // Malformed request missing question
    const req = new Request("http://localhost:3000/api/interpret", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const res = await interpretHandler(req);
    assert(res.status === 400, "/api/interpret returns 400 on empty question");
    assert(res.headers.get("content-type")?.includes("application/json") === true, "Error response is application/json (not HTML)");
    const data = await res.json();
    assert(Boolean(data.error), "Error response contains error property");
  }

  console.log("\n── Testing /api/lesson Route ──");
  {
    const req = new Request("http://localhost:3000/api/lesson", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lessonId: "second-max",
        rawQuestion: "Second max",
      }),
    });
    const res = await lessonHandler(req);
    assert(res.status === 200, "/api/lesson returns 200 for known lessonId");
    assert(res.headers.get("content-type")?.includes("application/json") === true, "/api/lesson returns application/json");
    const data = await res.json();
    assert(Boolean(data.steps && data.steps.length > 0), "/api/lesson returns lesson steps");
  }

  {
    // Invalid lesson request
    const req = new Request("http://localhost:3000/api/lesson", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const res = await lessonHandler(req);
    assert(res.status === 400, "/api/lesson returns 400 on invalid body");
    assert(res.headers.get("content-type")?.includes("application/json") === true, "Invalid body response is application/json");
  }

  console.log("\n── Testing /api/hint Route ──");
  {
    const req = new Request("http://localhost:3000/api/hint", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lessonId: "binary-search",
        stepIndex: 2,
        questionPrompt: "Where should the right pointer move?",
      }),
    });
    const res = await hintHandler(req);
    assert(res.status === 200, "/api/hint returns 200");
    assert(res.headers.get("content-type")?.includes("application/json") === true, "/api/hint returns application/json");
    const data = await res.json();
    assert(Boolean(data.hint), "/api/hint returns hint text");
  }

  console.log("\n── Testing /api/evaluate Route ──");
  {
    const req = new Request("http://localhost:3000/api/evaluate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        expectedId: "choice-b",
        choiceId: "choice-b",
      }),
    });
    const res = await evaluateHandler(req);
    assert(res.status === 200, "/api/evaluate returns 200");
    const data = await res.json();
    assert(data.correct === true, "/api/evaluate evaluates matching IDs correctly");
  }

  {
    const req = new Request("http://localhost:3000/api/evaluate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        expectedId: "choice-b",
        choiceId: "choice-a",
      }),
    });
    const res = await evaluateHandler(req);
    assert(res.status === 200, "/api/evaluate returns 200 for mismatch");
    const data = await res.json();
    assert(data.correct === false, "/api/evaluate evaluates mismatch as false");
  }

  {
    const req = new Request("http://localhost:3000/api/evaluate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const res = await evaluateHandler(req);
    assert(res.status === 400, "/api/evaluate returns 400 for empty body");
    assert(res.headers.get("content-type")?.includes("application/json") === true, "Error response is application/json");
  }

  console.log("\n── Testing Malformed JSON Handling Across All Endpoints ──");
  {
    const req = new Request("http://localhost:3000/api/interpret", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{ bad json syntax: ",
    });
    const res = await interpretHandler(req);
    assert(res.status === 400, "/api/interpret returns 400 on malformed JSON body");
    assert(res.headers.get("content-type")?.includes("application/json") === true, "Malformed JSON response is application/json");
    const data = await res.json();
    assert(Boolean(data.error), "Malformed JSON error response contains error message");
  }

  {
    const req = new Request("http://localhost:3000/api/lesson", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not a json string at all",
    });
    const res = await lessonHandler(req);
    assert(res.status === 400, "/api/lesson returns 400 on malformed JSON body");
    assert(res.headers.get("content-type")?.includes("application/json") === true, "Malformed JSON response is application/json");
  }

  {
    const req = new Request("http://localhost:3000/api/hint", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{ missing closing brace",
    });
    const res = await hintHandler(req);
    assert(res.status === 400, "/api/hint returns 400 on malformed JSON body");
    assert(res.headers.get("content-type")?.includes("application/json") === true, "Malformed JSON response is application/json");
  }

  {
    const req = new Request("http://localhost:3000/api/evaluate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{\"broken\": ",
    });
    const res = await evaluateHandler(req);
    assert(res.status === 400, "/api/evaluate returns 400 on malformed JSON body");
    assert(res.headers.get("content-type")?.includes("application/json") === true, "Malformed JSON response is application/json");
  }

  console.log(`\n══════════════════════════════════════════════════`);
  console.log(`  API Routes Suite: ${passed} passed, ${failed} failed`);
  console.log(`══════════════════════════════════════════════════`);

  if (failed > 0) {
    process.exit(1);
  }
}

run();
