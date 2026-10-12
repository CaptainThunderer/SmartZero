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

async function verify() {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  console.log("==================================================");
  console.log("READ-ONLY VERIFICATION OF THE 3 TARGET TEST CASES");
  console.log("==================================================\n");

  const targetIds = [
    "fb41e689-b9fa-4edb-aba7-33e8d01bc2c2",
    "a3c5d14d-9a0e-45e6-a55a-dc5f2e831999",
    "377ecb6c-e156-4d4e-aaa9-f61191d31388",
  ];

  const { data: rows, error } = await sb
    .from("coding_test_cases")
    .select("*, question:coding_questions(id, title, input_format, output_format)")
    .in("id", targetIds);

  if (error) {
    console.error("Query error:", error);
    return;
  }

  for (const r of rows || []) {
    console.log("--------------------------------------------------");
    console.log(`Test Case ID : ${r.id}`);
    console.log(`Question ID  : ${r.question_id}`);
    console.log(`Question     : "${r.question?.title}"`);
    console.log(`Is Sample    : ${r.is_sample}, Hidden: ${r.is_hidden}`);
    console.log(`Input (raw)  :\n${JSON.stringify(r.input)}`);
    console.log(`Input (text) :\n${r.input}`);
    console.log(`Current Exp  :\n${JSON.stringify(r.expected_output)}`);
    console.log(`Current Text :\n${r.expected_output}`);
  }

  // Also verify working copies of Employee Salary Analyzer
  console.log("\n==================================================");
  console.log("VERIFY WORKING COPIES OF EMPLOYEE SALARY ANALYZER");
  console.log("==================================================\n");

  const workingTcIds = [
    "9228f2d5-3f87-451a-9c19-30133f112fbc", // Test 3
    "917b9951-d291-4bb0-a632-7b5658a068c1", // Final test
    "e631ff21-b86e-48d6-8fa7-8b1785481b04", // Data Guides Test
  ];

  const { data: workingRows } = await sb
    .from("coding_test_cases")
    .select("id, question_id, input, expected_output, is_sample")
    .in("id", workingTcIds);

  for (const w of workingRows || []) {
    console.log(`Working TC ID: ${w.id} (Question: ${w.question_id})`);
    console.log(`  Input: ${JSON.stringify(w.input)}`);
    console.log(`  Output: ${JSON.stringify(w.expected_output)}`);
  }
}

verify().catch(console.error);
