import * as fs from "node:fs";

const questions = [
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
      { option_text: "df.drop_null()", is_correct: false }
    ]
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
      { option_text: "GROUP BY", is_correct: false }
    ]
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
      { option_text: "INDEX", is_correct: false }
    ]
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
        weight: 1
      },
      {
        input: "4\n-5 10 15 20",
        expected_output: "35",
        is_sample: false,
        is_hidden: true,
        weight: 2
      }
    ]
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
        setup_sql: "INSERT INTO products VALUES (1, 'Mechanical Keyboard', 120.50, 'Electronics'), (2, 'Mousepad', 15.00, 'Accessories'), (3, 'Wireless Mouse', 65.00, 'Electronics'), (4, 'Monitor', 300.00, 'Electronics');",
        expected_output: "name | price\nMonitor | 300.0\nMechanical Keyboard | 120.5\nWireless Mouse | 65.0",
        is_sample: false,
        is_hidden: true,
        weight: 2
      }
    ]
  }
];

fs.writeFileSync("examples/import/example_questions.json", JSON.stringify(questions, null, 2));
fs.writeFileSync("public/templates/smartzero_questions_template.json", JSON.stringify(questions, null, 2));

const csvHeader = "type,question_text,title,description,difficulty,marks,negative_marks,explanation,option_a,option_b,option_c,option_d,correct_answer,sample_input,sample_output,hidden_input,hidden_output,constraints,input_format,output_format,schema_sql,sample_data_sql,sample_expected_output,order_sensitive,test_cases";

function escapeCSV(str) {
  if (str === null || str === undefined) return "";
  const s = String(str);
  if (s.includes(",") || s.includes("\\n") || s.includes("\\r") || s.includes("\"")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

const csvRows = questions.map(q => {
  if (q.type === "mcq") {
    let ans = "A";
    if (q.options[1].is_correct) ans = "B";
    if (q.options[2].is_correct) ans = "C";
    if (q.options[3].is_correct) ans = "D";
    
    return [
      "mcq",
      escapeCSV(q.question_text),
      "", // title
      "", // desc
      escapeCSV(q.difficulty),
      q.marks,
      q.negative_marks || 0,
      escapeCSV(q.explanation),
      escapeCSV(q.options[0].option_text),
      escapeCSV(q.options[1].option_text),
      escapeCSV(q.options[2].option_text),
      escapeCSV(q.options[3].option_text),
      ans,
      "","","","","","","","","","","",""
    ].join(",");
  } else if (q.type === "coding") {
    return [
      "coding",
      "", // question_text
      escapeCSV(q.title),
      escapeCSV(q.description),
      escapeCSV(q.difficulty),
      q.marks,
      0, // negative
      "", // explanation
      "","","","", // options
      "", // correct_answer
      "", "", "", "", // we will use test_cases JSON column instead of flat columns to demonstrate advanced import
      escapeCSV(q.constraints),
      escapeCSV(q.input_format),
      escapeCSV(q.output_format),
      "","","","", // sql fields
      escapeCSV(JSON.stringify(q.test_cases)) // test_cases JSON column
    ].join(",");
  } else if (q.type === "sql") {
    return [
      "sql",
      "", // question_text
      escapeCSV(q.title),
      escapeCSV(q.description),
      escapeCSV(q.difficulty),
      q.marks,
      0, // negative
      "", // explanation
      "","","","", // options
      "", // correct_answer
      "","","","", // flat coding tests
      "","","", // coding fields
      escapeCSV(q.schema_sql),
      escapeCSV(q.sample_data_sql),
      escapeCSV(q.sample_expected_output),
      q.order_sensitive ? "TRUE" : "FALSE",
      escapeCSV(JSON.stringify(q.test_cases))
    ].join(",");
  }
});

const csvContent = [csvHeader, ...csvRows].join("\\n");
fs.writeFileSync("examples/import/example_questions.csv", csvContent);
fs.writeFileSync("public/templates/smartzero_questions_template.csv", csvContent);
console.log("Updated templates generated successfully.");
