import { createSupabaseAdminClient } from "../lib/supabase-server";
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

async function run() {
  const supabase = createSupabaseAdminClient()!;
  const { data } = await supabase.from('sql_questions').select('*, test_cases:sql_test_cases(*)').ilike('title', '%Student Database%').single();
  console.log('Test Cases:', data?.test_cases.map((tc: any) => ({ id: tc.id, is_sample: tc.is_sample, setup_sql_len: tc.setup_sql?.length })));
  process.exit(0);
}
run();
