import { NextResponse } from "next/server";
import { priorityJudgeQueue } from "@/lib/judge/queue/priorityQueue";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    ready: true,
    worker: "smartzero-judge",
    runtimes: ["python", "javascript", "typescript", "cpp", "java"],
    concurrency: priorityJudgeQueue.getConcurrency(),
    memory_mb: 512,
  });
}
