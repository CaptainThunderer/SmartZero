import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

async function run() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL + "/rest/v1/coding_submissions?select=*,coding_questions!inner(title)&coding_questions.title=ilike.%Bank%20Transaction%&order=submitted_at.desc&limit=10";
  const res = await fetch(url, {
    headers: {
      "apikey": process.env.SUPABASE_SERVICE_ROLE_KEY!,
      "Authorization": "Bearer " + process.env.SUPABASE_SERVICE_ROLE_KEY!
    }
  });
  const data = await res.json();
  for (const sub of data) {
    if (sub.test_case_results && sub.test_case_results.length > 0) {
      const sample = sub.test_case_results.find((t: any) => t.is_sample);
      if (sample && sample.actual_output) {
        console.log("Verdict:", sub.verdict);
        console.log("ACTUAL:", JSON.stringify(sample.actual_output));
        console.log("ACTUAL chars:", sample.actual_output.split('').map((c: string) => c.charCodeAt(0)).join(','));
        console.log("EXPECTED:", JSON.stringify(sample.expected_output));
        console.log("EXPECTED chars:", sample.expected_output.split('').map((c: string) => c.charCodeAt(0)).join(','));
        break;
      }
    }
  }
}
run();
