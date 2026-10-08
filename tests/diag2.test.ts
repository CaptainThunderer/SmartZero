import { compareOutputs, normalizeOutput } from "../lib/judge/worker/worker";
import { executeSingleSqlTestCase, splitSqlStatements } from "../lib/judge/sqlEngine";

async function testPython() {
  console.log("=== PYTHON COMPARATOR ===");
  const actual = "Final Balance: 7000\nTotal Deposits: 9500\nTotal Withdrawals: 2500\r\n";
  const expected = "Final Balance: 7000\nTotal Deposits: 9500\nTotal Withdrawals: 2500";
  console.log("Normalized Actual:");
  console.log(JSON.stringify(normalizeOutput(actual)));
  console.log("Normalized Expected:");
  console.log(JSON.stringify(normalizeOutput(expected)));
  console.log("Match:", compareOutputs(actual, expected));

  // What if actual has ANSI?
  const actualANSI = "Final Balance: \x1b[32m7000\x1b[0m\nTotal Deposits: 9500\nTotal Withdrawals: 2500";
  console.log("Match with ANSI:", compareOutputs(actualANSI, expected));
}

async function testSql() {
  console.log("\n=== SQL ENGINE ===");
  const schema = "CREATE TABLE students (student_id INTEGER, name TEXT, department TEXT, marks INTEGER);";
  const sampleData = "INSERT INTO students VALUES (1, 'Alice', 'CS', 85); INSERT INTO students VALUES (2, 'Bob', 'CS', 90);";
  
  console.log("Testing splitSqlStatements:");
  console.log(splitSqlStatements(sampleData));

  const result = await executeSingleSqlTestCase({
    jobId: "test-job-1",
    schemaSql: schema,
    sampleDataSql: sampleData,
    setupSql: sampleData, // simulating the run/route.ts behavior
    studentQuery: "SELECT * FROM students WHERE marks > 80;",
    expectedOutput: "student_id,name,department,marks\n1,Alice,CS,85\n2,Bob,CS,90"
  });
  
  console.log("SQL Result:");
  console.log(result);
}

async function run() {
  await testPython();
  await testSql();
}

run();
