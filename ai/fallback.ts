import { lessonFromId } from "../engine/lessons";
import { interpretDSAQuery } from "../agent/nlu";
import type { AIProvider } from "./provider";

export const fallbackProvider: AIProvider = {
  async interpretQuestion(input, context) {
    const task = interpretDSAQuery(input, context);
    const lesson = task.customLesson || (task.lessonId ? lessonFromId(task.lessonId, task.inputData) : null);
    return {
      ...task,
      rawQuestion: input,
      dataStructure: lesson?.dataStructure || task.category,
      pattern: lesson?.pattern || task.pattern,
      objective: lesson?.objective || task.objective,
      difficulty: lesson?.difficulty || task.difficulty,
    };
  },

  async createLesson(task) {
    return task.customLesson || (task.lessonId ? lessonFromId(task.lessonId, task.inputData) : null);
  },

  async generateHint() {
    return "Look at the current pointer and compare the value with the variable shown on the canvas.";
  },
};
