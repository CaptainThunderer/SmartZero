import type { CodingLanguage, CodingSubmission } from "@/types/contest";
import { getStudentSubmissions } from "./service";
import { getContestQuestions, listParticipants } from "../contest/service";

export interface MatchingRegion {
  line_start_a: number;
  line_end_a: number;
  line_start_b: number;
  line_end_b: number;
  snippet_a: string;
  snippet_b: string;
}

export type SimilarityReviewStatus =
  | "Requires review"
  | "Similarity detected"
  | "Low similarity";

export interface PairwiseComparisonRecord {
  id: string;
  question_id: string;
  question_title?: string;
  language: CodingLanguage;
  submission_a: {
    id: string;
    user_id: string;
    display_name: string;
    submitted_at: string;
    code: string;
  };
  submission_b: {
    id: string;
    user_id: string;
    display_name: string;
    submitted_at: string;
    code: string;
  };
  similarity_score: number; // 0 to 100
  status: SimilarityReviewStatus;
  matching_regions: MatchingRegion[];
  analyzed_at: string;
}

export interface ContestSimilarityReport {
  contest_id: string;
  total_comparisons: number;
  flagged_pairs_count: number;
  comparisons: PairwiseComparisonRecord[];
  analyzed_at: string;
}

/**
 * 1. Comment Normalization
 * Removes single-line and multi-line comments for Python, JS, C++, Java.
 */
export function stripComments(code: string, language: CodingLanguage): string {
  if (language === "python") {
    // Strip # comments and """/''' docstrings
    return code
      .replace(/#.*$/gm, "")
      .replace(/("""[\s\S]*?"""|'''[\s\S]*?''')/g, "");
  }

  // C-family languages (JS, TS, C++, Java)
  return code
    .replace(/\/\*[\s\S]*?\*\//g, "") // multi-line /* */
    .replace(/\/\/.*$/gm, ""); // single-line //
}

/**
 * 2. Whitespace Normalization
 */
export function normalizeWhitespace(code: string): string {
  return code
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/^\s*[\r\n]/gm, "")
    .trim();
}

/**
 * 3. Lexical Tokenizer & Identifier Normalization
 * Replaces user-defined variables/identifiers with generic tokens (VAR_0, VAR_1)
 * while preserving core language syntax keywords.
 */
const KEYWORDS = new Set([
  "def", "class", "return", "if", "else", "elif", "for", "while", "import", "from",
  "in", "range", "len", "print", "function", "const", "let", "var", "switch", "case",
  "break", "continue", "int", "void", "include", "using", "namespace", "std", "public",
  "static", "class", "new", "try", "catch", "throw", "true", "false", "null", "undefined",
]);

export function tokenizeAndNormalize(code: string, language: CodingLanguage): string[] {
  const cleanCode = normalizeWhitespace(stripComments(code, language));
  // Split on symbols and whitespace
  const rawTokens = cleanCode.split(/([a-zA-Z_][a-zA-Z0-9_]*|==|!=|<=|>=|&&|\|\||[{}()[\];,+\-*/%=<>!])/g)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);

  const identifierMap = new Map<string, string>();
  let varCounter = 0;

  const normalizedTokens: string[] = [];

  for (const token of rawTokens) {
    if (KEYWORDS.has(token)) {
      normalizedTokens.push(token);
    } else if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(token)) {
      // Identifier: normalize to generic token
      let norm = identifierMap.get(token);
      if (!norm) {
        norm = `V_${varCounter++}`;
        identifierMap.set(token, norm);
      }
      normalizedTokens.push(norm);
    } else {
      // Operator, delimiter, number or literal
      normalizedTokens.push(token);
    }
  }

  return normalizedTokens;
}

/**
 * 4. K-gram Shingling and Jaccard Token Similarity
 */
export function computeTokenSimilarity(tokensA: string[], tokensB: string[], k = 4): number {
  if (tokensA.length === 0 || tokensB.length === 0) return 0;

  if (tokensA.length < k || tokensB.length < k) {
    // Fallback to simple set comparison for very small snippets
    const setA = new Set(tokensA);
    const setB = new Set(tokensB);
    const intersection = [...setA].filter((t) => setB.has(t)).length;
    const union = new Set([...setA, ...setB]).size;
    return union > 0 ? intersection / union : 0;
  }

  const kgramsA = new Set<string>();
  for (let i = 0; i <= tokensA.length - k; i++) {
    kgramsA.add(tokensA.slice(i, i + k).join("~"));
  }

  const kgramsB = new Set<string>();
  for (let i = 0; i <= tokensB.length - k; i++) {
    kgramsB.add(tokensB.slice(i, i + k).join("~"));
  }

  let intersectionCount = 0;
  kgramsA.forEach((gram) => {
    if (kgramsB.has(gram)) {
      intersectionCount++;
    }
  });

  const unionSize = new Set([...kgramsA, ...kgramsB]).size;
  return unionSize > 0 ? intersectionCount / unionSize : 0;
}

