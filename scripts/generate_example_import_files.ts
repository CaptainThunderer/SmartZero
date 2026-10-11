import * as fs from "node:fs";
import * as path from "node:path";
import * as XLSX from "xlsx";

export const SAMPLE_QUESTIONS = [
  {
    type: "mcq",
    question_text: "Phani is cleaning a dataset in Pandas. Which method should he use to remove all rows containing at least one NaN value?",
    explanation: "The dropna() method removes missing values (NaN) from a DataFrame.",
    difficulty: "Medium",
    marks: 2,
    negative_marks: 0.5,
    options: [
      { option_text: "df.dropna()", is_correct: true },
      { option_text: "df.fillna()", is_correct: false },
      { option_text: "df.remove_nan()", is_correct: false },
      { option_text: "df.drop_null()", is_correct: false },
    ],
  },
  {
    type: "mcq",
    question_text: "Sarva anna is analyzing sales data in SQL. Which clause should he use to filter the results of an aggregation like COUNT() > 5?",
    explanation: "The HAVING clause is used to filter groups based on aggregate functions.",
    difficulty: "Easy",
    marks: 2,
    negative_marks: 0.5,
    options: [
      { option_text: "HAVING", is_correct: true },
      { option_text: "WHERE", is_correct: false },
      { option_text: "FILTER", is_correct: false },
      { option_text: "GROUP BY", is_correct: false },
    ],
  },
  {
    type: "mcq",
    question_text: "Raghavi is using Excel to look up a value in the leftmost column of a table. Which function is most appropriate?",
    explanation: "VLOOKUP searches for a value in the first column of a table array and returns a value in the same row from another column.",
    difficulty: "Easy",
    marks: 2,
    negative_marks: 0,
    options: [
      { option_text: "VLOOKUP", is_correct: true },
      { option_text: "HLOOKUP", is_correct: false },
      { option_text: "MATCH", is_correct: false },
      { option_text: "INDEX", is_correct: false },
    ],
  },
  {
    type: "coding",
    title: "Data Guide Python Challenge",
    description: "Srishanth wants to find the sum of all elements in an array of integers that are strictly greater than the array's average. Write a program to help him.",
    input_format: "The first line contains N, the number of elements.\nThe second line contains N space-separated integers.",
    output_format: "A single integer denoting the sum of elements greater than the average.",
    constraints: "1 <= N <= 10^5\n-1000 <= array[i] <= 1000",
    difficulty: "Medium",
    time_limit_ms: 2000,
    memory_limit_mb: 256,
    marks: 10,
    test_cases: [
      {
        input: "5\n10 20 30 40 50",
        expected_output: "90",
        is_sample: true,
        is_hidden: false,
        weight: 1,
      },
      {
        input: "4\n-5 10 15 20",
        expected_output: "35",
        is_sample: false,
        is_hidden: true,
        weight: 2,
      },
    ],
  },
  {
    type: "sql",
    title: "Kaushik Anna's Tech Store",
    description: "Kaushik anna wants a list of all products in his store that cost more than $50.00, sorted by price in descending order. Write the SQL query to retrieve the name and price.",
    difficulty: "Medium",
    time_limit_ms: 2000,
    marks: 15,
    schema_sql: "CREATE TABLE products (id INTEGER PRIMARY KEY, name TEXT NOT NULL, price REAL NOT NULL, category TEXT);",
    sample_data_sql: "INSERT INTO products VALUES (1, 'Mechanical Keyboard', 120.50, 'Electronics'), (2, 'Mousepad', 15.00, 'Accessories'), (3, 'Wireless Mouse', 65.00, 'Electronics');",
    sample_expected_output: "name | price\nMechanical Keyboard | 120.5\nWireless Mouse | 65.0",
    order_sensitive: true,
    test_cases: [
      {
        setup_sql: "INSERT INTO products VALUES (1, 'Mechanical Keyboard', 120.50, 'Electronics'), (2, 'Mousepad', 15.00, 'Accessories'), (3, 'Wireless Mouse', 65.00, 'Electronics');",
        expected_output: "name | price\nMechanical Keyboard | 120.5\nWireless Mouse | 65.0",
        is_sample: true,
        is_hidden: false,
        weight: 1,
      },
      {
        setup_sql: "INSERT INTO products VALUES (1, 'Mechanical Keyboard', 120.50, 'Electronics'), (2, 'Mousepad', 15.00, 'Accessories'), (3, 'Wireless Mouse', 65.00, 'Electronics'), (4, 'Monitor', 300.00, 'Electronics');",
        expected_output: "name | price\nMonitor | 300.0\nMechanical Keyboard | 120.5\nWireless Mouse | 65.0",
        is_sample: false,
        is_hidden: true,
        weight: 2,
      },
    ],
  },
];

