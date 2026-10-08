import { createSupabaseAdminClient } from "../lib/supabase-server";
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

async function investigate() {
  const supabase = createSupabaseAdminClient()!;
  
  const { data: qPython } = await supabase
    .from("coding_questions")
    .select("*, test_cases:coding_test_cases(*)")
    .ilike("title", "%Bank Transaction%")
    .limit(1)
    .single();

  if (qPython && qPython.test_cases) {
      const sample = qPython.test_cases.find((t: any) => t.is_sample);
      if (sample) {
          console.log("Python Expected (JSON):", JSON.stringify(sample.expected_output));
          console.log("Python Expected char codes:", sample.expected_output.split('').map((c: string) => c.charCodeAt(0)).join(', '));
      }
  }

  const { data: qSql } = await supabase
    .from("sql_questions")
    .select("*, test_cases:sql_test_cases(*)")
    .ilike("title", "%Student Database%")
    .limit(1)
    .single();

  if (qSql) {
      console.log("SQL Schema SQL (JSON):", JSON.stringify(qSql.schema_sql));
      console.log("SQL Sample Data SQL (JSON):", JSON.stringify(qSql.sample_data_sql));
      if (qSql.test_cases) {
          const sample = qSql.test_cases.find((t: any) => t.is_sample);
          if (sample) {
              console.log("SQL Sample Test Setup SQL:", JSON.stringify(sample.setup_sql));
          }
      }
  }
}

investigate();
