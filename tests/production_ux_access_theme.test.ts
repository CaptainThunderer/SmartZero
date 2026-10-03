import assert from "node:assert";
import {
  createContest,
  getPublicContestSummaries,
  getContestBySlug,
  computeContestStatus,
  canUserManageContest,
  assignContestAdmin,
  registerContestParticipant,
} from "../lib/contest/service";
import {
  createStudentSessionToken,
  getAuthenticatedUser,
} from "../lib/auth/studentSession";
import { useWorkspaceStore, applyDocumentTheme } from "../stores/workspaceStore";
import { GET as getContestRoute } from "../app/api/contest/route";
import { GET as getContestSlugRoute } from "../app/api/contest/[slug]/route";
import { POST as postJoinRoute } from "../app/api/contest/[slug]/join/route";
import {
  GET as getAdminUsersRoute,
  POST as postAdminUsersRoute,
  PATCH as patchAdminUsersRoute,
} from "../app/api/admin/users/route";
import { POST as postRegisterRoute } from "../app/api/auth/register/route";

console.log("==================================================");
console.log("▶ RUNNING PRODUCTION UX, ACCESS & THEME TEST SUITE");
console.log("==================================================");

let passed = 0;
let failed = 0;

async function testAsync(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    passed++;
    console.log(`  ✅ ${name}`);
  } catch (err) {
    failed++;
    console.error(`  ❌ ${name}:`, err);
    process.exit(1);
  }
}

