import type {DSATask} from "../ai/schemas";
import {getAIProvider} from "../ai";
export async function interpretQuestion(input:string):Promise<DSATask>{return getAIProvider().interpretQuestion(input);}
