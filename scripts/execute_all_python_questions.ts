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
import { defaultJudgeWorker, compareOutputs, normalizeOutput } from "../lib/judge/worker/worker";

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  console.log("==================================================");
  console.log("EXECUTION-BASED AUDIT OF ALL PYTHON CODING QUESTIONS");
  console.log("==================================================\n");

  const { data: contests } = await supabase.from("contests").select("id, title, slug");
  const { data: links } = await supabase.from("contest_questions").select("*");
  const { data: codingQs } = await supabase
    .from("coding_questions")
    .select("*, test_cases:coding_test_cases(*)");

  console.log(`Loaded ${codingQs?.length || 0} coding questions from database.`);
  console.log(`Loaded ${links?.length || 0} contest linkages across ${contests?.length || 0} contests.`);

  const contestMap = new Map((contests || []).map((c) => [c.id, c.title]));
  const codingLinks = (links || []).filter((l) => l.question_type === "coding");
  console.log(`Found ${codingLinks.length} contest question links of type 'coding'.`);

  // Group by unique coding questions linked across contests
  const uniqueLinkedQMap = new Map<string, any>();
  for (const link of codingLinks) {
    const q = codingQs?.find((c) => c.id === link.question_id);
    if (q) {
      if (!uniqueLinkedQMap.has(q.id)) {
        uniqueLinkedQMap.set(q.id, {
          question: q,
          contests: [contestMap.get(link.contest_id) || link.contest_id],
        });
      } else {
        uniqueLinkedQMap.get(q.id).contests.push(contestMap.get(link.contest_id) || link.contest_id);
      }
    }
  }

  console.log(`Unique linked coding questions: ${uniqueLinkedQMap.size}`);

  // Also check all coding questions in the platform
  console.log("\nAuditing all coding questions in database...");
  
  // Let's inspect all questions and see their titles and test cases
  const allResults: any[] = [];
  
  for (const q of codingQs || []) {
    const tcs = q.test_cases || [];
    const linkInfo = uniqueLinkedQMap.get(q.id);
    allResults.push({
      id: q.id,
      title: q.title,
      isLinked: !!linkInfo,
      contests: linkInfo ? linkInfo.contests : [],
      tcCount: tcs.length,
      sampleTc: tcs[0],
    });
  }

  // Print summary of questions
  console.log("\nListing questions:");
  for (let i = 0; i < allResults.length; i++) {
    const r = allResults[i];
    console.log(`${i + 1}. [${r.isLinked ? "LINKED" : "UNLINKED"}] "${r.title}" (ID: ${r.id}) - ${r.tcCount} test cases - Contests: ${r.contests.join(", ") || "None"}`);
  }
}

main().catch(console.error);
