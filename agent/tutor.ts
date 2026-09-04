import {getAIProvider} from "../ai";
export async function generateHint(context:unknown){return getAIProvider().generateHint(context);}
