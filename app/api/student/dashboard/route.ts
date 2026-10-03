import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getPublicContestSummaries } from "@/lib/contest/service";
import { getAuthenticatedUser, validateStudentIdentity } from "@/lib/auth/studentSession";

export async function GET(req: Request) {
  const authUser = await getAuthenticatedUser(req);
  if (!authUser) {
    return NextResponse.json(
      { error: "Authentication required to view student dashboard." },
      { status: 401 }
    );
  }

  const url = new URL(req.url);
  const requestedUserId = url.searchParams.get("user_id");

  const identityCheck = validateStudentIdentity(authUser, requestedUserId);
  if (!identityCheck.authorized) {
    return NextResponse.json({ error: identityCheck.error }, { status: identityCheck.status || 403 });
  }

  const userId = identityCheck.authoritativeUserId;
  const userEmail = authUser.email;

  let profile = {
    id: userId,
    full_name: "SmartZero Learner",
    email: userEmail || "student@smartzero.edu",
    student_id: "",
    college: "",
    account_status: "verified",
  };

  let participants: Array<{
    id: string;
    contest_id: string;
    user_id: string;
    status: string;
    score: number;
    attempt_number: number;
    started_at: string | null;
    completed_at: string | null;
    violations_count: number;
    submission_reason?: string;
  }> = [];

  let submissions: Array<{
    id: string;
    language: string;
    verdict: string;
    score: number;
    created_at: string;
  }> = [];

  const publicContests = await getPublicContestSummaries();
  const supabase = await createSupabaseServerClient();

  if (supabase && userId !== "demo-student-user") {
    try {
      const { data: profData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();
      if (profData) {
        profile = {
          ...profile,
          ...profData,
          account_status: profData.account_status || "verified",
        };
      }

      const { data: partData } = await supabase
        .from("contest_participants")
        .select("*")
        .eq("user_id", userId);
      if (partData) {
        participants = partData;
      }

      const { data: subData } = await supabase
        .from("coding_submissions")
        .select("id, language, verdict, score, created_at")
        .eq("user_id", userId);
      if (subData) {
        submissions = subData;
      }
    } catch {
      // Fallback in case of network glitch
    }
  }

  // Derive stats
  const contestsParticipated = participants.length;
  const completedContests = participants.filter(
    (p) => p.status === "submitted" || p.status === "auto_submitted" || p.status === "finalized"
  );

  const totalScore = completedContests.reduce((acc, p) => acc + (p.score || 0), 0);
  const averageScore = completedContests.length > 0 ? Math.round(totalScore / completedContests.length) : 0;
  const highestScore = completedContests.length > 0 ? Math.max(...completedContests.map((p) => p.score || 0)) : 0;

  const totalSubmissions = submissions.length;
  const acceptedSolutions = submissions.filter((s) => s.verdict === "Accepted").length;

  const languageBreakdown: Record<string, number> = {};
  submissions.forEach((s) => {
    const lang = s.language || "python";
    languageBreakdown[lang] = (languageBreakdown[lang] || 0) + 1;
  });

  // Map recent contest summaries
  const contestMap = new Map(publicContests.map((c) => [c.id, c]));
  const recentContests = participants.map((p) => {
    const details = contestMap.get(p.contest_id);
    return {
      contest_id: p.contest_id,
      title: details?.title || "Assessment",
      slug: details?.slug || p.contest_id,
      status: p.status,
      score: p.score || 0,
      attempt_number: p.attempt_number || 1,
      completed_at: p.completed_at || p.started_at,
      violations_count: p.violations_count || 0,
      contest_status: details?.status || "LIVE",
    };
  });

  // Practice Recommendations
  const recommendations = [
    {
      title: "Binary Trees & BST",
      difficulty: "Medium",
      reason: "Common institutional assessment topic with high score weight.",
      actionUrl: "/",
    },
    {
      title: "Dynamic Programming Foundations",
      difficulty: "Hard",
      reason: "Boost algorithmic efficiency and edge-case handling under strict time limits.",
      actionUrl: "/",
    },
    {
      title: "Clean Code & Fast I/O in Python / C++",
      difficulty: "Easy",
      reason: "Optimize execution runtime within sandbox container limits.",
      actionUrl: "/contests",
    },
  ];

  return NextResponse.json({
    profile,
    stats: {
      total_contests_available: publicContests.length,
      contests_participated: contestsParticipated,
      contests_completed: completedContests.length,
      average_score: averageScore,
      highest_score: highestScore,
      total_submissions: totalSubmissions,
      accepted_solutions: acceptedSolutions,
      acceptance_rate: totalSubmissions > 0 ? Math.round((acceptedSolutions / totalSubmissions) * 100) : 0,
    },
    language_breakdown: languageBreakdown,
    recent_contests: recentContests,
    recommendations,
  });
}
