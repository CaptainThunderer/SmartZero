import fs from "node:fs";
if (fs.existsSync(".env.local")) {
  const content = fs.readFileSync(".env.local", "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
      const idx = trimmed.indexOf("=");
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}
import { createClient } from "@supabase/supabase-js";

async function run() {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: allQs, error } = await sb
    .from("coding_questions")
    .select("id, title, test_cases:coding_test_cases(*)");

  if (error) {
    console.error("Supabase query error:", error);
    return;
  }

  console.log(`Loaded ${allQs?.length} questions.`);

  const salaryQs = (allQs || []).filter((q) => q.title.toLowerCase().includes("salary"));
  console.log(`\n=== CHECKING ALL INSTANCES OF EMPLOYEE SALARY ANALYZER (${salaryQs.length} found) ===`);

  for (const q of salaryQs) {
    console.log(`\nQuestion: "${q.title}" (ID: ${q.id})`);
    for (const tc of q.test_cases || []) {
      console.log(`  TC ID: ${tc.id} [Sample: ${tc.is_sample}, Hidden: ${tc.is_hidden}]`);
      console.log(`    Input: ${JSON.stringify(tc.input)}`);
      console.log(`    Expected Output: ${JSON.stringify(tc.expected_output)}`);
      const lines = tc.input.trim().split("\n");
      if (lines.length >= 2) {
        const n = parseInt(lines[0].trim());
        const salaries = lines[1].trim().split(/\s+/).map(Number);
        const avg = salaries.reduce((a: number, b: number) => a + b, 0) / n;
        const above = salaries.filter((s: number) => s > avg).length;
        console.log(`    -> Math: avg=${avg.toFixed(1)}, above=${above}`);
        if (!tc.expected_output.includes(above.toString())) {
          console.log(`    ❌ MISMATCH! Expected output does not match calculated above count (${above})!`);
        } else {
          console.log(`    ✅ Matches math`);
        }
      }
    }
  }

  const twoSumQs = (allQs || []).filter((q) => q.title.toLowerCase().includes("two sum"));
  console.log(`\n=== CHECKING ALL INSTANCES OF TWO SUM (${twoSumQs.length} found) ===`);

  for (const q of twoSumQs) {
    console.log(`\nQuestion: "${q.title}" (ID: ${q.id})`);
    for (const tc of q.test_cases || []) {
      console.log(`  TC ID: ${tc.id} [Sample: ${tc.is_sample}, Hidden: ${tc.is_hidden}]`);
      console.log(`    Input: ${JSON.stringify(tc.input)}`);
      console.log(`    Expected Output: ${JSON.stringify(tc.expected_output)}`);
      const lines = tc.input.trim().split("\n");
      if (lines.length >= 2) {
        const [n, target] = lines[0].trim().split(/\s+/).map(Number);
        const nums = lines[1].trim().split(/\s+/).map(Number);
        const pairs: string[] = [];
        for (let i = 0; i < nums.length; i++) {
          for (let j = i + 1; j < nums.length; j++) {
            if (nums[i] + nums[j] === target) {
              pairs.push(`${i} ${j}`);
            }
          }
        }
        console.log(`    -> Math: target=${target}, found pairs: ${pairs.join(", ")}`);
        if (!pairs.includes(tc.expected_output.trim())) {
          console.log(`    ❌ MISMATCH! Stored expected output "${tc.expected_output.trim()}" is NOT a valid sum pair! Math pairs: ${pairs.join(", ")}`);
        } else {
          console.log(`    ✅ Matches math`);
        }
      }
    }
  }
}

run().catch(console.error);
