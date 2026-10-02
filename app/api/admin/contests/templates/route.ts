import { NextResponse } from "next/server";
import * as XLSX from "xlsx";

const SAMPLE_JSON = [
  {
    type: "mcq",
    question_text: "What is the time complexity of searching an element in a balanced Binary Search Tree (BST)?",
    explanation: "In a balanced BST with N nodes, the height is O(log N), so search runs in O(log N) time.",
    difficulty: "Easy",
    marks: 2,
    negative_marks: 0.5,
    options: [
      { option_text: "O(log N)", is_correct: true },
      { option_text: "O(N)", is_correct: false },
      { option_text: "O(1)", is_correct: false },
      { option_text: "O(N log N)", is_correct: false },
    ],
  },
  {
    type: "coding",
    title: "Two Sum Problem",
    description: "Given two space-separated integers A and B on standard input, output their sum (A + B).",
    input_format: "A single line containing two integers A and B separated by space.",
    output_format: "A single integer denoting the sum A + B.",
    constraints: "-10^9 <= A, B <= 10^9",
    difficulty: "Easy",
    marks: 10,
    time_limit_ms: 2000,
    memory_limit_mb: 256,
    test_cases: [
      {
        input: "4 7",
        expected_output: "11",
        is_sample: true,
        is_hidden: false,
        weight: 1,
      },
      {
        input: "-5 12",
        expected_output: "7",
        is_sample: true,
        is_hidden: false,
        weight: 1,
      },
      {
        input: "100 200",
        expected_output: "300",
        is_sample: false,
        is_hidden: true,
        weight: 2,
      },
    ],
  },
];

const SPREADSHEET_ROWS = [
  {
    type: "mcq",
    question_text: "What is the time complexity of searching in a balanced BST?",
    title: "",
    description: "",
    difficulty: "Easy",
    marks: 2,
    negative_marks: 0.5,
    explanation: "In a balanced BST with N nodes, the height is O(log N).",
    option_a: "O(log N)",
    option_b: "O(N)",
    option_c: "O(1)",
    option_d: "O(N log N)",
    correct_answer: "A",
    sample_input: "",
    sample_output: "",
    constraints: "",
    input_format: "",
    output_format: "",
  },
  {
    type: "coding",
    question_text: "",
    title: "Two Sum Problem",
    description: "Given two space-separated integers A and B on standard input, output their sum (A + B).",
    difficulty: "Easy",
    marks: 10,
    negative_marks: 0,
    explanation: "",
    option_a: "",
    option_b: "",
    option_c: "",
    option_d: "",
    correct_answer: "",
    sample_input: "4 7",
    sample_output: "11",
    constraints: "-10^9 <= A, B <= 10^9",
    input_format: "Two integers A and B separated by space.",
    output_format: "Single integer A + B.",
  },
];

export async function GET(req: Request) {
  const url = new URL(req.url);
  const format = (url.searchParams.get("format") || "json").toLowerCase();

  if (format === "json") {
    const jsonString = JSON.stringify(SAMPLE_JSON, null, 2);
    return new NextResponse(jsonString, {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": 'attachment; filename="smartzero_questions_template.json"',
      },
    });
  }

  if (format === "csv") {
    const worksheet = XLSX.utils.json_to_sheet(SPREADSHEET_ROWS);
    const csvContent = XLSX.utils.sheet_to_csv(worksheet);
    return new NextResponse(csvContent, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="smartzero_questions_template.csv"',
      },
    });
  }

  if (format === "xlsx") {
    const worksheet = XLSX.utils.json_to_sheet(SPREADSHEET_ROWS);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Questions");
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="smartzero_questions_template.xlsx"',
      },
    });
  }

  return NextResponse.json({ error: "Unsupported format. Use ?format=json, csv, or xlsx." }, { status: 400 });
}
