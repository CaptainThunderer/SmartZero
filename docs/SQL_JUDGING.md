# SmartZero 2.0 — SQL Contest Judging Architecture & Specification

## 1. Overview
SmartZero 2.0 provides first-class support for SQL contest questions (`type: "sql"`). SQL questions allow evaluators to test participants on relational querying, data aggregation, joins, subqueries, and database manipulation in an isolated, secure, and deterministic environment.

---

## 2. SQL Dialect & Runtime Engine
- **Engine**: SQLite 3 (Node.js native `DatabaseSync` / SQLite C engine in isolated Docker sandbox).
- **Dialect**: SQLite SQL dialect.
- **Scope**: Standard relational querying and schema manipulation required for collegiate and enterprise competitive programming.

### Supported SQL Features
- **Queries**: `SELECT`, `WHERE`, `ORDER BY`, `GROUP BY`, `HAVING`, `DISTINCT`, `LIMIT`, `OFFSET`.
- **Joins**: `INNER JOIN`, `LEFT JOIN`, `CROSS JOIN`, `SELF JOIN`.
- **Aggregates**: `COUNT`, `SUM`, `AVG`, `MIN`, `MAX`.
- **Conditional & String Expressions**: `CASE ... WHEN ... THEN ... ELSE ... END`, `COALESCE`, `NULLIF`, `LIKE`, `GLOB`, `SUBSTR`, `LENGTH`, `UPPER`, `LOWER`, `TRIM`.
- **Subqueries**: Scalar subqueries, correlated subqueries, `IN (...)`, `NOT IN (...)`, `EXISTS (...)`, `NOT EXISTS (...)`, Common Table Expressions (`WITH`).
- **DML (when problem specifies state modification)**: `INSERT`, `UPDATE`, `DELETE`.

---

## 3. Question Format & Data Model
SQL questions are defined persistently in the database (`sql_questions` and `sql_test_cases`):

```json
{
  "type": "sql",
  "title": "Find Students Scoring Above Average",
  "description": "Write a SQL query to return the name and marks of all students whose marks exceed the class average, sorted by marks descending.",
  "difficulty": "Medium",
  "marks": 10,
  "time_limit_ms": 2000,
  "schema_sql": "CREATE TABLE students (\n  id INTEGER PRIMARY KEY,\n  name TEXT,\n  department TEXT,\n  marks INTEGER\n);",
  "sample_data_sql": "INSERT INTO students VALUES\n(1, 'Sai', 'DS', 92),\n(2, 'Rahul', 'CSE', 81),\n(3, 'Anu', 'DS', 88),\n(4, 'Ravi', 'CSE', 75);",
  "sample_expected_output": "name | marks\nSai | 92\nAnu | 88",
  "order_sensitive": true,
  "test_cases": [
    {
      "setup_sql": "",
      "expected_output": "name | marks\nSai | 92\nAnu | 88",
      "is_sample": true,
      "is_hidden": false,
      "weight": 1
    },
    {
      "setup_sql": "INSERT INTO students VALUES (5, 'Meera', 'ECE', 95), (6, 'Arjun', 'IT', 70);",
      "expected_output": "name | marks\nMeera | 95\nSai | 92\nAnu | 88",
      "is_sample": false,
      "is_hidden": true,
      "weight": 2
    }
  ]
}
```

---

## 4. Lifecycle & Runtime Database Isolation
1. **Never Connect to Supabase or Host**: Untrusted student SQL **never** interacts with Supabase, PostgreSQL, or host file systems.
2. **Per-Job Ephemeral SQLite Database**: Every test case execution creates a distinct, temporary SQLite database at a unique file path (e.g. `/tmp/smartzero-sql/<jobId>-tc<idx>.db`).
3. **Execution Pipeline**:
   - Create ephemeral SQLite database.
   - Execute question `schema_sql`.
   - Execute base `sample_data_sql` and test-case-specific `setup_sql`.
   - Execute student's SQL query under a strict timeout (default 2000ms).
   - Format and normalize the returned tabular results.
   - Compare normalized results against `expected_output`.
   - Calculate score and verdicts.
4. **Guaranteed Destruction**: All database files (`.db`, `-wal`, `-shm`, `-journal`) and connection handles are strictly closed and unlinked in `finally` blocks, regardless of whether execution succeeds, fails, throws an error, or times out.

---

## 5. Result Comparison & Normalization
To ensure 100% deterministic, robust judging without false rejections:

### Normalization Rules
1. **Cell Values**:
   - Strings: Leading/trailing whitespace trimmed.
   - Numbers: Integers vs floats normalized (e.g. `1` vs `1.0` vs `1.000` compare equal when numeric values match).
   - `NULL` values: Uniformly represented as `NULL`.
   - Booleans: Evaluated consistently (`1`/`0`/`true`/`false`).
2. **Column Matching**:
   - Number of columns must strictly match expected output.
   - Column names are checked case-insensitively when headers are present.
3. **Row Matching**:
   - Row counts must strictly match.
   - **`order_sensitive = true`**: Row $i$ in student output must strictly match row $i$ in expected output.
   - **`order_sensitive = false`**: Rows are treated as a multiset (bag). Each row's frequency count in actual output must exactly equal its frequency count in expected output, allowing arbitrary order without altering duplicate counts.

---

## 6. Run Code vs. Submit Code

| Aspect | Run Code | Submit Code |
| :--- | :--- | :--- |
| **Dataset Used** | Sample dataset only | Sample + all hidden test cases |
| **Output Returned** | Formatted table (columns, rows, execution time) | Summary verdict, test case counts passed/failed |
| **Hidden Data Leakage** | Zero (only sample data visible) | Zero (hidden outputs strictly masked) |
| **Scoring** | 0 marks awarded | Weighted partial marks computed server-side |
| **Leaderboard Impact** | None | Updates official participant score & ranking |

---

## 7. Security Controls
- **Forbidden SQLite Commands**:
  - `ATTACH DATABASE` / `DETACH DATABASE`: Blocked before execution.
  - `load_extension()`: Blocked and disabled.
  - `PRAGMA`: Blocked to prevent cache, temp_store, or filesystem manipulation.
  - File path patterns / Directory traversal (`/`, `..`, `\`) in SQL statements are rejected.
- **Sandboxed Execution**: Runs inside Docker container sandbox (`smartzero-judge-worker`) with `--network none`, `--read-only`, and resource constraints.
- **Fail-Closed**: If judge worker is unreachable, returns `503 JUDGE_UNAVAILABLE` rather than falling back to host execution.
- **Zero Cross-Student Leakage**: Every student draft is strictly isolated by `userId + contestSlug + questionId + language`.

---

## 8. Reference Example Question

### Problem: High Earners by Department
**Description**: Find all employees whose salary exceeds $80,000, ordered by salary descending.

**Schema DDL**:
```sql
CREATE TABLE employees (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  department TEXT NOT NULL,
  salary INTEGER NOT NULL
);
```

**Sample Data DDL**:
```sql
INSERT INTO employees VALUES
(1, 'Alice', 'Engineering', 95000),
(2, 'Bob', 'Marketing', 65000),
(3, 'Charlie', 'Engineering', 82000),
(4, 'Diana', 'Sales', 78000);
```

**Expected Solution**:
```sql
SELECT name, salary
FROM employees
WHERE salary > 80000
ORDER BY salary DESC;
```

**Sample Output**:
```
name    | salary
Alice   | 95000
Charlie | 82000
```
