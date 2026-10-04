import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/studentSession";

export async function GET(req: Request) {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    return NextResponse.json({ authenticated: false, user: null }, { status: 200 });
  }

  return NextResponse.json(
    {
      authenticated: true,
      user: {
        id: user.userId,
        email: user.email,
        full_name: user.fullName,
        role: user.role,
        source: user.source,
        student_id: user.profile?.student_id || "",
        college: user.profile?.college || "",
        account_status: user.profile?.account_status || "verified",
      },
    },
    { status: 200 }
  );
}
