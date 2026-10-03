import { NextResponse } from "next/server";
import { getContestBySlug } from "@/lib/contest/service";
import { getStudentContestResult } from "@/lib/contest/analytics";
import { getAuthenticatedUser, validateStudentIdentity } from "@/lib/auth/studentSession";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const contest = await getContestBySlug(slug);

  if (!contest) {
    return NextResponse.json({ error: "Contest not found." }, { status: 404 });
  }

  const authUser = await getAuthenticatedUser(req);
  if (!authUser) {
    return NextResponse.json({ error: "Authentication required to view results." }, { status: 401 });
  }

  const url = new URL(req.url);
  const requestedUserId = url.searchParams.get("user_id");

  const identityCheck = validateStudentIdentity(authUser, requestedUserId);
  if (!identityCheck.authorized) {
    return NextResponse.json({ error: identityCheck.error }, { status: identityCheck.status || 403 });
  }

  const userId = identityCheck.authoritativeUserId;

  const result = await getStudentContestResult(contest.id, userId);

  if (!result) {
    return NextResponse.json(
      { error: "No participation record found for this contest." },
      { status: 404 }
    );
  }

  return NextResponse.json({
    success: true,
    result,
  });
}
