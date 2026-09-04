import {DSATaskSchema, AIResponseSchema, type DSATask} from "./schemas";
import {lessonFromId} from "../engine/lessons";
import type {AIProvider} from "./provider";
const base=process.env.FEATHERLESS_BASE_URL||"https://api.featherless.ai/v1";
const model=process.env.FEATHERLESS_MODEL||"Qwen/Qwen3-32B";
async function chat(system:string,user:string){const key=process.env.FEATHERLESS_API_KEY;if(!key)throw new Error("FEATHERLESS_API_KEY is not configured");const r=await fetch(`${base}/chat/completions`,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${key}`},body:JSON.stringify({model,messages:[{role:"system",content:system},{role:"user",content:user}],temperature:0.2,max_tokens:900}),signal:AbortSignal.timeout(20000)});if(!r.ok)throw new Error(`Featherless request failed: ${r.status}`);const data=await r.json();return data?.choices?.[0]?.message?.content??"";}
function parseJson(text:string){const cleaned=text.replace(/^```json\s*/i,"").replace(/```$/i,"").trim();return JSON.parse(cleaned);}
export const featherlessProvider:AIProvider={
 async interpretQuestion(input:string){const raw=await chat("You are SmartZero, a DSA teaching planner. Return ONLY JSON with keys lessonId, dataStructure, algorithm, pattern, objective, difficulty. lessonId must be one of second-max, binary-search, bst-insert, linked-list-reverse, or null. Do not invent unsupported lesson IDs.",input);const parsed=AIResponseSchema.parse(parseJson(raw));return DSATaskSchema.parse({...parsed,rawQuestion:input});},
 async createLesson(task){return task.lessonId?lessonFromId(task.lessonId):null;},
 async generateHint(context){return await chat("Give one concise Socratic hint for a DSA learner. Do not reveal the full answer. Plain text only.",JSON.stringify(context));}
};
