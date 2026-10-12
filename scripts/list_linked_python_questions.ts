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

  const { data: contests } = await sb.from("contests").select("id, title, slug");
  const { data: links } = await sb.from("contest_questions").select("*");
  const { data: qs } = await sb
    .from("coding_questions")
    .select("id, title, test_cases:coding_test_cases(id)");

  const cMap = new Map((contests || []).map((c) => [c.id, c.title]));
  const codingLinks = (links || []).filter((l) => l.question_type === "coding");

  const seen = new Set<string>();
  const table: any[] = [];

  for (const l of codingLinks) {
    if (!seen.has(l.question_id)) {
      seen.add(l.question_id);
      const q = qs?.find((x) => x.id === l.question_id);
      table.push({
        index: table.length + 1,
        title: q ? q.title : "UNKNOWN",
        id: l.question_id,
        contest: cMap.get(l.contest_id) || l.contest_id,
        tcCount: q ? q.test_cases?.length || 0 : 0,
      });
    }
  }

  console.log(`Found ${table.length} unique linked Python questions:\n`);
  for (const r of table) {
    console.log(
      `${r.index.toString().padStart(2, " ")}. [${r.contest.padEnd(16, " ")}] "${r.title}" (ID: ${r.id}, TCs: ${r.tcCount})`
    );
  }
}

run().catch(console.error);
