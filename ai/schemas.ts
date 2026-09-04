import { z } from "zod";

export const DSATaskSchema = z.object({
  intent: z.enum(["visualize", "explain", "compare", "complexity", "clarification", "unsupported_non_dsa"]).optional(),
  lessonId: z.string().nullable(),
  topicId: z.string().nullable().optional(),
  category: z.string().optional(),
  subtopic: z.string().optional(),
  algorithm: z.string().optional(),
  pattern: z.string().optional(),
  objective: z.string().optional(),
  difficulty: z.string().optional(),
  rawQuestion: z.string(),
  inputData: z.array(z.number()).optional(),
  targetValue: z.union([z.number(), z.string()]).optional(),
  comparisonTopics: z.array(z.string()).optional(),
  explanation: z.string().optional(),
  clarificationOptions: z.array(z.object({ label: z.string(), query: z.string() })).optional(),
  complexity: z.object({
    time: z.string(),
    space: z.string(),
    best: z.string().optional(),
    worst: z.string().optional(),
  }).optional(),
});
export type DSATask = z.infer<typeof DSATaskSchema>;

export const AIResponseSchema = z.object({
  intent: z.enum(["visualize", "explain", "compare", "complexity", "clarification", "unsupported_non_dsa"]).optional(),
  lessonId: z.string().nullable(),
  topicId: z.string().nullable().optional(),
  category: z.string().optional(),
  subtopic: z.string().optional(),
  algorithm: z.string().optional(),
  pattern: z.string().optional(),
  objective: z.string().optional(),
  difficulty: z.string().optional(),
  explanation: z.string().optional(),
});

export const InterpretRequestSchema = z.object({
  question: z.string().min(1).max(5000),
});

export const EvaluateRequestSchema = z.object({
  expectedId: z.string().min(1),
  choiceId: z.string().min(1),
});

export const HintRequestSchema = z.object({
  lessonId: z.string().optional(),
  stepIndex: z.number().optional(),
  questionPrompt: z.string().optional(),
});

export const LessonRequestSchema = z.object({
  lessonId: z.string().nullable(),
  dataStructure: z.string().optional(),
  algorithm: z.string().optional(),
  pattern: z.string().optional(),
  objective: z.string().optional(),
  difficulty: z.string().optional(),
  rawQuestion: z.string(),
  inputData: z.array(z.number()).optional(),
});
