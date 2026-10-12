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

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function auditAll() {
  const contestId = "53ddc9ea-6672-434d-9933-22c83f8ebd65";

  // 1. Get contest questions
  const { data: cqs } = await supabase
    .from("contest_questions")
    .select("*")
    .eq("contest_id", contestId)
    .order("sort_order", { ascending: true });

  const mcqIds = cqs?.filter((q) => q.question_type === "mcq").map((q) => q.question_id) || [];
  const pythonIds = cqs?.filter((q) => q.question_type === "coding").map((q) => q.question_id) || [];
  const sqlIds = cqs?.filter((q) => q.question_type === "sql").map((q) => q.question_id) || [];

  // Get correct options for all MCQs
  const { data: mcqOpts } = await supabase
    .from("mcq_options")
    .select("question_id, id, is_correct")
    .in("question_id", mcqIds)
    .eq("is_correct", true);
  const correctOptMap = new Map(mcqOpts?.map((o) => [o.question_id, o.id]));

  // 2. Get all participants
  const { data: participants } = await supabase
    .from("contest_participants")
    .select("*, user_profile:profiles(*)")
    .eq("contest_id", contestId);

  console.log(`\n================================================================================`);
  console.log(`PLATFORM-WIDE AUDIT: CONTEST ${contestId} (${participants?.length} PARTICIPANTS)`);
  console.log(`Configured Questions: 15 MCQs (@ 4), 5 Python (@ 4), 5 SQL (@ 4). Total: 100 marks`);
  console.log(`================================================================================\n`);

  const results: any[] = [];

  for (const p of participants || []) {
    const prof = p.user_profile;
    const name = prof?.full_name || prof?.display_name || "N/A";
    const email = prof?.email || "N/A";
    const studentId = prof?.student_id || "N/A";

    // Fetch MCQs
    const { data: answers } = await supabase
      .from("mcq_answers")
      .select("*")
      .eq("contest_id", contestId)
      .eq("user_id", p.user_id);

    let mcqCorrect = 0;
    for (const a of answers || []) {
      if (a.selected_option_id && a.selected_option_id === correctOptMap.get(a.question_id)) {
        mcqCorrect++;
      }
    }
    const mcqScore = mcqCorrect * 4;

    // Fetch Coding
    const { data: subs } = await supabase
      .from("coding_submissions")
      .select("*")
      .eq("contest_id", contestId)
      .eq("user_id", p.user_id);

    const nonDraftSubs = subs?.filter((s) => s.verdict !== "DRAFT") || [];
    
    // Python scores
    const pythonBest = new Map<string, number>();
    for (const s of nonDraftSubs) {
      if (pythonIds.includes(s.question_id)) {
        const cur = pythonBest.get(s.question_id) || 0;
        if (s.score > cur) pythonBest.set(s.question_id, s.score);
      }
    }
    let pythonScore = 0;
    for (const sc of pythonBest.values()) pythonScore += sc;
    const pythonSolved = Array.from(pythonBest.values()).filter((sc) => sc > 0).length;

    // SQL scores in DB
    const sqlBest = new Map<string, number>();
    for (const s of nonDraftSubs) {
      if (sqlIds.includes(s.question_id)) {
        const cur = sqlBest.get(s.question_id) || 0;
        if (s.score > cur) sqlBest.set(s.question_id, s.score);
      }
    }
    let sqlScore = 0;
    for (const sc of sqlBest.values()) sqlScore += sc;
    const sqlSolved = Array.from(sqlBest.values()).filter((sc) => sc > 0).length;

    const dbRecalculatedScore = mcqScore + pythonScore + sqlScore;
    const dbRecalculatedSolved = mcqCorrect + pythonSolved + sqlSolved;
    const frozenScore = p.score;
    const scoreDiff = dbRecalculatedScore - frozenScore;

    results.push({
      name,
      email,
      studentId,
      status: p.status,
      frozenScore,
      dbRecalculatedScore,
      scoreDiff,
      mcqCorrect: `${mcqCorrect}/15 (${mcqScore} pts)`,
      pythonSolved: `${pythonSolved}/5 (${pythonScore} pts)`,
      sqlSolved: `${sqlSolved}/5 (${sqlScore} pts)`,
      totalSolved: `${dbRecalculatedSolved}/25`,
    });
  }

  console.table(results);
}

auditAll().catch(console.error);
