import { NextResponse } from "next/server";
import { getAIProvider } from "../../../ai";
import { LessonRequestSchema } from "../../../ai/schemas";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON in request body." },
      { status: 400 }
    );
  }

  try {
    const parsed = LessonRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid lesson request." },
        { status: 400 }
      );
    }
    const lesson = await getAIProvider().createLesson(parsed.data);
    if (!lesson) {
      return NextResponse.json(
        { error: "No supported lesson was generated." },
        { status: 422 }
      );
    }
    return NextResponse.json(lesson);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Lesson generation failed" },
      { status: 500 }
    );
  }
}
