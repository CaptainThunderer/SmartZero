import type { Lesson } from "../types/dsa";
import type { DSATask } from "./schemas";

export type AIProviderName =
  | "gemini"
  | "openrouter"
  | "featherless"
  | "deterministic"
  | "fallback";

export interface AIProviderConfig {
  provider?: AIProviderName;
  model?: string;
  allowLiveAI?: boolean;
}

export interface AIProvider {
  name?: string;
  interpretQuestion(
    input: string,
    context?: {
      topicId?: string | null;
      lessonId?: string | null;
      language?: "javascript" | "cpp" | "python";
    }
  ): Promise<DSATask>;
  createLesson(task: DSATask): Promise<Lesson | null>;
  generateHint(context: unknown): Promise<string>;
}
