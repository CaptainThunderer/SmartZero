import { lessonFromId, SUPPORTED_LESSONS } from "../engine/lessons";
import type { AIProvider } from "./provider";

export const fallbackProvider: AIProvider = {
  async interpretQuestion(input) {
    const q = input.toLowerCase();
    let lessonId: string | null = null;

    if (/second\s*(max|largest|minimum|biggest)/.test(q)) lessonId = "second-max";
    else if (/bst|binary\s*search\s*tree|\btree\b|insert.*tree/.test(q)) lessonId = "bst-insert";
    else if (/binary\s*search/.test(q)) lessonId = "binary-search";
    else if (/linked\s*list|reverse.*list/.test(q)) lessonId = "linked-list-reverse";

    const lesson = lessonId ? lessonFromId(lessonId) : null;

    return {
      lessonId,
      rawQuestion: input,
      dataStructure: lesson?.dataStructure,
      pattern: lesson?.pattern,
      objective: lesson?.objective,
      difficulty: lesson?.difficulty,
    };
  },

  async createLesson(task) {
    return task.lessonId ? lessonFromId(task.lessonId) : null;
  },

  async generateHint() {
    return "Look at the current pointer and compare the value with the variable shown on the canvas.";
  },
};
