import type {Lesson} from "../types/dsa";
import type {DSATask} from "./schemas";
export interface AIProvider { interpretQuestion(input:string):Promise<DSATask>; createLesson(task:DSATask):Promise<Lesson|null>; generateHint(context:unknown):Promise<string>; }
