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
import { defaultJudgeWorker } from "../lib/judge/worker/worker";

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  console.log("==================================================");
  console.log("PHASE 3: COMPREHENSIVE PYTHON QUESTION AUDIT (ALL QUESTIONS)");
  console.log("==================================================\n");

  // 1. Get all contests and links
  const { data: contests } = await supabase.from("contests").select("id, title, slug");
  const { data: links } = await supabase.from("contest_questions").select("*");
  const { data: codingQs } = await supabase
    .from("coding_questions")
    .select("*, test_cases:coding_test_cases(*)");

  console.log(`Discovered ${codingQs?.length || 0} coding questions in question bank.`);

  // Find all coding questions linked to at least one contest
  const linkedQIds = new Set(
    links?.filter((l) => l.question_type === "coding").map((l) => l.question_id)
  );

  const linkedCodingQs = (codingQs || []).filter((q) => linkedQIds.has(q.id));
  console.log(`Found ${linkedCodingQs.length} unique Python coding questions linked to contests.\n`);

  // Track results
  const report: Array<{
    id: string;
    title: string;
    contests: string[];
    testCaseCount: number;
    status: "PASS" | "FAIL" | "BLOCKED" | "NEEDS REVIEW";
    evidence: string;
    inputFormat?: string;
    sampleTc?: any;
  }> = [];

  for (const q of linkedCodingQs) {
    const qContests = (links || [])
      .filter((l) => l.question_id === q.id)
      .map((l) => {
        const c = contests?.find((c) => c.id === l.contest_id);
        return c ? c.title : l.contest_id;
      });

    const testCases = q.test_cases || [];

    // Analyze question definition
    let status: "PASS" | "FAIL" | "BLOCKED" | "NEEDS REVIEW" = "PASS";
    let evidence = "";

    if (testCases.length === 0) {
      status = "BLOCKED";
      evidence = "No test cases configured in coding_test_cases table.";
    }

    report.push({
      id: q.id,
      title: q.title,
      contests: qContests,
      testCaseCount: testCases.length,
      status,
      evidence,
      inputFormat: q.input_format,
      sampleTc: testCases[0],
    });
  }

  // Deep inspect flagged questions:
  console.log("── DEEP INSPECTION: Flagged Questions ──\n");

  // 1. Employee Salary Analyzer
  const salaryQ = codingQs?.find((q) => q.title.toLowerCase().includes("salary analyzer"));
  if (salaryQ) {
    console.log(`[Flagged Question 1] "${salaryQ.title}" (ID: ${salaryQ.id})`);
    console.log("Description:", salaryQ.description);
    console.log("Input format:", salaryQ.input_format);
    console.log("Output format:", salaryQ.output_format);
    console.log("Test Cases:");
    for (const tc of salaryQ.test_cases || []) {
      console.log(`  TC id: ${tc.id}, sample: ${tc.is_sample}, hidden: ${tc.is_hidden}`);
      console.log(`    Input:\n${tc.input}`);
      console.log(`    Expected Output:\n${tc.expected_output}`);
      // Calculate true expected output
      try {
        const lines = tc.input.trim().split("\n");
        const n = parseInt(lines[0].trim());
        const salaries = lines[1].trim().split(/\s+/).map(Number);
        const avg = salaries.reduce((a: number, b: number) => a + b, 0) / n;
        const above = salaries.filter((s: number) => s > avg).length;
        console.log(`    Math Calculation: avg=${avg.toFixed(1)}, above=${above}`);
        console.log(`    Expected matches Math? ${tc.expected_output.includes(above.toString()) ? "YES" : "NO (MISMATCH: stored has " + tc.expected_output + ", math is " + above + ")"}`);
      } catch (err: any) {
        console.log("    Math parse error:", err.message);
      }
    }
    console.log("");
  }

  // 2. Two Sum
  const twoSumQ = codingQs?.find((q) => q.title.toLowerCase() === "two sum");
  if (twoSumQ) {
    console.log(`[Flagged Question 2] "${twoSumQ.title}" (ID: ${twoSumQ.id})`);
    console.log("Description:", twoSumQ.description);
    console.log("Input format:", twoSumQ.input_format);
    console.log("Output format:", twoSumQ.output_format);
    console.log("Test Cases:");
    for (const tc of twoSumQ.test_cases || []) {
      console.log(`  TC id: ${tc.id}, sample: ${tc.is_sample}, hidden: ${tc.is_hidden}`);
      console.log(`    Input:\n${tc.input}`);
      console.log(`    Expected Output:\n${tc.expected_output}`);
    }
    console.log("");
  }

  console.log(`Total questions analyzed: ${report.length}`);
}

main().catch(console.error);