export const SPREADSHEET_ROWS = [
  {
    type: "mcq",
    question_text: "Phani is cleaning a dataset in Pandas. Which method should he use to remove all rows containing at least one NaN value?",
    title: "",
    description: "",
    difficulty: "Medium",
    marks: 2,
    negative_marks: 0.5,
    explanation: "The dropna() method removes missing values (NaN) from a DataFrame.",
    option_a: "df.dropna()",
    option_b: "df.fillna()",
    option_c: "df.remove_nan()",
    option_d: "df.drop_null()",
    correct_answer: "A",
    sample_input: "",
    sample_output: "",
    hidden_input: "",
    hidden_output: "",
    constraints: "",
    input_format: "",
    output_format: "",
    schema_sql: "",
    sample_data_sql: "",
    sample_expected_output: "",
    order_sensitive: "",
    test_cases: "",
  },
  {
    type: "mcq",
    question_text: "Sarva anna is analyzing sales data in SQL. Which clause should he use to filter the results of an aggregation like COUNT() > 5?",
    title: "",
    description: "",
    difficulty: "Easy",
    marks: 2,
    negative_marks: 0.5,
    explanation: "The HAVING clause is used to filter groups based on aggregate functions.",
    option_a: "HAVING",
    option_b: "WHERE",
    option_c: "FILTER",
    option_d: "GROUP BY",
    correct_answer: "A",
    sample_input: "",
    sample_output: "",
    hidden_input: "",
    hidden_output: "",
    constraints: "",
    input_format: "",
    output_format: "",
    schema_sql: "",
    sample_data_sql: "",
    sample_expected_output: "",
    order_sensitive: "",
    test_cases: "",
  },
  {
    type: "mcq",
    question_text: "Raghavi is using Excel to look up a value in the leftmost column of a table. Which function is most appropriate?",
    title: "",
    description: "",
    difficulty: "Easy",
    marks: 2,
    negative_marks: 0,
    explanation: "VLOOKUP searches for a value in the first column of a table array and returns a value in the same row from another column.",
    option_a: "VLOOKUP",
    option_b: "HLOOKUP",
    option_c: "MATCH",
    option_d: "INDEX",
    correct_answer: "A",
    sample_input: "",
    sample_output: "",
    hidden_input: "",
    hidden_output: "",
    constraints: "",
    input_format: "",
    output_format: "",
    schema_sql: "",
    sample_data_sql: "",
    sample_expected_output: "",
    order_sensitive: "",
    test_cases: "",
  },
  {
    type: "coding",
    question_text: "",
    title: "Data Guide Python Challenge",
    description: "Srishanth wants to find the sum of all elements in an array of integers that are strictly greater than the array's average. Write a program to help him.",
    difficulty: "Medium",
    marks: 10,
    negative_marks: 0,
    explanation: "",
    option_a: "",
    option_b: "",
    option_c: "",
    option_d: "",
    correct_answer: "",
    sample_input: "5\n10 20 30 40 50",
    sample_output: "90",
    hidden_input: "4\n-5 10 15 20",
    hidden_output: "35",
    constraints: "1 <= N <= 10^5\n-1000 <= array[i] <= 1000",
    input_format: "The first line contains N, the number of elements.\nThe second line contains N space-separated integers.",
    output_format: "A single integer denoting the sum of elements greater than the average.",
    schema_sql: "",
    sample_data_sql: "",
    sample_expected_output: "",
    order_sensitive: "",
    test_cases: JSON.stringify([
      {
        input: "5\n10 20 30 40 50",
        expected_output: "90",
        is_sample: true,
        is_hidden: false,
        weight: 1,
      },
      {
        input: "4\n-5 10 15 20",
        expected_output: "35",
        is_sample: false,
        is_hidden: true,
        weight: 2,
      },
    ]),
  },
  {
    type: "sql",
    question_text: "",
    title: "Kaushik Anna's Tech Store",
    description: "Kaushik anna wants a list of all products in his store that cost more than $50.00, sorted by price in descending order. Write the SQL query to retrieve the name and price.",
    difficulty: "Medium",
    marks: 15,
    negative_marks: 0,
    explanation: "",
    option_a: "",
    option_b: "",
    option_c: "",
    option_d: "",
    correct_answer: "",
    sample_input: "",
    sample_output: "",
    hidden_input: "",
    hidden_output: "",
    constraints: "",
    input_format: "",
    output_format: "",
    schema_sql: "CREATE TABLE products (id INTEGER PRIMARY KEY, name TEXT NOT NULL, price REAL NOT NULL, category TEXT);",
    sample_data_sql: "INSERT INTO products VALUES (1, 'Mechanical Keyboard', 120.50, 'Electronics'), (2, 'Mousepad', 15.00, 'Accessories'), (3, 'Wireless Mouse', 65.00, 'Electronics');",
    sample_expected_output: "name | price\nMechanical Keyboard | 120.5\nWireless Mouse | 65.0",
    order_sensitive: true,
    test_cases: JSON.stringify([
      {
        setup_sql: "INSERT INTO products VALUES (1, 'Mechanical Keyboard', 120.50, 'Electronics'), (2, 'Mousepad', 15.00, 'Accessories'), (3, 'Wireless Mouse', 65.00, 'Electronics');",
        expected_output: "name | price\nMechanical Keyboard | 120.5\nWireless Mouse | 65.0",
        is_sample: true,
        is_hidden: false,
        weight: 1,
      },
      {
        setup_sql: "INSERT INTO products VALUES (1, 'Mechanical Keyboard', 120.50, 'Electronics'), (2, 'Mousepad', 15.00, 'Accessories'), (3, 'Wireless Mouse', 65.00, 'Electronics'), (4, 'Monitor', 300.00, 'Electronics');",
        expected_output: "name | price\nMonitor | 300.0\nMechanical Keyboard | 120.5\nWireless Mouse | 65.0",
        is_sample: false,
        is_hidden: true,
        weight: 2,
      },
    ]),
  },
];

export function generateFiles() {
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
  const jsonContent = JSON.stringify(SAMPLE_QUESTIONS, null, 2);
  fs.writeFileSync(path.resolve(dirs[0], "example_questions.json"), jsonContent, "utf-8");
  fs.writeFileSync(path.resolve(dirs[1], "smartzero_questions_template.json"), jsonContent, "utf-8");

  // 2. CSV via XLSX (guarantees RFC-4180 escaping and SheetJS compatibility)
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

if (require.main === module || !module.parent) {
  generateFiles();
}
