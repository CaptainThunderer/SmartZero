import * as fs from "node:fs";
import * as path from "node:path";
import * as XLSX from "xlsx";

const SAMPLE_QUESTIONS_JSON = [
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
    type: "mcq",
    question_text: "Which of the following data structures operates on a First-In-First-Out (FIFO) basis?",
    explanation: "A Queue processes elements in the order they arrive (FIFO).",
    difficulty: "Easy",
    marks: 2,
    negative_marks: 0,
    options: [
      { option_text: "Queue", is_correct: true },
      { option_text: "Stack", is_correct: false },
      { option_text: "Binary Tree", is_correct: false },
      { option_text: "Graph", is_correct: false },
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
      {
        input: "-1000 -2000",
        expected_output: "-3000",
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
    hidden_input: "",
    hidden_output: "",
    constraints: "",
    input_format: "",
    output_format: "",
  },
  {
    type: "mcq",
    question_text: "Which of the following data structures operates on a First-In-First-Out (FIFO) basis?",
    title: "",
    description: "",
    difficulty: "Easy",
    marks: 2,
    negative_marks: 0,
    explanation: "A Queue processes elements in FIFO order.",
    option_a: "Queue",
    option_b: "Stack",
    option_c: "Binary Tree",
    option_d: "Priority Queue",
    correct_answer: "A",
    sample_input: "",
    sample_output: "",
    hidden_input: "",
    hidden_output: "",
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
    hidden_input: "100 200",
    hidden_output: "300",
    constraints: "-10^9 <= A, B <= 10^9",
    input_format: "Two integers A and B separated by space.",
    output_format: "Single integer A + B.",
  },
];

function generateFiles() {
  const dirs = [
    path.resolve(process.cwd(), "examples/import"),
    path.resolve(process.cwd(), "public/templates"),
  ];

  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  // 1. JSON
  const jsonContent = JSON.stringify(SAMPLE_QUESTIONS_JSON, null, 2);
  fs.writeFileSync(path.resolve(dirs[0], "example_questions.json"), jsonContent, "utf-8");
  fs.writeFileSync(path.resolve(dirs[1], "smartzero_questions_template.json"), jsonContent, "utf-8");

  // 2. CSV
  const worksheet = XLSX.utils.json_to_sheet(SPREADSHEET_ROWS);
  const csvContent = XLSX.utils.sheet_to_csv(worksheet);
  fs.writeFileSync(path.resolve(dirs[0], "example_questions.csv"), csvContent, "utf-8");
  fs.writeFileSync(path.resolve(dirs[1], "smartzero_questions_template.csv"), csvContent, "utf-8");

  // 3. XLSX
  const workbookXlsx = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbookXlsx, worksheet, "Questions");
  const xlsxBuffer = XLSX.write(workbookXlsx, { type: "buffer", bookType: "xlsx" });
  fs.writeFileSync(path.resolve(dirs[0], "example_questions.xlsx"), xlsxBuffer);
  fs.writeFileSync(path.resolve(dirs[1], "smartzero_questions_template.xlsx"), xlsxBuffer);

  // 4. XLS (BIFF8)
  const workbookXls = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbookXls, worksheet, "Questions");
  const xlsBuffer = XLSX.write(workbookXls, { type: "buffer", bookType: "biff8" });
  fs.writeFileSync(path.resolve(dirs[0], "example_questions.xls"), xlsBuffer);
  fs.writeFileSync(path.resolve(dirs[1], "smartzero_questions_template.xls"), xlsBuffer);

  console.log("Successfully generated all example and template files in JSON, CSV, XLSX, and XLS formats!");
}

generateFiles();
