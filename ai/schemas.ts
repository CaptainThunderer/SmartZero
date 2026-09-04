import { z } from "zod";

export const DSAIntentEnum = z.enum([
  "visualize",
  "explain",
  "theory",
  "implementation",
  "trace",
  "complexity",
  "compare",
  "problem_solving",
  "debugging",
  "code_explanation",
  "example",
  "edge_case",
  "clarification",
  "unsupported_non_dsa",
]);

export const SupportedLanguageEnum = z.enum(["javascript", "cpp", "python"]);

export const ProblemCandidateApproachSchema = z.object({
  name: z.string(),
  description: z.string(),
  timeComplexity: z.string(),
  spaceComplexity: z.string(),
  tradeoffs: z.string().optional(),
  recommended: z.boolean().optional(),
});

export const ProblemDryRunStepSchema = z.object({
  step: z.number(),
  stateDescription: z.string(),
  activeVariables: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
  explanation: z.string(),
});

export const ProblemVisualStepSchema = z.object({
  stepNumber: z.number(),
  title: z.string(),
  actions: z.array(z.any()),
  codeLine: z.string().optional(),
  narrative: z.object({
    currentStep: z.string(),
    why: z.string(),
    whatChanged: z.string(),
    whatToNotice: z.string(),
    keyInsight: z.string(),
    nextStep: z.string(),
  }),
});

export const ProblemSolutionPlanSchema = z.object({
  problemStatement: z.string(),
  normalizedProblem: z.string(),
  objective: z.string(),
  storyContext: z.string().optional(),
  inputs: z.array(z.string()),
  outputs: z.string(),
  constraints: z.array(z.string()),
  examples: z.array(
    z.object({
      input: z.string(),
      output: z.string(),
      explanation: z.string().optional(),
    })
  ),
  edgeCases: z.array(z.string()),
  topic: z.string(),
  category: z.string(),
  dataStructures: z.array(z.string()),
  patterns: z.array(z.string()),
  candidateApproaches: z.array(ProblemCandidateApproachSchema),
  selectedApproach: z.object({
    name: z.string(),
    timeComplexity: z.string(),
    spaceComplexity: z.string(),
    whySelected: z.string(),
  }),
  reasoning: z.string(),
  correctnessExplanation: z.string(),
  visualSteps: z.array(ProblemVisualStepSchema).optional(),
  dryRun: z.array(ProblemDryRunStepSchema),
  implementations: z.object({
    javascript: z.string(),
    cpp: z.string(),
    python: z.string(),
  }),
  complexity: z.object({
    time: z.string(),
    space: z.string(),
    rationale: z.string(),
  }),
  finalAnswer: z.string(),
  learnerQuestion: z.any().optional(),
});

export type ProblemSolutionPlan = z.infer<typeof ProblemSolutionPlanSchema>;

export const DSATaskSchema = z.object({
  intent: DSAIntentEnum.optional(),
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
  codeSnippet: z.object({ language: z.string(), code: z.string() }).optional(),
  codeSnippets: z.object({
    javascript: z.string().optional(),
    cpp: z.string().optional(),
    python: z.string().optional(),
  }).optional(),
  problemPlan: ProblemSolutionPlanSchema.optional(),
  customLesson: z.any().optional(),
});
export type DSATask = z.infer<typeof DSATaskSchema>;

export const AIResponseSchema = z.object({
  intent: DSAIntentEnum.optional(),
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

export const ProblemSpecSchema = z.object({
  originalQuestion: z.string(),
  cleanedStatement: z.string(),
  task: z.string(),
  inputs: z.array(z.string()),
  outputs: z.string(),
  constraints: z.array(z.string()),
  examples: z.array(
    z.object({
      input: z.string(),
      output: z.string(),
      explanation: z.string().optional(),
    })
  ),
  edgeCases: z.array(z.string()),
  knownTopic: z.string().nullable().optional(),
  algorithmCandidates: z.array(z.string()).optional(),
  requestedLanguage: SupportedLanguageEnum.optional(),
  visualizationPotential: z.boolean().optional(),
  ambiguity: z.string().optional(),
  confidence: z.number(),
});

export const ModelTaskTypeEnum = z.enum([
  "TEXT_PROBLEM_SOLVING",
  "DSA_REASONING",
  "CODE_GENERATION",
  "CODE_DEBUGGING",
  "LONG_CONTEXT",
  "VISION",
  "GENERAL_EXPLANATION",
  "COMPARISON",
  "COMPLEX_REASONING",
]);

export const InterpretRequestSchema = z.object({
  question: z.string().min(1).max(5000),
  imageBase64: z.string().optional(),
  context: z
    .object({
      topicId: z.string().nullable().optional(),
      lessonId: z.string().nullable().optional(),
      language: SupportedLanguageEnum.optional(),
      mode: z.string().optional(),
      teachSummary: z.string().optional(),
    })
    .optional(),
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
