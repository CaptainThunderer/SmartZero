import {fallbackProvider} from "./fallback";
import {featherlessProvider} from "./featherless";
import type {AIProvider} from "./provider";

function resilient(primary:AIProvider):AIProvider{
  return {
    async interpretQuestion(input){try{return await primary.interpretQuestion(input)}catch{return await fallbackProvider.interpretQuestion(input)}},
    async createLesson(task){try{return await primary.createLesson(task)}catch{return await fallbackProvider.createLesson(task)}},
    async generateHint(context){try{return await primary.generateHint(context)}catch{return fallbackProvider.generateHint(context)}}
  };
}
export function getAIProvider(){return process.env.SMARTZERO_ENABLE_LIVE_AI!=="false"&&!!process.env.FEATHERLESS_API_KEY?resilient(featherlessProvider):fallbackProvider;}
