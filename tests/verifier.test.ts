import { verifyJavaScript, verifyPython, checkCppCompiler } from "../agent/verifier";

let passed = 0;
let failed = 0;

function assert(cond: boolean, name: string) {
  if (cond) {
    passed++;
    console.log(`  ✅ ${name}`);
  } else {
    failed++;
    console.error(`  ❌ FAIL: ${name}`);
  }
}

async function run() {
  console.log("── Testing Solution Verifier ──");

  // 1. JavaScript Execution (Valid)
  const validJs = `
    function isGreaterAverage(a, b, c) {
      return (a + b) > 2 * c ? "YES" : "NO";
    }
    console.log(isGreaterAverage(10, 20, 12));
  `;
  const jsRes = verifyJavaScript(validJs);
  assert(jsRes.success === true, "Valid JS executes successfully");
  assert(jsRes.output.includes("YES"), "JS output contains expected YES");

  // 2. JavaScript Execution (Error catching)
  const invalidJs = `
    const x = null;
    x.foo();
  `;
  const jsErr = verifyJavaScript(invalidJs);
  assert(jsErr.success === false, "JS syntax/runtime error caught safely");
  assert(Boolean(jsErr.error), "Error message captured without process crashing");

  // 3. Python Execution (Valid)
  const validPy = `
def is_greater_average(a, b, c):
    return "YES" if (a + b) > 2 * c else "NO"

print(is_greater_average(10, 20, 12))
print(is_greater_average(5, 9, 7))
  `;
  const pyRes = verifyPython(validPy);
  assert(pyRes.success === true, "Python executes successfully via child process");
  assert(pyRes.output.includes("YES") && pyRes.output.includes("NO"), "Python output matches expected YES and NO");

  // 4. Python Error Catching
  const invalidPy = `
def broken():
    raise ValueError("Test error")
broken()
  `;
  const pyErr = verifyPython(invalidPy);
  assert(pyErr.success === false, "Python runtime exception captured cleanly");
  assert(Boolean(pyErr.error && pyErr.error.includes("ValueError")), "Python error details captured");

  // 5. C++ Compiler Detection
  const cpp = checkCppCompiler();
  assert(typeof cpp.available === "boolean", "C++ compiler check returns boolean status");

  console.log(`\n══════════════════════════════════════════════════`);
  console.log(`  Verifier Suite: ${passed} passed, ${failed} failed`);
  console.log(`══════════════════════════════════════════════════\n`);

  process.exit(failed > 0 ? 1 : 0);
}

run();
