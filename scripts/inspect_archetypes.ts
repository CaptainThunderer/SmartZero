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

  const { data: qs } = await sb
    .from("coding_questions")
    .select("*, test_cases:coding_test_cases(*)");

  const archetypes = [
    "Maximum Subarray Sum",
    "Valid Parentheses",
    "Two Sum",
    "Count Distinct Elements",
    "Student Performance Analyzer",
    "Bank Transaction Analyzer",
    "Inventory Stock Checker",
    "Employee Salary Analyzer",
    "Message Analyzer",
  ];

  for (const arch of archetypes) {
    const matching = (qs || []).filter((q) => q.title.trim().toLowerCase() === arch.toLowerCase());
    console.log(`================================================================`);
    console.log(`ARCHETYPE: ${arch} (${matching.length} instances in coding_questions)`);
    if (matching.length > 0) {
      const first = matching[0];
      console.log(`Description: ${first.description}`);
      console.log(`Input Format: ${first.input_format}`);
      console.log(`Output Format: ${first.output_format}`);
      console.log(`Constraints: ${first.constraints}`);
      console.log(`--- Sample Test Cases across instances ---`);
      for (const m of matching) {
        console.log(`  Instance ID ${m.id}: ${m.test_cases?.length} test cases`);
        for (const tc of m.test_cases || []) {
          console.log(`    TC ${tc.id.slice(0, 8)} [Sample: ${tc.is_sample}]`);
          console.log(`      IN:\n${tc.input.trim()}`);
          console.log(`      OUT:\n${tc.expected_output.trim()}`);
        }
      }
    }
  }
}

run().catch(console.error);
