import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";

// Load .env.local
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

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log("=== SUPABASE DIAGNOSTIC CONFIGURATION ===");
console.log("NEXT_PUBLIC_SUPABASE_URL configured:", !!url);
console.log("SUPABASE_SERVICE_ROLE_KEY configured:", !!serviceKey);

if (!url || !serviceKey) {
  console.log("Cannot query: Missing URL or Service Role Key.");
} else {
  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false },
  });

  async function queryTest1() {
    console.log("\n=== QUERYING 'Test 1' CONTEST CONFIGURATION ===");
    const { data: contests, error: cErr } = await supabase
      .from("contests")
      .select("id, title, slug, allow_retake, max_attempts, start_at, end_at, duration_minutes, status")
      .ilike("title", "%Test 1%");

    if (cErr) {
      console.log("Contest query error:", cErr.message);
      return;
    }

    console.log("Found contests matching 'Test 1':", contests?.length || 0);
    if (contests && contests.length > 0) {
      for (const c of contests) {
        console.log({
          id: c.id,
          title: c.title,
          slug: c.slug,
          allow_retake: c.allow_retake,
          max_attempts: c.max_attempts,
          start_at: c.start_at,
          end_at: c.end_at,
          duration_minutes: c.duration_minutes,
          status: c.status,
        });

        // Query participant records for this contest
        const { data: participants, error: pErr } = await supabase
          .from("contest_participants")
          .select("id, contest_id, user_id, attempt_number, status, score, started_at, completed_at, auto_submitted, submission_reason, violations_count")
          .eq("contest_id", c.id);

        if (pErr) {
          console.log(`Participants query error for ${c.title}:`, pErr.message);
        } else {
          console.log(`Participants for contest ${c.title} (${c.id}):`, participants?.length || 0);
          for (const p of participants || []) {
            console.log("  Participant:", p);
          }
        }
      }
    }
  }

  queryTest1();
}
