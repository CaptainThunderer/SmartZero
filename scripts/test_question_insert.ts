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

async function testInsert() {
  console.log("=== TESTING QUESTION INSERTS INTO SUPABASE ===");

  // 1. Insert MCQ question
  const { data: mcq, error: mcqErr } = await supabase
    .from("mcq_questions")
    .insert({
      question_text: "What is the time complexity of binary search?",
      explanation: "Binary search divides the search space in half at each step.",
      difficulty: "Easy",
    })
    .select()
    .single();

  if (mcqErr) {
    console.error("MCQ insert error:", mcqErr);
    return;
  }
  console.log("MCQ inserted successfully:", mcq.id);

  // 2. Insert Options
  const { data: opts, error: optErr } = await supabase
    .from("mcq_options")
    .insert([
      { question_id: mcq.id, option_text: "O(1)", is_correct: false, sort_order: 0 },
      { question_id: mcq.id, option_text: "O(log n)", is_correct: true, sort_order: 1 },
      { question_id: mcq.id, option_text: "O(n)", is_correct: false, sort_order: 2 },
      { question_id: mcq.id, option_text: "O(n^2)", is_correct: false, sort_order: 3 },
    ])
    .select();

  if (optErr) {
    console.error("Options insert error:", optErr);
    return;
  }
  console.log("Options inserted successfully count:", opts.length);

  // 3. Insert Coding question
  const { data: codeQ, error: codeErr } = await supabase
    .from("coding_questions")
    .insert({
      title: "Two Sum",
      description: "Find two numbers that add up to target.",
      difficulty: "Easy",
      time_limit_ms: 2000,
      memory_limit_mb: 256,
    })
    .select()
    .single();

  if (codeErr) {
    console.error("Coding question insert error:", codeErr);
    return;
  }
  console.log("Coding question inserted successfully:", codeQ.id);

  // 4. Insert Test Cases
  const { data: tcs, error: tcErr } = await supabase
    .from("coding_test_cases")
    .insert([
      { question_id: codeQ.id, input: "2 7 11 15\n9", expected_output: "0 1", is_sample: true, is_hidden: false, weight: 1, sort_order: 0 },
      { question_id: codeQ.id, input: "3 2 4\n6", expected_output: "1 2", is_sample: false, is_hidden: true, weight: 1, sort_order: 1 },
    ])
    .select();

  if (tcErr) {
    console.error("Test cases insert error:", tcErr);
    return;
  }
  console.log("Test cases inserted successfully count:", tcs.length);

  // Clean up test rows
  await supabase.from("mcq_questions").delete().eq("id", mcq.id);
  await supabase.from("coding_questions").delete().eq("id", codeQ.id);
  console.log("Cleanup completed.");
}

testInsert();
