import {interpretQuestion} from "./interpreter";
import {createLessonPlan} from "./planner";
export async function runSmartZeroAgent(question:string){const task=await interpretQuestion(question);const lesson=await createLessonPlan(task);return {task,lesson};}
