import { NextResponse } from "next/server";
import { getAIProvider } from "../../../ai";
import { InterpretRequestSchema } from "../../../ai/schemas";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = InterpretRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Question is required and must be 1-5000 characters." },
        { status: 400 }
      );
    }
    const task = await getAIProvider().interpretQuestion(parsed.data.question, parsed.data.context);
    return NextResponse.json(task);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "AI request failed" },
      { status: 500 }
    );
  }
}
