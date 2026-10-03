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

async function inspect() {
  console.log("=== INSPECTING CONTEST QUESTIONS & ANSWERS ===");
  const test1Id = "50c16ffe-c654-4ad0-bbb9-edc09c1b0165";

  // Check contest_questions
  const { data: cqs, error: cqErr } = await supabase
    .from("contest_questions")
    .select("*")
    .eq("contest_id", test1Id);
  console.log("contest_questions count:", cqs?.length || 0, cqErr ? `Error: ${cqErr.message}` : "");
  if (cqs && cqs.length > 0) {
    console.log("Linked questions:", cqs);
  }

  // Check mcq_questions in bank
  const { data: mcqs, error: mcqErr } = await supabase
    .from("mcq_questions")
    .select("id, question_text");
  console.log("Total mcq_questions in bank:", mcqs?.length || 0);

  // Check coding_questions in bank
  const { data: codeQs, error: codeErr } = await supabase
    .from("coding_questions")
    .select("id, title");
  console.log("Total coding_questions in bank:", codeQs?.length || 0);

  // Check mcq_answers
  const { data: answers, error: ansErr } = await supabase
    .from("mcq_answers")
    .select("*")
    .eq("contest_id", test1Id);
  console.log("mcq_answers count for Test 1:", answers?.length || 0);
  if (answers && answers.length > 0) {
    console.log("Sample answers:", answers.slice(0, 3));
  }
}

inspect();
