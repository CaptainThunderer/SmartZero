import { NextResponse } from "next/server";
import { getAIProvider } from "../../../ai";
import { HintRequestSchema } from "../../../ai/schemas";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = HintRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid hint request." },
        { status: 400 }
      );
    }
    const hint = await getAIProvider().generateHint(parsed.data);
    return NextResponse.json({ hint });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Hint generation failed" },
      { status: 500 }
    );
  }
}
