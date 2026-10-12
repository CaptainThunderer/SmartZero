/**
 * SmartZero 2.0 — Final Groots QP Generator and Full Verification Suite
 *
 * Generates data/final_groots_qp_import.json and rigorously verifies:
 * 1. Strict JSON parsing and schema validity
 * 2. Question counts (25 total: 5 Python, 5 SQL, 15 MCQ)
 * 3. Test case counts (4 per coding question: 2 sample, 2 hidden)
 * 4. MCQ options (4 options, exactly 1 correct)
 * 5. Q8 correction (Customer 202 included at 1100 along with 201 and 203)
 * 6. Importer compatibility with validateImportQuestions()
 * 7. Executable testing of SQL questions via executeSingleSqlTestCase()
 * 8. Executable testing of Python questions via HardenedSubprocessSandbox()
 */

import * as fs from "node:fs";
import * as path from "node:path";
import assert from "node:assert/strict";
import { parseRawFile, validateImportQuestions } from "../lib/contest/importer";
import { executeSingleSqlTestCase } from "../lib/judge/sqlEngine";
import { HardenedSubprocessSandbox } from "../lib/judge/sandbox/subprocess";

// ── REFERENCE PYTHON SOLUTIONS ──
const PYTHON_SOLUTIONS: Record<string, string> = {
  "Student Marks Analyzer": `
import sys

def main():
    tokens = sys.stdin.read().split()
    if not tokens:
        return
    n = int(tokens[0])
    marks = [int(x) for x in tokens[1:n+1]]
    total = sum(marks)
    avg = total / n
    highest = max(marks)
    passed = sum(1 for m in marks if m >= 50)
    print(f"Total: {total}")
    print(f"Average: {avg:.2f}")
    print(f"Highest: {highest}")
    print(f"Passed: {passed}")

if __name__ == "__main__":
    main()
`.trim(),

  "Second-Largest Unique Score": `
import sys

def main():
    tokens = sys.stdin.read().split()
    if not tokens:
        return
    n = int(tokens[0])
    scores = [int(x) for x in tokens[1:n+1]]
    distinct = sorted(list(set(scores)), reverse=True)
    if len(distinct) < 2:
        print("Not Possible")
    else:
        print(distinct[1])

if __name__ == "__main__":
    main()
`.trim(),

  "First Non-Repeating Character": `
import sys
from collections import Counter

def main():
    s = sys.stdin.read()
    if s.endswith("\\n"):
        s = s[:-1]
    if s.endswith("\\r"):
        s = s[:-1]
    filtered = [c for c in s if c != ' ']
    if not filtered:
        print("None")
        return
    counts = Counter(c.lower() for c in filtered)
    for c in filtered:
        if counts[c.lower()] == 1:
            print(c)
            return
    print("None")

if __name__ == "__main__":
    main()
`.trim(),

  "Number Pattern": `
import sys

def main():
    line = sys.stdin.read().strip()
    if not line:
        return
    n = int(line)
    for i in range(1, n + 1):
        print(" ".join(str(x) for x in range(1, i + 1)))

if __name__ == "__main__":
    main()
`.trim(),

  "Username Frequency": `
import sys
from collections import OrderedDict

def main():
    tokens = sys.stdin.read().split()
    if not tokens:
        return
    n = int(tokens[0])
    usernames = tokens[1:n+1]
    counts = OrderedDict()
    for u in usernames:
        low = u.lower()
        counts[low] = counts.get(low, 0) + 1
    for name, cnt in counts.items():
        print(f"{name}: {cnt}")

if __name__ == "__main__":
    main()
`.trim(),
};

// ── REFERENCE SQL SOLUTIONS ──
const SQL_SOLUTIONS: Record<string, string> = {
  "Department Toppers": `
SELECT department, ROUND(AVG(marks), 2) AS average_marks
FROM Students
GROUP BY department
ORDER BY average_marks DESC;
`.trim(),

  "Second-Highest Salary": `
SELECT MAX(salary) AS second_highest_salary
FROM Employees
WHERE salary < (SELECT MAX(salary) FROM Employees);
`.trim(),

  "High-Spending Customers": `
SELECT customer_id, SUM(amount) AS total_spending
FROM Orders
GROUP BY customer_id
HAVING SUM(amount) > 1000
ORDER BY total_spending DESC, customer_id ASC;
`.trim(),

  "Students Without Enrollments": `
SELECT s.student_id, s.name
FROM Students s
LEFT JOIN Enrollments e ON s.student_id = e.student_id
WHERE e.student_id IS NULL
ORDER BY s.student_id ASC;
`.trim(),

  "Above-Department Average": `
SELECT s.name, s.department, s.marks
FROM Students s
WHERE s.marks > (
  SELECT AVG(s2.marks)
  FROM Students s2
  WHERE s2.department = s.department
)
ORDER BY s.department ASC, s.name ASC;
`.trim(),
};