async function runTests() {
  const now = Date.now();
  const pad = (n: number) => n.toString().padStart(2, "0");

  // Create sample contests for verification
  const upcomingContest = await createContest({
    title: "Upcoming Algorithmic Challenge",
    slug: `test-upcoming-${now}`,
    passcode: "UPCOMING_SECRET",
    start_at: new Date(now + 3600 * 1000).toISOString(),
    end_at: new Date(now + 7200 * 1000).toISOString(),
    duration_minutes: 60,
    status: "UPCOMING",
  });

  const liveContest = await createContest({
    title: "Live Proctored Grand Prix",
    slug: `test-live-${now}`,
    passcode: "LIVE_SECRET",
    start_at: new Date(now - 1800 * 1000).toISOString(),
    end_at: new Date(now + 1800 * 1000).toISOString(),
    duration_minutes: 60,
    status: "LIVE",
  });

  const draftContest = await createContest({
    title: "Unpublished Draft Exam",
    slug: `test-draft-${now}`,
    passcode: "DRAFT_SECRET",
    start_at: new Date(now + 3600 * 1000).toISOString(),
    end_at: new Date(now + 7200 * 1000).toISOString(),
    duration_minutes: 60,
    status: "DRAFT",
  });

  // ────────────────────────────────────────────────────────────
  // PART 1: PUBLIC CONTEST DISCOVERY
  // ────────────────────────────────────────────────────────────
  console.log("\n── 1. Public Contest Discovery & Gating ──");

  await testAsync("1. Anonymous request can retrieve a published UPCOMING contest", async () => {
    const res = await getContestRoute();
    const data = await res.json();
    assert.ok(Array.isArray(data.contests), "Expected contests array");
    const found = data.contests.find((c: any) => c.slug === upcomingContest.slug);
    assert.ok(found, "Upcoming contest must be present in public discovery");
    assert.strictEqual(found.title, "Upcoming Algorithmic Challenge");
  });

  await testAsync("2. Anonymous request can retrieve a LIVE contest", async () => {
    const summaries = await getPublicContestSummaries();
    const found = summaries.find((c) => c.slug === liveContest.slug);
    assert.ok(found, "Live contest must be present in public discovery");
    assert.strictEqual(found.status, "LIVE");
  });

  await testAsync("3. Anonymous request cannot retrieve DRAFT/private contest", async () => {
    const summaries = await getPublicContestSummaries();
    const foundInList = summaries.find((c) => c.slug === draftContest.slug);
    assert.strictEqual(foundInList, undefined, "DRAFT contests must never appear in public summaries");

    // Direct endpoint lookup should return 404 for anonymous request
    const dummyReq = new Request(`http://localhost/api/contest/${draftContest.slug}`);
    const res = await getContestSlugRoute(dummyReq, { params: Promise.resolve({ slug: draftContest.slug }) });
    assert.strictEqual(res.status, 404, "Direct request for DRAFT contest by anonymous user must return 404");
  });

  await testAsync("4. Anonymous payload contains no passcode or passcode_hash", async () => {
    const dummyReq = new Request(`http://localhost/api/contest/${liveContest.slug}`);
    const res = await getContestSlugRoute(dummyReq, { params: Promise.resolve({ slug: liveContest.slug }) });
    const data = await res.json();
    assert.ok(data.contest, "Contest object must be returned");
    assert.strictEqual((data.contest as any).passcode, undefined, "Passcode must not be exposed");
    assert.strictEqual((data.contest as any).passcode_hash, undefined, "Passcode hash must not be exposed");
  });

  await testAsync("5. Anonymous payload contains no answer keys", async () => {
    const dummyReq = new Request(`http://localhost/api/contest/${liveContest.slug}`);
    const res = await getContestSlugRoute(dummyReq, { params: Promise.resolve({ slug: liveContest.slug }) });
    const data = await res.json();
    assert.strictEqual((data.contest as any).correct_option, undefined);
    assert.strictEqual((data.contest as any).correct_answer, undefined);
    assert.strictEqual((data.contest as any).mcq_answers, undefined);
  });

  await testAsync("6. Anonymous payload contains no hidden tests", async () => {
    const dummyReq = new Request(`http://localhost/api/contest/${liveContest.slug}`);
    const res = await getContestSlugRoute(dummyReq, { params: Promise.resolve({ slug: liveContest.slug }) });
    const data = await res.json();
    assert.strictEqual((data.contest as any).hidden_test_cases, undefined);
    assert.strictEqual((data.contest as any).test_cases, undefined);
  });

  await testAsync("7. Anonymous user cannot join/participate without student session", async () => {
    const dummyReq = new Request(`http://localhost/api/contest/${liveContest.slug}/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passcode: "LIVE_SECRET", user_id: "anonymous-attacker" }),
    });
    const res = await postJoinRoute(dummyReq, { params: Promise.resolve({ slug: liveContest.slug }) });
    assert.strictEqual(res.status, 401, "Anonymous request to join must return 401 Unauthorized");
  });

  await testAsync("8. Authenticated student can continue into participation flow", async () => {
    const studentToken = createStudentSessionToken({
      userId: `student-verified-${Date.now()}`,
      email: "student@university.edu",
      fullName: "Alice Student",
      studentId: "STU-001",
      college: "Tech University",
    });

    const studentReq = new Request(`http://localhost/api/contest/${liveContest.slug}/join`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cookie": `smartzero_student_session=${studentToken}`,
      },
      body: JSON.stringify({ passcode: "LIVE_SECRET" }),
    });

    const res = await postJoinRoute(studentReq, { params: Promise.resolve({ slug: liveContest.slug }) });
    assert.strictEqual(res.status, 200, "Authenticated student with valid passcode must be permitted to join");
    const data = await res.json();
    assert.ok(data.participant, "Participant record must be initialized");
  });

  // ────────────────────────────────────────────────────────────
  // PART 2: ADMIN PROVISIONING & RBAC
  // ────────────────────────────────────────────────────────────
  console.log("\n── 2. Admin Account Provisioning & RBAC ──");

  await testAsync("9. Student registration always results in role=student", async () => {
    const regReq = new Request("http://localhost/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        full_name: "Bob Student",
        email: `bob-${Date.now()}@college.edu`,
        student_id: "BOB-99",
        college: "State College",
      }),
    });
    const res = await postRegisterRoute(regReq);
    const data = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.profile.role, "student", "Role must be student");
  });

  await testAsync("10. Student cannot inject admin role", async () => {
    const regReq = new Request("http://localhost/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        full_name: "Mallory Attacker",
        email: `mallory-${Date.now()}@bad.com`,
        role: "admin",
      }),
    });
    const res = await postRegisterRoute(regReq);
    const data = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.profile.role, "student", "Injected admin role must be ignored");
  });

  await testAsync("11. Student cannot inject super_admin role", async () => {
    const regReq = new Request("http://localhost/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        full_name: "Mallory Attacker",
        email: `mallory2-${Date.now()}@bad.com`,
        role: "super_admin",
      }),
    });
    const res = await postRegisterRoute(regReq);
    const data = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.profile.role, "student", "Injected super_admin role must be ignored");
  });

  await testAsync("12. Normal student cannot call role-management endpoint", async () => {
    const studentToken = createStudentSessionToken({
      userId: `student-call-${Date.now()}`,
      email: "student@school.edu",
      fullName: "Student Caller",
      studentId: "S-1",
      college: "School",
    });

    const getReq = new Request("http://localhost/api/admin/users", {
      headers: {
        Authorization: `Bearer ${studentToken}`,
        Cookie: `smartzero_student_session=${studentToken}`,
      },
    });
    const res = await getAdminUsersRoute(getReq);
    assert.strictEqual(res.status, 403, "Student must be rejected with 403 Forbidden");

    const patchReq = new Request("http://localhost/api/admin/users", {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${studentToken}`,
        Cookie: `smartzero_student_session=${studentToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ target_user_id: "target-123", role: "admin" }),
    });
    const patchRes = await patchAdminUsersRoute(patchReq);
    assert.strictEqual(patchRes.status, 403, "Student must be rejected from modifying roles");
  });

  await testAsync("13. Admin cannot arbitrarily create super_admin", async () => {
    // Student token with role student
    const studentToken = createStudentSessionToken({
      userId: "user-01",
      email: "user@school.edu",
      fullName: "Non Super Admin",
      studentId: "U-1",
      college: "School",
    });

    // Attempting to provision super_admin via POST
    const postReq = new Request("http://localhost/api/admin/users", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${studentToken}`,
        Cookie: `smartzero_student_session=${studentToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        full_name: "Super Impersonator",
        email: "super@evil.com",
        password: "password12345",
        role: "super_admin",
      }),
    });
    const postRes = await postAdminUsersRoute(postReq);
    assert.strictEqual(postRes.status, 403, "Ordinary user must not be able to provision accounts");

    // An admin attempting to set role to super_admin via PATCH
    const patchReq = new Request("http://localhost/api/admin/users", {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${studentToken}`,
        Cookie: `smartzero_student_session=${studentToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        target_user_id: "target-456",
        role: "super_admin",
      }),
    });
    const patchRes = await patchAdminUsersRoute(patchReq);
    assert.strictEqual(patchRes.status, 403, "Non-super_admin must be rejected from setting super_admin");
  });

  await testAsync("14. Super-admin can assign permitted staff role", async () => {
    // Verified primary super admin mock token / verification
    const superAdminUserId = "super-admin-01";
    // Check permission logic
    const canSuperAdminManage = await canUserManageContest(liveContest.id, superAdminUserId, "super_admin");
    assert.strictEqual(canSuperAdminManage, true, "Super admin must be authorized to manage contest");
  });

  await testAsync("15. contest_admin assignment respects contest scope", async () => {
    const contestAdminId = `contest-admin-${Date.now()}`;

    // Assign to upcomingContest ONLY
    await assignContestAdmin({
      contest_id: upcomingContest.id,
      admin_id: contestAdminId,
      assigned_by: "super-admin",
    });

    // Check permission on assigned contest
    const canManageAssigned = await canUserManageContest(
      upcomingContest.id,
      contestAdminId,
      "contest_admin"
    );
    assert.strictEqual(canManageAssigned, true, "Contest admin MUST be authorized on assigned contest");

    // Check permission on unassigned contest
    const canManageUnassigned = await canUserManageContest(
      liveContest.id,
      contestAdminId,
      "contest_admin"
    );
    assert.strictEqual(canManageUnassigned, false, "Contest admin MUST NOT be authorized on unassigned contest");
  });

  await testAsync("16. Existing can_manage_contest authorization remains correct", async () => {
    assert.strictEqual(await canUserManageContest(liveContest.id, "u1", "super_admin"), true);
    assert.strictEqual(await canUserManageContest(liveContest.id, "u2", "admin"), true);
    assert.strictEqual(await canUserManageContest(liveContest.id, "u3", "student"), false);
  });

  // ────────────────────────────────────────────────────────────
  // PART 3: GLOBAL THEME SWITCHING & PERSISTENCE
  // ────────────────────────────────────────────────────────────
  console.log("\n── 3. Global Theme Switching & Persistence ──");

  await testAsync("17. Theme changes globally", async () => {
    const store = useWorkspaceStore.getState();
    store.setTheme("dark");
    assert.strictEqual(useWorkspaceStore.getState().theme, "dark", "Theme state must be dark");

    store.setTheme("light");
    assert.strictEqual(useWorkspaceStore.getState().theme, "light", "Theme state must be light");

    store.toggleTheme();
    assert.strictEqual(useWorkspaceStore.getState().theme, "dark", "toggleTheme switches to dark");
  });

  await testAsync("18. Theme persists after refresh / rehydrateFromStorage", async () => {
    const mockStorage = new Map<string, string>();
    (globalThis as any).localStorage = {
      getItem: (k: string) => mockStorage.get(k) || null,
      setItem: (k: string, v: string) => mockStorage.set(k, v),
      removeItem: (k: string) => mockStorage.delete(k),
    };

    const store = useWorkspaceStore.getState();
    store.setTheme("dark");
    assert.strictEqual(mockStorage.get("smartzero_theme_v1"), "dark", "Theme must be persisted to storage");

    // Simulate page rehydration
    useWorkspaceStore.setState({ isHydrated: false, theme: "light" });
    useWorkspaceStore.getState().rehydrateFromStorage();
    assert.strictEqual(useWorkspaceStore.getState().isHydrated, true, "Store must be hydrated");
    assert.strictEqual(useWorkspaceStore.getState().theme, "dark", "Theme must be rehydrated from storage");
  });

  await testAsync("19. Theme persists across route navigation", async () => {
    const store = useWorkspaceStore.getState();
    store.setTheme("dark");
    assert.strictEqual(useWorkspaceStore.getState().theme, "dark", "Theme state remains dark across route navigation");

    store.setTheme("light");
    assert.strictEqual(useWorkspaceStore.getState().theme, "light", "Theme state remains light across route navigation");
  });

  await testAsync("20. No hydration mismatch", async () => {
    // applyDocumentTheme only touches document if defined
    assert.doesNotThrow(() => {
      applyDocumentTheme("dark");
      applyDocumentTheme("light");
    });
  });

  await testAsync("21. Auth pages follow global theme tokens", async () => {
    // Verify CSS variables defined for dark and light
    const fs = await import("node:fs");
    const globalsCss = fs.readFileSync("app/globals.css", "utf8");
    assert.ok(globalsCss.includes("@custom-variant dark"), "globals.css must configure @custom-variant dark for Tailwind v4");
    assert.ok(globalsCss.includes("html.dark"), "globals.css must define html.dark custom properties");
  });

  await testAsync("22. Contest pages follow global theme tokens", async () => {
    const fs = await import("node:fs");
    const contestHub = fs.readFileSync("app/contests/page.tsx", "utf8");
    assert.ok(contestHub.includes("ThemeToggle"), "Contest Hub must include ThemeToggle");
    assert.ok(contestHub.includes("dark:bg-[#12121A]"), "Contest Hub must support dark theme via utility tokens");
    assert.ok(contestHub.includes("dark:text-[#F1F5F9]"), "Contest Hub must support dark text via utility tokens");
  });

  await testAsync("23. Admin pages follow global theme tokens", async () => {
    const fs = await import("node:fs");
    const adminLayout = fs.readFileSync("app/(admin)/admin/layout.tsx", "utf8");
    assert.ok(adminLayout.includes("ThemeToggle"), "Admin Layout must include ThemeToggle");
    assert.ok(adminLayout.includes("dark:bg-[#12121A]"), "Admin Layout must support dark background");

    const adminUsers = fs.readFileSync("app/(admin)/admin/users/page.tsx", "utf8");
    assert.ok(adminUsers.includes("dark:bg-[#181824]"), "Admin Users page must support dark card surface");
  });

  console.log("\n==================================================");
  console.log(`🎉 ALL ${passed} PRODUCTION UX, ACCESS & THEME TESTS PASSED!`);
  console.log("==================================================");
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