/**
 * 5. Pairwise Code Comparison
 * Compares two submissions and extracts matching structural lines.
 */
export function compareSubmissions(
  subA: { id: string; user_id: string; display_name: string; submitted_at: string; code: string },
  subB: { id: string; user_id: string; display_name: string; submitted_at: string; code: string },
  questionId: string,
  language: CodingLanguage,
  questionTitle?: string
): PairwiseComparisonRecord {
  const tokensA = tokenizeAndNormalize(subA.code, language);
  const tokensB = tokenizeAndNormalize(subB.code, language);

  const jaccard = computeTokenSimilarity(tokensA, tokensB, 4);
  const similarityScore = Math.min(100, Math.round(jaccard * 100));

  // Determine neutral review status
  let status: SimilarityReviewStatus = "Low similarity";
  if (similarityScore >= 80) {
    status = "Requires review";
  } else if (similarityScore >= 55) {
    status = "Similarity detected";
  }

  // Find matching lines
  const linesA = subA.code.split("\n");
  const linesB = subB.code.split("\n");
  const matchingRegions: MatchingRegion[] = [];

  for (let i = 0; i < linesA.length; i++) {
    const trimmedA = linesA[i].trim();
    if (trimmedA.length < 8) continue; // skip trivial brackets

    for (let j = 0; j < linesB.length; j++) {
      const trimmedB = linesB[j].trim();
      if (trimmedA === trimmedB) {
        matchingRegions.push({
          line_start_a: i + 1,
          line_end_a: i + 1,
          line_start_b: j + 1,
          line_end_b: j + 1,
          snippet_a: linesA[i],
          snippet_b: linesB[j],
        });
        break;
      }
    }
  }

  return {
    id: `sim-${subA.id}-${subB.id}`,
    question_id: questionId,
    question_title: questionTitle,
    language,
    submission_a: subA,
    submission_b: subB,
    similarity_score: similarityScore,
    status,
    matching_regions: matchingRegions.slice(0, 5), // top 5 regions
    analyzed_at: new Date().toISOString(),
  };
}

/**
 * 6. Contest-Wide Similarity Analysis
 * Performs pairwise comparisons across all participant submissions per question.
 */
export async function analyzeContestCodeSimilarity(
  contestId: string,
  questionIdFilter?: string
): Promise<ContestSimilarityReport> {
  const participants = await listParticipants(contestId);
  const questions = await getContestQuestions(contestId, "admin");

  const codingQuestions = questions.filter((q) => q.question_type === "coding");
  const comparisons: PairwiseComparisonRecord[] = [];

  for (const cq of codingQuestions) {
    if (questionIdFilter && cq.question_id !== questionIdFilter) {
      continue;
    }

    // Collect all best/latest submissions for this coding question
    const questionSubmissions: Array<{
      sub: CodingSubmission;
      displayName: string;
    }> = [];

    for (const p of participants) {
      const subs = await getStudentSubmissions(contestId, p.user_id, cq.question_id);
      if (subs.length > 0) {
        // take latest or best submission
        const best = subs.reduce((a, b) => (b.score > a.score ? b : a));
        questionSubmissions.push({
          sub: best,
          displayName:
            p.user_profile?.full_name || p.user_profile?.email || `Contestant ${p.user_id.slice(-4)}`,
        });
      }
    }

    // Pairwise comparison of all distinct student pairs
    for (let i = 0; i < questionSubmissions.length; i++) {
      for (let j = i + 1; j < questionSubmissions.length; j++) {
        const itemA = questionSubmissions[i];
        const itemB = questionSubmissions[j];

        if (itemA.sub.user_id === itemB.sub.user_id) continue;
        if (itemA.sub.language !== itemB.sub.language) continue; // compare same language

        const pairResult = compareSubmissions(
          {
            id: itemA.sub.id,
            user_id: itemA.sub.user_id,
            display_name: itemA.displayName,
            submitted_at: itemA.sub.submitted_at,
            code: itemA.sub.code,
          },
          {
            id: itemB.sub.id,
            user_id: itemB.sub.user_id,
            display_name: itemB.displayName,
            submitted_at: itemB.sub.submitted_at,
            code: itemB.sub.code,
          },
          cq.question_id,
          itemA.sub.language,
          cq.coding_details?.title
        );

        comparisons.push(pairResult);
      }
    }
  }

  // Sort by similarity score DESC
  comparisons.sort((a, b) => b.similarity_score - a.similarity_score);

  const flaggedCount = comparisons.filter((c) => c.status !== "Low similarity").length;

  return {
    contest_id: contestId,
    total_comparisons: comparisons.length,
    flagged_pairs_count: flaggedCount,
    comparisons,
    analyzed_at: new Date().toISOString(),
  };
}