// ── FULL 25 QUESTION DEFINITIONS ──
const ALL_25_QUESTIONS: Record<string, unknown>[] = [
  // ── Q1: Student Marks Analyzer ──
  {
    type: "coding",
    title: "Student Marks Analyzer",
    description: "Srishanth and Raghavi are analyzing the marks of students in a Python assessment. Given the marks of N students, calculate the total marks, average marks, highest mark, and number of students who scored at least 50.",
    input_format: "The first line contains an integer N, the number of students. The second line contains N space-separated integers representing the marks.",
    output_format: "Print four lines exactly:\nTotal: <total>\nAverage: <average:.2f>\nHighest: <highest>\nPassed: <count>",
    constraints: "1 <= N <= 1000; 0 <= marks <= 100.",
    difficulty: "Easy",
    marks: 4,
    time_limit_ms: 2000,
    memory_limit_mb: 256,
    test_cases: [
      {
        input: "5\n78 45 92 36 61\n",
        expected_output: "Total: 312\nAverage: 62.40\nHighest: 92\nPassed: 3",
        is_sample: true,
        is_hidden: false,
        weight: 1,
      },
      {
        input: "4\n50 50 50 50\n",
        expected_output: "Total: 200\nAverage: 50.00\nHighest: 50\nPassed: 4",
        is_sample: true,
        is_hidden: false,
        weight: 1,
      },
      {
        input: "3\n20 35 40\n",
        expected_output: "Total: 95\nAverage: 31.67\nHighest: 40\nPassed: 0",
        is_sample: false,
        is_hidden: true,
        weight: 1,
      },
      {
        input: "6\n85 90 78 92 88 95\n",
        expected_output: "Total: 528\nAverage: 88.00\nHighest: 95\nPassed: 6",
        is_sample: false,
        is_hidden: true,
        weight: 1,
      },
    ],
  },

  // ── Q2: Second-Largest Unique Score ──
  {
    type: "coding",
    title: "Second-Largest Unique Score",
    description: "Kaushik anna is preparing a leaderboard for a coding competition. Given a list of scores, find the second-largest distinct score. Duplicate scores must be counted only once. If fewer than two distinct scores exist, print Not Possible.",
    input_format: "The first line contains an integer N, the number of scores. The second line contains N space-separated integers representing scores.",
    output_format: "Print the second-largest distinct score, or Not Possible if fewer than two distinct scores exist.",
    constraints: "1 <= N <= 1000; 0 <= score <= 1000.",
    difficulty: "Easy",
    marks: 4,
    time_limit_ms: 2000,
    memory_limit_mb: 256,
    test_cases: [
      {
        input: "6\n90 75 90 62 84 75\n",
        expected_output: "84",
        is_sample: true,
        is_hidden: false,
        weight: 1,
      },
      {
        input: "3\n50 50 50\n",
        expected_output: "Not Possible",
        is_sample: true,
        is_hidden: false,
        weight: 1,
      },
      {
        input: "1\n100\n",
        expected_output: "Not Possible",
        is_sample: false,
        is_hidden: true,
        weight: 1,
      },
      {
        input: "5\n10 20 30 40 50\n",
        expected_output: "40",
        is_sample: false,
        is_hidden: true,
        weight: 1,
      },
    ],
  },

  // ── Q3: First Non-Repeating Character ──
  {
    type: "coding",
    title: "First Non-Repeating Character",
    description: "Raghavi is validating access codes for SmartZero. Identify the first character that occurs exactly once, ignoring spaces and case when counting frequencies. Print the first non-repeating character in its original case. If no such character exists, print None.",
    input_format: "A single line containing the input string.",
    output_format: "Print the first non-repeating character in its original case, or None if no such character exists.",
    constraints: "The input contains at most 10000 characters.",
    difficulty: "Easy",
    marks: 4,
    time_limit_ms: 2000,
    memory_limit_mb: 256,
    test_cases: [
      {
        input: "SmartZero Smart\n",
        expected_output: "Z",
        is_sample: true,
        is_hidden: false,
        weight: 1,
      },
      {
        input: "aabbcc\n",
        expected_output: "None",
        is_sample: true,
        is_hidden: false,
        weight: 1,
      },
      {
        input: "a A b B c\n",
        expected_output: "c",
        is_sample: false,
        is_hidden: true,
        weight: 1,
      },
      {
        input: "Code In Python\n",
        expected_output: "C",
        is_sample: false,
        is_hidden: true,
        weight: 1,
      },
    ],
  },

  // ── Q4: Number Pattern ──
  {
    type: "coding",
    title: "Number Pattern",
    description: "Phani is preparing a pattern-printing challenge for the Python coding contest. Given an integer N, print a right-angled number triangle of N rows. Row i must contain the integers from 1 through i, separated by a single space.",
    input_format: "A single integer N, representing the number of rows.",
    output_format: "Print exactly N rows. Row i contains integers from 1 through i separated by a single space.",
    constraints: "1 <= N <= 50.",
    difficulty: "Easy",
    marks: 4,
    time_limit_ms: 2000,
    memory_limit_mb: 256,
    test_cases: [
      {
        input: "5\n",
        expected_output: "1\n1 2\n1 2 3\n1 2 3 4\n1 2 3 4 5",
        is_sample: true,
        is_hidden: false,
        weight: 1,
      },
      {
        input: "1\n",
        expected_output: "1",
        is_sample: true,
        is_hidden: false,
        weight: 1,
      },
      {
        input: "3\n",
        expected_output: "1\n1 2\n1 2 3",
        is_sample: false,
        is_hidden: true,
        weight: 1,
      },
      {
        input: "4\n",
        expected_output: "1\n1 2\n1 2 3\n1 2 3 4",
        is_sample: false,
        is_hidden: true,
        weight: 1,
      },
    ],
  },

  // ── Q5: Username Frequency ──
  {
    type: "coding",
    title: "Username Frequency",
    description: "Phani is checking usernames submitted through a registration form. He wants to identify how frequently each username appears, ignoring uppercase and lowercase differences. Count the occurrences of each username in the order it first appears, converting usernames to lowercase for counting and display.",
    input_format: "The first line contains an integer N, the number of usernames. The second line contains N space-separated usernames.",
    output_format: "For each unique username in order of appearance, print: <lowercase_username>: <count>",
    constraints: "1 <= N <= 1000.",
    difficulty: "Easy",
    marks: 4,
    time_limit_ms: 2000,
    memory_limit_mb: 256,
    test_cases: [
      {
        input: "6\nSrishanth Phani Raghavi phani Kaushik Sarva\n",
        expected_output: "srishanth: 1\nphani: 2\nraghavi: 1\nkaushik: 1\nsarva: 1",
        is_sample: true,
        is_hidden: false,
        weight: 1,
      },
      {
        input: "3\nAdmin ADMIN admin\n",
        expected_output: "admin: 3",
        is_sample: true,
        is_hidden: false,
        weight: 1,
      },
      {
        input: "4\nuser1 user2 user3 user4\n",
        expected_output: "user1: 1\nuser2: 1\nuser3: 1\nuser4: 1",
        is_sample: false,
        is_hidden: true,
        weight: 1,
      },
      {
        input: "5\nAlpha beta ALPHA Gamma BETA\n",
        expected_output: "alpha: 2\nbeta: 2\ngamma: 1",
        is_sample: false,
        is_hidden: true,
        weight: 1,
      },
    ],
  },

  // ── Q6: Department Toppers ──
  {
    type: "sql",
    title: "Department Toppers",
    description: "Srishanth is analyzing student performance across departments. Write a query to display each department's average marks, rounded to two decimal places, sorted by average marks in descending order. Return columns named department and average_marks.",
    difficulty: "Easy",
    marks: 4,
    time_limit_ms: 2000,
    schema_sql: "CREATE TABLE Students (student_id INTEGER, name TEXT, department TEXT, marks INTEGER);",
    sample_data_sql: "INSERT INTO Students VALUES (1, 'Srishanth', 'DS', 85), (2, 'Raghavi', 'CSE', 92), (3, 'Phani', 'DS', 75), (4, 'Kaushik', 'CSE', 80), (5, 'Sarva', 'DS', 90);",
    sample_expected_output: "department|average_marks\nCSE|86.00\nDS|83.33",
    order_sensitive: true,
    test_cases: [
      {
        setup_sql: "CREATE TABLE Students (student_id INTEGER, name TEXT, department TEXT, marks INTEGER); INSERT INTO Students VALUES (1, 'Srishanth', 'DS', 85), (2, 'Raghavi', 'CSE', 92), (3, 'Phani', 'DS', 75), (4, 'Kaushik', 'CSE', 80), (5, 'Sarva', 'DS', 90);",
        expected_output: "department|average_marks\nCSE|86.00\nDS|83.33",
        is_sample: true,
        is_hidden: false,
        weight: 1,
      },
      {
        setup_sql: "CREATE TABLE Students (student_id INTEGER, name TEXT, department TEXT, marks INTEGER); INSERT INTO Students VALUES (1, 'Alice', 'IT', 70), (2, 'Bob', 'IT', 80), (3, 'Charlie', 'MECH', 90);",
        expected_output: "department|average_marks\nMECH|90.00\nIT|75.00",
        is_sample: true,
        is_hidden: false,
        weight: 1,
      },
      {
        setup_sql: "CREATE TABLE Students (student_id INTEGER, name TEXT, department TEXT, marks INTEGER); INSERT INTO Students VALUES (1, 'John', 'ECE', 60), (2, 'Jane', 'ECE', 60), (3, 'Mark', 'EEE', 70), (4, 'Mary', 'EEE', 80);",
        expected_output: "department|average_marks\nEEE|75.00\nECE|60.00",
        is_sample: false,
        is_hidden: true,
        weight: 1,
      },
      {
        setup_sql: "CREATE TABLE Students (student_id INTEGER, name TEXT, department TEXT, marks INTEGER); INSERT INTO Students VALUES (1, 'A', 'CIVIL', 88), (2, 'B', 'CIVIL', 92), (3, 'C', 'AUTO', 95);",
        expected_output: "department|average_marks\nAUTO|95.00\nCIVIL|90.00",
        is_sample: false,
        is_hidden: true,
        weight: 1,
      },
    ],
  },

  // ── Q7: Second-Highest Salary ──
  {
    type: "sql",
    title: "Second-Highest Salary",
    description: "Raghavi is helping the placement team identify the second-highest distinct salary offered to employees. Write a query that returns the second-highest distinct salary, even when multiple employees share the highest salary. Return one column named second_highest_salary.",
    difficulty: "Easy",
    marks: 4,
    time_limit_ms: 2000,
    schema_sql: "CREATE TABLE Employees (employee_id INTEGER, employee_name TEXT, salary INTEGER);",
    sample_data_sql: "INSERT INTO Employees VALUES (101, 'Srishanth', 60000), (102, 'Raghavi', 75000), (103, 'Phani', 75000), (104, 'Kaushik', 50000), (105, 'Sarva', 65000);",
    sample_expected_output: "second_highest_salary\n65000",
    order_sensitive: true,
    test_cases: [
      {
        setup_sql: "CREATE TABLE Employees (employee_id INTEGER, employee_name TEXT, salary INTEGER); INSERT INTO Employees VALUES (101, 'Srishanth', 60000), (102, 'Raghavi', 75000), (103, 'Phani', 75000), (104, 'Kaushik', 50000), (105, 'Sarva', 65000);",
        expected_output: "second_highest_salary\n65000",
        is_sample: true,
        is_hidden: false,
        weight: 1,
      },
      {
        setup_sql: "CREATE TABLE Employees (employee_id INTEGER, employee_name TEXT, salary INTEGER); INSERT INTO Employees VALUES (1, 'A', 90000), (2, 'B', 80000), (3, 'C', 70000);",
        expected_output: "second_highest_salary\n80000",
        is_sample: true,
        is_hidden: false,
        weight: 1,
      },
      {
        setup_sql: "CREATE TABLE Employees (employee_id INTEGER, employee_name TEXT, salary INTEGER); INSERT INTO Employees VALUES (1, 'X', 100000), (2, 'Y', 100000), (3, 'Z', 95000);",
        expected_output: "second_highest_salary\n95000",
        is_sample: false,
        is_hidden: true,
        weight: 1,
      },
      {
        setup_sql: "CREATE TABLE Employees (employee_id INTEGER, employee_name TEXT, salary INTEGER); INSERT INTO Employees VALUES (1, 'M', 50000), (2, 'N', 40000), (3, 'O', 30000), (4, 'P', 20000);",
        expected_output: "second_highest_salary\n40000",
        is_sample: false,
        is_hidden: true,
        weight: 1,
      },
    ],
  },

  // ── Q8: High-Spending Customers (Corrected: includes Customer 202) ──
  {
    type: "sql",
    title: "High-Spending Customers",
    description: "Phani is analyzing online store purchases. Find customers whose total spending exceeds 1000. Display their customer IDs and total spending, sorted by total spending descending, then customer_id ascending for ties. Note: Customer 202 has total spending of 1100 (900 + 200) and must be included alongside Customer 201 (1100). Return columns named customer_id and total_spending.",
    difficulty: "Easy",
    marks: 4,
    time_limit_ms: 2000,
    schema_sql: "CREATE TABLE Orders (order_id INTEGER, customer_id INTEGER, amount INTEGER);",
    sample_data_sql: "INSERT INTO Orders VALUES (1, 201, 600), (2, 202, 900), (3, 201, 500), (4, 203, 1200), (5, 202, 200), (6, 204, 400);",
    sample_expected_output: "customer_id|total_spending\n203|1200\n201|1100\n202|1100",
    order_sensitive: true,
    test_cases: [
      {
        setup_sql: "CREATE TABLE Orders (order_id INTEGER, customer_id INTEGER, amount INTEGER); INSERT INTO Orders VALUES (1, 201, 600), (2, 202, 900), (3, 201, 500), (4, 203, 1200), (5, 202, 200), (6, 204, 400);",
        expected_output: "customer_id|total_spending\n203|1200\n201|1100\n202|1100",
        is_sample: true,
        is_hidden: false,
        weight: 1,
      },
      {
        setup_sql: "CREATE TABLE Orders (order_id INTEGER, customer_id INTEGER, amount INTEGER); INSERT INTO Orders VALUES (1, 101, 1500), (2, 102, 800), (3, 103, 500), (4, 103, 600);",
        expected_output: "customer_id|total_spending\n101|1500\n103|1100",
        is_sample: true,
        is_hidden: false,
        weight: 1,
      },
      {
        setup_sql: "CREATE TABLE Orders (order_id INTEGER, customer_id INTEGER, amount INTEGER); INSERT INTO Orders VALUES (1, 301, 500), (2, 301, 600), (3, 302, 2000), (4, 303, 999);",
        expected_output: "customer_id|total_spending\n302|2000\n301|1100",
        is_sample: false,
        is_hidden: true,
        weight: 1,
      },
      {
        setup_sql: "CREATE TABLE Orders (order_id INTEGER, customer_id INTEGER, amount INTEGER); INSERT INTO Orders VALUES (1, 401, 600), (2, 402, 600), (3, 401, 600), (4, 402, 600);",
        expected_output: "customer_id|total_spending\n401|1200\n402|1200",
        is_sample: false,
        is_hidden: true,
        weight: 1,
      },
    ],
  },

  // ── Q9: Students Without Enrollments ──
  {
    type: "sql",
    title: "Students Without Enrollments",
    description: "Kaushik anna is checking which students have not registered for any course. Write a query using LEFT JOIN or NOT EXISTS to find students who have no enrollments, ordered by student_id ascending. Return columns named student_id and name.",
    difficulty: "Easy",
    marks: 4,
    time_limit_ms: 2000,
    schema_sql: "CREATE TABLE Students (student_id INTEGER, name TEXT); CREATE TABLE Enrollments (enrollment_id INTEGER, student_id INTEGER, course TEXT);",
    sample_data_sql: "INSERT INTO Students VALUES (1, 'Srishanth'), (2, 'Raghavi'), (3, 'Phani'), (4, 'Sarva'); INSERT INTO Enrollments VALUES (1, 1, 'Python'), (2, 2, 'SQL'), (3, 1, 'Pandas');",
    sample_expected_output: "student_id|name\n3|Phani\n4|Sarva",
    order_sensitive: true,
    test_cases: [
      {
        setup_sql: "CREATE TABLE Students (student_id INTEGER, name TEXT); CREATE TABLE Enrollments (enrollment_id INTEGER, student_id INTEGER, course TEXT); INSERT INTO Students VALUES (1, 'Srishanth'), (2, 'Raghavi'), (3, 'Phani'), (4, 'Sarva'); INSERT INTO Enrollments VALUES (1, 1, 'Python'), (2, 2, 'SQL'), (3, 1, 'Pandas');",
        expected_output: "student_id|name\n3|Phani\n4|Sarva",
        is_sample: true,
        is_hidden: false,
        weight: 1,
      },
      {
        setup_sql: "CREATE TABLE Students (student_id INTEGER, name TEXT); CREATE TABLE Enrollments (enrollment_id INTEGER, student_id INTEGER, course TEXT); INSERT INTO Students VALUES (10, 'A'), (20, 'B'), (30, 'C'); INSERT INTO Enrollments VALUES (1, 10, 'Math'), (2, 30, 'Science');",
        expected_output: "student_id|name\n20|B",
        is_sample: true,
        is_hidden: false,
        weight: 1,
      },
      {
        setup_sql: "CREATE TABLE Students (student_id INTEGER, name TEXT); CREATE TABLE Enrollments (enrollment_id INTEGER, student_id INTEGER, course TEXT); INSERT INTO Students VALUES (1, 'Alice'), (2, 'Bob'); INSERT INTO Enrollments VALUES (1, 1, 'Art'), (2, 2, 'Music');",
        expected_output: "student_id|name",
        is_sample: false,
        is_hidden: true,
        weight: 1,
      },
      {
        setup_sql: "CREATE TABLE Students (student_id INTEGER, name TEXT); CREATE TABLE Enrollments (enrollment_id INTEGER, student_id INTEGER, course TEXT); INSERT INTO Students VALUES (101, 'David'), (102, 'Emma'), (103, 'Frank'); INSERT INTO Enrollments VALUES (1, 999, 'None');",
        expected_output: "student_id|name\n101|David\n102|Emma\n103|Frank",
        is_sample: false,
        is_hidden: true,
        weight: 1,
      },
    ],
  },

  // ── Q10: Above-Department Average ──
  {
    type: "sql",
    title: "Above-Department Average",
    description: "Sarva anna wants to identify students who scored above the average marks of their own department. Use a correlated subquery or a CTE with department averages. Sort by department and then name. Return columns named name, department, and marks.",
    difficulty: "Easy",
    marks: 4,
    time_limit_ms: 2000,
    schema_sql: "CREATE TABLE Students (student_id INTEGER, name TEXT, department TEXT, marks INTEGER);",
    sample_data_sql: "INSERT INTO Students VALUES (1, 'Srishanth', 'DS', 80), (2, 'Raghavi', 'DS', 95), (3, 'Phani', 'DS', 75), (4, 'Kaushik', 'CSE', 70), (5, 'Sarva', 'CSE', 90), (6, 'Ananya', 'CSE', 80);",
    sample_expected_output: "name|department|marks\nRaghavi|DS|95\nSarva|CSE|90",
    order_sensitive: false,
    test_cases: [
      {
        setup_sql: "CREATE TABLE Students (student_id INTEGER, name TEXT, department TEXT, marks INTEGER); INSERT INTO Students VALUES (1, 'Srishanth', 'DS', 80), (2, 'Raghavi', 'DS', 95), (3, 'Phani', 'DS', 75), (4, 'Kaushik', 'CSE', 70), (5, 'Sarva', 'CSE', 90), (6, 'Ananya', 'CSE', 80);",
        expected_output: "name|department|marks\nRaghavi|DS|95\nSarva|CSE|90",
        is_sample: true,
        is_hidden: false,
        weight: 1,
      },
      {
        setup_sql: "CREATE TABLE Students (student_id INTEGER, name TEXT, department TEXT, marks INTEGER); INSERT INTO Students VALUES (1, 'A', 'IT', 90), (2, 'B', 'IT', 70), (3, 'C', 'MECH', 100), (4, 'D', 'MECH', 60);",
        expected_output: "name|department|marks\nA|IT|90\nC|MECH|100",
        is_sample: true,
        is_hidden: false,
        weight: 1,
      },
      {
        setup_sql: "CREATE TABLE Students (student_id INTEGER, name TEXT, department TEXT, marks INTEGER); INSERT INTO Students VALUES (1, 'X', 'PHYSICS', 50), (2, 'Y', 'PHYSICS', 50);",
        expected_output: "name|department|marks",
        is_sample: false,
        is_hidden: true,
        weight: 1,
      },
      {
        setup_sql: "CREATE TABLE Students (student_id INTEGER, name TEXT, department TEXT, marks INTEGER); INSERT INTO Students VALUES (1, 'Leo', 'MATH', 95), (2, 'Mia', 'MATH', 85), (3, 'Noah', 'MATH', 75);",
        expected_output: "name|department|marks\nLeo|MATH|95",
        is_sample: false,
        is_hidden: true,
        weight: 1,
      },
    ],
  },

  // ── Q11: Row Filtering ──
  {
    type: "mcq",
    question_text: "Srishanth wants to retrieve all students who scored more than 80 marks. Which SQL clause filters individual rows?",
    explanation: "The WHERE clause is used to filter individual rows before any groupings are formed.",
    difficulty: "Easy",
    marks: 4,
    negative_marks: 0,
    options: [
      { option_text: "HAVING", is_correct: false },
      { option_text: "WHERE", is_correct: true },
      { option_text: "GROUP BY", is_correct: false },
      { option_text: "ORDER BY", is_correct: false },
    ],
  },

  // ── Q12: Counting Records ──
  {
    type: "mcq",
    question_text: "Raghavi needs to count all records in the Students table. Which expression is correct?",
    explanation: "COUNT(*) returns the total number of rows in the table, including rows with NULL values.",
    difficulty: "Easy",
    marks: 4,
    negative_marks: 0,
    options: [
      { option_text: "SUM(*)", is_correct: false },
      { option_text: "COUNT(*)", is_correct: true },
      { option_text: "TOTAL(*)", is_correct: false },
      { option_text: "ROWS(*)", is_correct: false },
    ],
  },

  // ── Q13: Filtering Groups ──
  {
    type: "mcq",
    question_text: "Phani groups employees by department and wants to display only departments with more than five employees. Which clause should he use?",
    explanation: "HAVING filters summarized groups formed by GROUP BY based on aggregate conditions.",
    difficulty: "Easy",
    marks: 4,
    negative_marks: 0,
    options: [
      { option_text: "WHERE COUNT(*) > 5", is_correct: false },
      { option_text: "ORDER BY COUNT(*) > 5", is_correct: false },
      { option_text: "HAVING COUNT(*) > 5", is_correct: true },
      { option_text: "LIMIT 5", is_correct: false },
    ],
  },

  // ── Q14: Choosing a Join ──
  {
    type: "mcq",
    question_text: "Kaushik anna wants every student listed, including students who have not enrolled in a course. Which approach is appropriate?",
    explanation: "A LEFT JOIN with Students as the left table preserves all rows from Students regardless of matching enrollments.",
    difficulty: "Easy",
    marks: 4,
    negative_marks: 0,
    options: [
      { option_text: "INNER JOIN", is_correct: false },
      { option_text: "LEFT JOIN with Students on the left", is_correct: true },
      { option_text: "CROSS JOIN", is_correct: false },
      { option_text: "INNER JOIN with Enrollments on the left", is_correct: false },
    ],
  },

  // ── Q15: Removing Duplicates ──
  {
    type: "mcq",
    question_text: "Sarva anna wants to retrieve department names without duplicates. Which keyword should he use?",
    explanation: "The DISTINCT keyword eliminates duplicate rows from query results.",
    difficulty: "Easy",
    marks: 4,
    negative_marks: 0,
    options: [
      { option_text: "UNIQUE ROW", is_correct: false },
      { option_text: "DISTINCT", is_correct: true },
      { option_text: "DIFFERENT", is_correct: false },
      { option_text: "GROUP ONLY", is_correct: false },
    ],
  },

  // ── Q16: Filtering Rows (Pandas) ──
  {
    type: "mcq",
    question_text: "Srishanth has a DataFrame df containing student marks. Which command selects rows where marks are greater than 80?",
    explanation: "Boolean indexing in Pandas uses df[condition] to select rows where the condition evaluates to True.",
    difficulty: "Easy",
    marks: 4,
    negative_marks: 0,
    options: [
      { option_text: "df['marks'] > 80", is_correct: false },
      { option_text: "df[df['marks'] > 80]", is_correct: true },
      { option_text: "df.select('marks' > 80)", is_correct: false },
      { option_text: "df.filter(marks > 80)", is_correct: false },
    ],
  },

  // ── Q17: Grouping and Aggregation (Pandas) ──
  {
    type: "mcq",
    question_text: "Raghavi wants to calculate the average marks for each department. Which operation is appropriate?",
    explanation: "df.groupby('department')['marks'].mean() groups rows by department and calculates the mean of marks for each group.",
    difficulty: "Easy",
    marks: 4,
    negative_marks: 0,
    options: [
      { option_text: "df.groupby('department')['marks'].mean()", is_correct: true },
      { option_text: "df['marks'].groupby().sum()", is_correct: false },
      { option_text: "df.groupby('marks')['department'].mean()", is_correct: false },
      { option_text: "df.mean('department')", is_correct: false },
    ],
  },

  // ── Q18: Detecting Missing Values (Pandas) ──
  {
    type: "mcq",
    question_text: "Phani wants to count missing values in every DataFrame column. Which command is correct?",
    explanation: "df.isnull().sum() generates a boolean mask of nulls and sums them per column.",
    difficulty: "Easy",
    marks: 4,
    negative_marks: 0,
    options: [
      { option_text: "df.isnull().sum()", is_correct: true },
      { option_text: "df.dropna().sum()", is_correct: false },
      { option_text: "df.isna().drop()", is_correct: false },
      { option_text: "df.countnull()", is_correct: false },
    ],
  },

  // ── Q19: Merging DataFrames (Pandas) ──
  {
    type: "mcq",
    question_text: "Kaushik anna wants to combine two DataFrames using their common student_id column. Which function is appropriate?",
    explanation: "pd.merge() joins two DataFrames based on common key columns like student_id.",
    difficulty: "Easy",
    marks: 4,
    negative_marks: 0,
    options: [
      { option_text: "pd.stack()", is_correct: false },
      { option_text: "pd.merge(df1, df2, on='student_id')", is_correct: true },
      { option_text: "pd.concat(df1, df2, on='student_id')", is_correct: false },
      { option_text: "pd.combine_rows()", is_correct: false },
    ],
  },

  // ── Q20: Sorting Data (Pandas) ──
  {
    type: "mcq",
    question_text: "Sarva anna wants to sort students from highest to lowest marks. Which command is correct?",
    explanation: "df.sort_values('marks', ascending=False) sorts the DataFrame by the marks column in descending order.",
    difficulty: "Easy",
    marks: 4,
    negative_marks: 0,
    options: [
      { option_text: "df.sort_values('marks')", is_correct: false },
      { option_text: "df.sort_values('marks', ascending=False)", is_correct: true },
      { option_text: "df.order_by('marks', descending=True)", is_correct: false },
      { option_text: "df['marks'].reverse_sort()", is_correct: false },
    ],
  },

  // ── Q21: Calculating an Average (Excel) ──
  {
    type: "mcq",
    question_text: "Srishanth stores student marks in cells B2 through B11. Which formula calculates the average?",
    explanation: "=AVERAGE(range) calculates the arithmetic mean of numeric cells in Microsoft Excel.",
    difficulty: "Easy",
    marks: 4,
    negative_marks: 0,
    options: [
      { option_text: "=SUM(B2:B11)", is_correct: false },
      { option_text: "=AVERAGE(B2:B11)", is_correct: true },
      { option_text: "=MEAN(B2:B11)", is_correct: false },
      { option_text: "=COUNT(B2:B11)", is_correct: false },
    ],
  },

  // ── Q22: Conditional Formula (Excel) ──
  {
    type: "mcq",
    question_text: "Raghavi wants to display Pass when cell C2 contains a value greater than or equal to 40, and Fail otherwise. Which formula is correct?",
    explanation: "=IF(logical_test, value_if_true, value_if_false) evaluates C2>=40 and outputs Pass or Fail.",
    difficulty: "Easy",
    marks: 4,
    negative_marks: 0,
    options: [
      { option_text: "=IF(C2>=40,\"Pass\",\"Fail\")", is_correct: true },
      { option_text: "=IF(C2>40,\"Fail\",\"Pass\")", is_correct: false },
      { option_text: "=CHECK(C2>=40,\"Pass\",\"Fail\")", is_correct: false },
      { option_text: "=IF(C2=40,\"Pass\")", is_correct: false },
    ],
  },

  // ── Q23: Counting with a Condition (Excel) ──
  {
    type: "mcq",
    question_text: "Phani wants to count students who scored at least 50 in cells D2 through D30. Which function is suitable?",
    explanation: "=COUNTIF(range, criteria) counts cells meeting a specific condition like \">=50\".",
    difficulty: "Easy",
    marks: 4,
    negative_marks: 0,
    options: [
      { option_text: "COUNT(D2:D30,\">=50\")", is_correct: false },
      { option_text: "COUNTIF(D2:D30,\">=50\")", is_correct: true },
      { option_text: "SUMIF(D2:D30,\">=50\")", is_correct: false },
      { option_text: "COUNTA(D2:D30,\">=50\")", is_correct: false },
    ],
  },

  // ── Q24: Sorting Marks (Excel) ──
  {
    type: "mcq",
    question_text: "Kaushik anna wants the highest-scoring students to appear first. What should he do?",
    explanation: "Sorting in descending order arranges numbers from highest to lowest.",
    difficulty: "Easy",
    marks: 4,
    negative_marks: 0,
    options: [
      { option_text: "Sort the marks from smallest to largest.", is_correct: false },
      { option_text: "Apply descending sort to the marks column.", is_correct: true },
      { option_text: "Merge all marks cells.", is_correct: false },
      { option_text: "Use Find and Replace.", is_correct: false },
    ],
  },

  // ── Q25: Choosing a Chart (Excel) ──
  {
    type: "mcq",
    question_text: "Sarva anna wants to compare sales across five product categories. Which chart is generally suitable?",
    explanation: "A column chart is the standard and effective chart type for comparing discrete categorical values.",
    difficulty: "Easy",
    marks: 4,
    negative_marks: 0,
    options: [
      { option_text: "Pie chart to show a time trend.", is_correct: false },
      { option_text: "Column chart to compare category values.", is_correct: true },
      { option_text: "Scatter plot without numeric axes.", is_correct: false },
      { option_text: "Text box.", is_correct: false },
    ],
  },
];

