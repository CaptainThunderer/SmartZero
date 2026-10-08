import { createSupabaseAdminClient } from "../lib/supabase-server";
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

async function investigate() {
  const supabase = createSupabaseAdminClient()!;
  
  const { data: submissions } = await supabase
    .from("coding_submissions")
    .select("*, coding_questions!inner(title)")
    .ilike("coding_questions.title", "%Bank Transaction%")
    .order("submitted_at", { ascending: false })
    .limit(10);

  if (submissions) {
      for (const sub of submissions) {
          if (sub.test_case_results && sub.test_case_results.length > 0) {
              const sampleResult = sub.test_case_results.find((t: any) => t.is_sample);
              if (sampleResult && sampleResult.actual_output) {
                  console.log("Found Submission:", sub.id, "Verdict:", sub.verdict);
                  console.log("Actual Output (JSON):", JSON.stringify(sampleResult.actual_output));
                  console.log("Actual Output char codes:", sampleResult.actual_output.split('').map((c: string) => c.charCodeAt(0)).join(', '));
                  console.log("Expected Output (JSON):", JSON.stringify(sampleResult.expected_output));
                  console.log("Expected Output char codes:", sampleResult.expected_output.split('').map((c: string) => c.charCodeAt(0)).join(', '));
                  break;
              }
          }
      }
  }
}

investigate();
