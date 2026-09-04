import { NextResponse } from "next/server";
import { EvaluateRequestSchema } from "../../../ai/schemas";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = EvaluateRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "expectedId and choiceId are required." },
        { status: 400 }
      );
    }
    return NextResponse.json({
      correct: parsed.data.expectedId === parsed.data.choiceId,
    });
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 }
    );
  }
}