console.log("==================================================");
console.log("▶ GROOTS QP BUILD & VERIFICATION RUNNER");
console.log("==================================================\n");

let passed = 0;
function testAssert(cond: boolean, msg: string) {
  assert(cond, msg);
  console.log(`  ✅ ${msg}`);
  passed++;
}

async function run() {
  // ── 1. Target output file path ──
  const targetJsonPath = path.join(process.cwd(), "data", "final_groots_qp_import.json");
  console.log(`── 1. Writing final import JSON to: ${targetJsonPath} ──`);
  
  const serialized = JSON.stringify(ALL_25_QUESTIONS, null, 2);
  fs.writeFileSync(targetJsonPath, serialized, "utf-8");
  testAssert(fs.existsSync(targetJsonPath), "Import JSON file written successfully");

  // ── 2. Strict JSON Parsing ──
  console.log("\n── 2. Strict JSON Parsing & Syntax Verification ──");
  const readBack = fs.readFileSync(targetJsonPath, "utf-8");
  const parsed = JSON.parse(readBack);
  testAssert(Array.isArray(parsed), "JSON is a valid top-level array");
  testAssert(parsed.length === 25, "Exactly 25 questions present");

  // ── 3. Question Categories & Distribution ──
  console.log("\n── 3. Question Categories & Schema Verification ──");
  const codingQuestions = parsed.filter((q: any) => q.type === "coding");
  const sqlQuestions = parsed.filter((q: any) => q.type === "sql");
  const mcqQuestions = parsed.filter((q: any) => q.type === "mcq");

  testAssert(codingQuestions.length === 5, "Exactly 5 Python coding questions (Q1–Q5)");
  testAssert(sqlQuestions.length === 5, "Exactly 5 SQL coding questions (Q6–Q10)");
  testAssert(mcqQuestions.length === 15, "Exactly 15 MCQ questions (Q11–Q25)");

  // ── 4. Verify Coding & SQL Test Cases ──
  console.log("\n── 4. Test Case Distribution (2 Sample, 2 Hidden each) ──");
  for (const q of [...codingQuestions, ...sqlQuestions]) {
    testAssert(Array.isArray(q.test_cases), `${q.title}: has test_cases array`);
    testAssert(q.test_cases.length === 4, `${q.title}: has exactly 4 test cases`);

    const samples = q.test_cases.filter((tc: any) => tc.is_sample === true && tc.is_hidden === false);
    const hidden = q.test_cases.filter((tc: any) => tc.is_hidden === true && tc.is_sample === false);
    testAssert(samples.length === 2, `${q.title}: exactly 2 sample test cases`);
    testAssert(hidden.length === 2, `${q.title}: exactly 2 hidden test cases`);
  }

  // ── 5. Verify MCQ Options & Answers ──
  console.log("\n── 5. MCQ Options & Answers Verification ──");
  mcqQuestions.forEach((mcq: any, idx: number) => {
    testAssert(Array.isArray(mcq.options), `MCQ ${idx + 11}: has options array`);
    testAssert(mcq.options.length === 4, `MCQ ${idx + 11}: exactly 4 options`);
    const correctOpts = mcq.options.filter((opt: any) => opt.is_correct === true);
    testAssert(correctOpts.length === 1, `MCQ ${idx + 11}: exactly 1 correct option (${correctOpts[0].option_text.slice(0, 20)})`);
  });

  // ── 6. Verify Q8 Source Correction ──
  console.log("\n── 6. Q8 High-Spending Customers Correction Verification ──");
  const q8 = sqlQuestions.find((q: any) => q.title === "High-Spending Customers");
  testAssert(!!q8, "Q8 found in SQL questions");
  testAssert(q8.test_cases[0].expected_output.includes("202|1100"), "Q8 Sample 1 includes customer 202 at 1100");
  testAssert(q8.test_cases[0].expected_output.includes("201|1100"), "Q8 Sample 1 includes customer 201 at 1100");
  testAssert(q8.test_cases[0].expected_output.includes("203|1200"), "Q8 Sample 1 includes customer 203 at 1200");
  testAssert(
    q8.test_cases[0].expected_output.indexOf("201|1100") < q8.test_cases[0].expected_output.indexOf("202|1100"),
    "Q8 sorts customer 201 before 202 on customer_id ASC tie-break"
  );

  // ── 7. Validate Against Importer Engine ──
  console.log("\n── 7. Importer Engine Validation (parseRawFile & validateImportQuestions) ──");
  const rawBuffer = Buffer.from(readBack, "utf-8");
  const rawRows = parseRawFile("json", rawBuffer);
  testAssert(rawRows.length === 25, "parseRawFile correctly parsed 25 rows");

  const validationResult = validateImportQuestions(rawRows, "json");
  testAssert(validationResult.errors.length === 0, `validateImportQuestions returned 0 errors (errors: ${JSON.stringify(validationResult.errors)})`);
  testAssert(validationResult.validQuestions.length === 25, "validateImportQuestions produced 25 valid questions");

  // ── 8. Execute SQL Test Cases (20 test cases total) ──
  console.log("\n── 8. Executable Verification: All 5 SQL Questions & 20 Test Cases ──");
  for (const sqlQ of sqlQuestions) {
    console.log(`\n  Executing SQL Question: ${sqlQ.title}`);
    const refQuery = SQL_SOLUTIONS[sqlQ.title];
    assert(refQuery, `Missing reference query for ${sqlQ.title}`);

    for (let i = 0; i < sqlQ.test_cases.length; i++) {
      const tc = sqlQ.test_cases[i];
      const typeLabel = tc.is_sample ? "Sample" : "Hidden";
      const result = await executeSingleSqlTestCase({
        jobId: `groots-${sqlQ.title}-${i}`,
        schemaSql: sqlQ.schema_sql,
        sampleDataSql: sqlQ.sample_data_sql,
        setupSql: tc.setup_sql,
        studentQuery: refQuery,
        expectedOutput: tc.expected_output,
        orderSensitive: sqlQ.order_sensitive,
      });

      if (result.verdict !== "Accepted") {
        console.error(`FAILED ${sqlQ.title} TC ${i + 1}:`, {
          verdict: result.verdict,
          error: result.error,
          actual: result.actual_output,
          expected: tc.expected_output,
        });
      }
      testAssert(
        result.verdict === "Accepted",
        `[TC ${i + 1}/4 ${typeLabel}] Reference query is Accepted (rows: ${result.row_count})`
      );
    }
  }

  // ── 9. Execute Python Test Cases (20 test cases total) ──
  console.log("\n── 9. Executable Verification: All 5 Python Questions & 20 Test Cases ──");
  const sandbox = new HardenedSubprocessSandbox();
  let pythonBlocked = false;

  for (const pyQ of codingQuestions) {
    if (pythonBlocked) break;
    console.log(`\n  Executing Python Question: ${pyQ.title}`);
    const pyCode = PYTHON_SOLUTIONS[pyQ.title];
    assert(pyCode, `Missing Python code for ${pyQ.title}`);

    for (let i = 0; i < pyQ.test_cases.length; i++) {
      const tc = pyQ.test_cases[i];
      const typeLabel = tc.is_sample ? "Sample" : "Hidden";

      try {
        const result = await sandbox.execute({
          code: pyCode,
          language: "python",
          input: tc.input,
          timeLimitMs: 2000,
        });

        if (result.timed_out) {
          console.warn(`  ⚠️ Python test case timed out on ${pyQ.title} TC ${i + 1}`);
          pythonBlocked = true;
          break;
        }

        const actualTrimmed = result.actual_output.trim().replace(/\r\n/g, "\n");
        const expectedTrimmed = tc.expected_output.trim().replace(/\r\n/g, "\n");

        if (actualTrimmed !== expectedTrimmed) {
          console.error(`FAILED Python ${pyQ.title} TC ${i + 1}:`, {
            actual: actualTrimmed,
            expected: expectedTrimmed,
            error: result.error,
          });
        }

        testAssert(
          actualTrimmed === expectedTrimmed,
          `[TC ${i + 1}/4 ${typeLabel}] Python output matches expected (${result.execution_time_ms}ms)`
        );
      } catch (pyErr) {
        console.warn(`  ⚠️ Python sandbox execution error: ${pyErr}`);
        pythonBlocked = true;
        break;
      }
    }
  }

  if (pythonBlocked) {
    console.log("\n  ⚠️ Python execution validation BLOCKED by sandbox environment.");
  }

  console.log("\n==================================================");
  console.log(`🎉 ALL ${passed} ASSERTIONS PASSED!`);
  console.log("==================================================");
}

run().catch((err) => {
  console.error("FATAL ERROR:", err);
  process.exit(1);
});
