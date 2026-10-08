import { createSupabaseAdminClient } from "../lib/supabase-server";
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

async function investigate() {
  const supabase = createSupabaseAdminClient()!;
  
  const { data: qPython, error: err1 } = await supabase.from("coding_questions").select("id, title, test_cases").ilike("title", "%Bank Transaction%").limit(1);
  if (err1) console.error("Python err:", err1);
  if (qPython && qPython.length > 0) {
      const q = qPython[0];
      if (q.test_cases) {
          const sample = q.test_cases.find((t: any) => t.is_sample);
          if (sample) {
              console.log("Python expected_output (json stringified):", JSON.stringify(sample.expected_output));
              const expected = sample.expected_output;
              console.log("Expected chars:", expected.split('').map((c: string) => c.charCodeAt(0)).join(', '));
          } else {
              console.log("No sample test case for Python question.");
          }
      } else {
          console.log("Python question has no test_cases column data.");
      }
  }

  const { data: qSql, error: err2 } = await supabase.from("sql_questions").select("id, title, schema_sql, sample_data_sql, test_cases").ilike("title", "%Student Database%").limit(1);
  if (err2) console.error("SQL err:", err2);
  if (qSql && qSql.length > 0) {
      const q = qSql[0];
      console.log("SQL Question ID:", q.id);
      if (q.test_cases) {
          console.log("SQL test_cases length:", q.test_cases.length);
          const sample = q.test_cases.find((t: any) => t.is_sample);
          if (sample) {
              console.log("SQL sample setup_sql:", JSON.stringify(sample.setup_sql));
          }
      }
      console.log("SQL schema_sql:", JSON.stringify(q.schema_sql));
      console.log("SQL sample_data_sql:", JSON.stringify(q.sample_data_sql));
  }
}

investigate();
