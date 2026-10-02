import { NextResponse } from "next/server";
import { getPublicContestSummaries } from "@/lib/contest/service";

export async function GET() {
  try {
    const contests = await getPublicContestSummaries();
    return NextResponse.json({ contests });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load contests." },
      { status: 500 }
    );
  }
}
