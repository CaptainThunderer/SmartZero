import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

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

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(url, key);

async function check() {
  const tables = ["coding_drafts", "coding_answers", "coding_submissions", "mcq_answers", "contest_questions", "mcq_questions", "mcq_options", "coding_questions", "coding_test_cases"];
  for (const t of tables) {
    const { error } = await supabase.from(t).select("id").limit(1);
    console.log(`Table ${t}:`, error ? `ERROR: ${error.message} (${error.code})` : "EXISTS");
  }
}

check();
