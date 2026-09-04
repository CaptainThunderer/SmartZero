import type {DSATask} from "../ai/schemas";
import type {Lesson} from "../types/dsa";
import {getAIProvider} from "../ai";
export async function createLessonPlan(task:DSATask):Promise<Lesson|null>{return getAIProvider().createLesson(task);}
