import * as XLSX from "xlsx";
import { addMcqQuestion, addCodingQuestion, linkQuestionToContest } from "./service";
import type { ContestQuestion, QuestionDifficulty } from "../../types/contest";

export type ImportFormat = "json" | "csv" | "xlsx" | "unsupported";

export interface ParsedImportMcq {
  type: "mcq";
  question_text: string;
  explanation?: string;
  difficulty?: QuestionDifficulty;
  marks: number;
  negative_marks?: number;
  options: { option_text: string; is_correct: boolean }[];
}

export interface ParsedImportCoding {
  type: "coding";
  title: string;
  description: string;
  input_format?: string;
  output_format?: string;
  constraints?: string;
  difficulty?: QuestionDifficulty;
  time_limit_ms?: number;
  memory_limit_mb?: number;
  marks: number;
  test_cases: {
    input: string;
    expected_output: string;
    is_hidden?: boolean;
    is_sample?: boolean;
    weight?: number;
  }[];
}

export type ParsedImportQuestion = ParsedImportMcq | ParsedImportCoding;

export interface ValidationErrorItem {
  row: number;
  field?: string;
  message: string;
}

export interface ValidationResult {
  format: ImportFormat;
  totalParsed: number;
  validQuestions: ParsedImportQuestion[];
  errors: ValidationErrorItem[];
  warnings: ValidationErrorItem[];
}

/**
 * Detects import file format based on filename extension or content.
 */
export function detectFormat(filename: string): ImportFormat {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".json")) return "json";
  if (lower.endsWith(".csv")) return "csv";
  if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) return "xlsx";
  return "unsupported";
}

/**
 * Parses raw file buffer into an array of unvalidated question row records.
 */
