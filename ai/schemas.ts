import { z } from "zod";

export const DSATaskSchema = z.object({
  lessonId: z.string().nullable(),
  dataStructure: z.string().optional(),
  algorithm: z.string().optional(),
  pattern: z.string().optional(),
  objective: z.string().optional(),
  difficulty: z.string().optional(),
  rawQuestion: z.string(),
});
export type DSATask = z.infer<typeof DSATaskSchema>;

export const AIResponseSchema = z.object({
  lessonId: z.string().nullable(),
  dataStructure: z.string().optional(),
  algorithm: z.string().optional(),
  pattern: z.string().optional(),
  objective: z.string().optional(),
  difficulty: z.string().optional(),
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
});
