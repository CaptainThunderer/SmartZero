import { executeSingleSqlTestCase } from "../lib/judge/sqlEngine";

async function debug() {
  const schemaSql = `
    CREATE TABLE students (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      department TEXT NOT NULL,
      marks INTEGER
    );
  `;
  const sampleDataSql = `
    INSERT INTO students VALUES
    (1, 'Sai', 'DS', 92),
    (2, 'Rahul', 'CSE', 81),
    (3, 'Anu', 'DS', 88),
    (4, 'Ravi', 'CSE', 75);
  `;

  const res = await executeSingleSqlTestCase({
    jobId: "debug-hidden-1",
    schemaSql,
    sampleDataSql,
    setupSql: "INSERT INTO students VALUES (5, 'Zack', 'IT', 95);",
    studentQuery: `
      SELECT * FROM students;
    `,
    expectedOutput: "name | marks\nZack | 95\nSai | 92\nAnu | 88",
    orderSensitive: true,
  });

  console.log(JSON.stringify(res, null, 2));
}

debug();