export function parseRawFile(format: ImportFormat, buffer: Buffer): Record<string, unknown>[] {
  if (format === "json") {
    try {
      const text = buffer.toString("utf-8");
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        return parsed as Record<string, unknown>[];
      }
      if (parsed && Array.isArray(parsed.questions)) {
        return parsed.questions as Record<string, unknown>[];
      }
      throw new Error("JSON file must contain an array of question objects");
    } catch (e) {
      throw new Error(`Invalid JSON syntax: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  if (format === "csv" || format === "xlsx") {
    try {
      const workbook = XLSX.read(buffer, { type: "buffer" });
      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) throw new Error("Spreadsheet contains no worksheets");
      const sheet = workbook.Sheets[firstSheetName];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
      return rows;
    } catch (e) {
      throw new Error(`Failed to parse spreadsheet: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  throw new Error("Unsupported file format. Please upload JSON, CSV, or XLSX.");
}

/**
 * Normalizes and validates raw rows into structured ParsedImportQuestion objects.
 */
export function validateImportQuestions(
  rawRows: Record<string, unknown>[],
  format: ImportFormat
): ValidationResult {
  const validQuestions: ParsedImportQuestion[] = [];
  const errors: ValidationErrorItem[] = [];
  const warnings: ValidationErrorItem[] = [];

  const seenPrompts = new Set<string>();

  rawRows.forEach((row, idx) => {
    const rowNum = idx + 1;
    const rawType = String(row.type || row.question_type || "").toLowerCase().trim();

    // 1. Validate Question Type
    if (!rawType || (rawType !== "mcq" && rawType !== "coding")) {
      errors.push({
        row: rowNum,
        field: "type",
        message: `Invalid or missing question type '${rawType || "(empty)"}'. Must be 'mcq' or 'coding'.`,
      });
      return;
    }

    const marks = Number(row.marks ?? (rawType === "mcq" ? 1 : 5));
    if (isNaN(marks) || marks <= 0) {
      errors.push({
        row: rowNum,
        field: "marks",
        message: `Marks must be a positive number (found: ${row.marks}).`,
      });
      return;
    }

    const negativeMarks = Number(row.negative_marks || row.penalty || 0);
    if (isNaN(negativeMarks) || negativeMarks < 0) {
      errors.push({
        row: rowNum,
        field: "negative_marks",
        message: `Negative marks cannot be negative (found: ${row.negative_marks}).`,
      });
      return;
    }

    const difficulty = (String(row.difficulty || "Medium").trim() as QuestionDifficulty) || "Medium";

    // ── MCQ VALIDATION ──
    if (rawType === "mcq") {
      const questionText = String(row.question_text || row.question || row.prompt || "").trim();
      if (!questionText) {
        errors.push({
          row: rowNum,
          field: "question_text",
          message: "MCQ question text is required.",
        });
        return;
      }

      if (seenPrompts.has(questionText.toLowerCase())) {
        warnings.push({
          row: rowNum,
          field: "question_text",
          message: `Duplicate question detected: "${questionText.slice(0, 40)}..."`,
        });
      }
      seenPrompts.add(questionText.toLowerCase());

      // Parse options (handles JSON array or flat columns: option_a, option_b, option_c, option_d)
      let options: { option_text: string; is_correct: boolean }[] = [];

      if (Array.isArray(row.options)) {
        options = (row.options as Array<Record<string, unknown>>).map((opt) => ({
          option_text: String(opt.option_text || opt.text || "").trim(),
          is_correct: Boolean(opt.is_correct || opt.correct),
        }));
      } else {
        // Check flat spreadsheet columns
        const optA = String(row.option_a || row.option1 || row.a || "").trim();
        const optB = String(row.option_b || row.option2 || row.b || "").trim();
        const optC = String(row.option_c || row.option3 || row.c || "").trim();
        const optD = String(row.option_d || row.option4 || row.d || "").trim();

        const correctAns = String(row.correct_answer || row.correct_option || row.answer || "")
          .toUpperCase()
          .trim();

        if (optA) options.push({ option_text: optA, is_correct: correctAns === "A" || correctAns === "1" });
        if (optB) options.push({ option_text: optB, is_correct: correctAns === "B" || correctAns === "2" });
        if (optC) options.push({ option_text: optC, is_correct: correctAns === "C" || correctAns === "3" });
        if (optD) options.push({ option_text: optD, is_correct: correctAns === "D" || correctAns === "4" });
      }

      // Filter empty options
      options = options.filter((o) => o.option_text.length > 0);

      if (options.length < 2) {
        errors.push({
          row: rowNum,
          field: "options",
          message: `MCQ must have at least 2 non-empty options (found: ${options.length}).`,
        });
        return;
      }

      const correctCount = options.filter((o) => o.is_correct).length;
      if (correctCount === 0) {
        errors.push({
          row: rowNum,
          field: "correct_answer",
          message: "No correct answer designated for MCQ. At least one option must have is_correct: true.",
        });
        return;
      }

      validQuestions.push({
        type: "mcq",
        question_text: questionText,
        explanation: String(row.explanation || "").trim(),
        difficulty,
        marks,
        negative_marks: negativeMarks,
        options,
      });
    }

    // ── CODING QUESTION VALIDATION ──
    if (rawType === "coding") {
      const title = String(row.title || row.problem_title || "").trim();
      const description = String(row.description || row.problem_description || "").trim();

      if (!title) {
        errors.push({
          row: rowNum,
          field: "title",
          message: "Coding problem title is required.",
        });
        return;
      }

      if (!description) {
        errors.push({
          row: rowNum,
          field: "description",
          message: "Coding problem description is required.",
        });
        return;
      }

      if (seenPrompts.has(title.toLowerCase())) {
        warnings.push({
          row: rowNum,
          field: "title",
          message: `Duplicate coding problem detected: "${title}".`,
        });
      }
      seenPrompts.add(title.toLowerCase());

      // Parse test cases
      let testCases: Array<{
        input: string;
        expected_output: string;
        is_hidden?: boolean;
        is_sample?: boolean;
        weight?: number;
      }> = [];

      if (Array.isArray(row.test_cases)) {
        testCases = (row.test_cases as Array<Record<string, unknown>>).map((tc) => ({
          input: String(tc.input ?? "").trim(),
          expected_output: String(tc.expected_output ?? tc.output ?? "").trim(),
          is_hidden: Boolean(tc.is_hidden ?? true),
          is_sample: Boolean(tc.is_sample ?? false),
          weight: Number(tc.weight || 1),
        }));
      } else if (typeof row.test_cases === "string" && row.test_cases.trim().startsWith("[")) {
        try {
          const parsedTc = JSON.parse(row.test_cases);
          if (Array.isArray(parsedTc)) {
            testCases = parsedTc.map((tc) => ({
              input: String(tc.input ?? "").trim(),
              expected_output: String(tc.expected_output ?? tc.output ?? "").trim(),
              is_hidden: Boolean(tc.is_hidden ?? true),
              is_sample: Boolean(tc.is_sample ?? false),
              weight: Number(tc.weight || 1),
            }));
          }
        } catch {
          // Fall through
        }
      } else {
        // Flat spreadsheet sample test case columns
        const sampleIn = String(row.sample_input || row.input || "").trim();
        const sampleOut = String(row.sample_output || row.output || "").trim();
        if (sampleIn || sampleOut) {
          testCases.push({
            input: sampleIn,
            expected_output: sampleOut,
            is_sample: true,
            is_hidden: false,
            weight: 1,
          });
        }
      }

      if (testCases.length === 0) {
        warnings.push({
          row: rowNum,
          field: "test_cases",
          message: "No test cases provided for coding question. At least 1 sample test case is strongly advised.",
        });
      }

      validQuestions.push({
        type: "coding",
        title,
        description,
        input_format: String(row.input_format || "").trim(),
        output_format: String(row.output_format || "").trim(),
        constraints: String(row.constraints || "").trim(),
        difficulty,
        time_limit_ms: Number(row.time_limit_ms || 2000),
        memory_limit_mb: Number(row.memory_limit_mb || 256),
        marks,
        test_cases: testCases,
      });
    }
  });

  return {
    format,
    totalParsed: rawRows.length,
    validQuestions,
    errors,
    warnings,
  };
}

/**
 * Persists validated questions into the database/service and links them to the contest.
 */
export async function persistImportedQuestions(
  contestId: string,
  questions: ParsedImportQuestion[]
): Promise<{ importedCount: number; linkedQuestions: ContestQuestion[] }> {
  const linkedQuestions: ContestQuestion[] = [];

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];

    if (q.type === "mcq") {
      const createdMcq = await addMcqQuestion({
        question_text: q.question_text,
        explanation: q.explanation,
        difficulty: q.difficulty,
        options: q.options,
      });

      const linked = await linkQuestionToContest({
        contest_id: contestId,
        question_id: createdMcq.id,
        question_type: "mcq",
        marks: q.marks,
        negative_marks: q.negative_marks || 0,
        sort_order: i,
      });

      linkedQuestions.push(linked);
    } else if (q.type === "coding") {
      const createdCode = await addCodingQuestion({
        title: q.title,
        description: q.description,
        input_format: q.input_format,
        output_format: q.output_format,
        constraints: q.constraints,
        difficulty: q.difficulty,
        time_limit_ms: q.time_limit_ms,
        memory_limit_mb: q.memory_limit_mb,
        test_cases: q.test_cases,
      });

      const linked = await linkQuestionToContest({
        contest_id: contestId,
        question_id: createdCode.id,
        question_type: "coding",
        marks: q.marks,
        sort_order: i,
      });

      linkedQuestions.push(linked);
    }
  }

  return {
    importedCount: linkedQuestions.length,
    linkedQuestions,
  };
}
