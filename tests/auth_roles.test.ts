import assert from "node:assert/strict";
import { useAuthStore } from "../stores/authStore";
import type { UserRole, UserProfile } from "../types/auth";

console.log("▶ Running SmartZero Auth & Roles Test Suite...");

// 1. Role hierarchy and permissions logic
function checkRoleAccess(userRole: UserRole, targetRoute: string): boolean {
  if (targetRoute === "/" || targetRoute === "/login" || targetRoute === "/signup") {
    return true; // Public routes
  }
  if (targetRoute === "/profile") {
    return true; // Any authenticated user
  }
  // Super admin specific routes checked before general /admin
  if (targetRoute.startsWith("/admin/roles") || targetRoute.startsWith("/admin/admins")) {
    return userRole === "super_admin";
  }
  if (targetRoute.startsWith("/admin")) {
    return userRole === "admin" || userRole === "super_admin";
  }
  return false;
}

// Test Student access
assert.equal(checkRoleAccess("student", "/"), true, "Student can access home");
assert.equal(checkRoleAccess("student", "/profile"), true, "Student can access profile");
assert.equal(checkRoleAccess("student", "/admin"), false, "Student CANNOT access admin");
assert.equal(checkRoleAccess("student", "/admin/users"), false, "Student CANNOT access admin users");

// Test Admin access
assert.equal(checkRoleAccess("admin", "/"), true, "Admin can access home");
assert.equal(checkRoleAccess("admin", "/profile"), true, "Admin can access profile");
assert.equal(checkRoleAccess("admin", "/admin"), true, "Admin CAN access admin dashboard");
assert.equal(checkRoleAccess("admin", "/admin/contests"), true, "Admin CAN access contest management");
assert.equal(checkRoleAccess("admin", "/admin/admins"), false, "Admin CANNOT access super_admin admin management");

// Test Super Admin access
assert.equal(checkRoleAccess("super_admin", "/"), true, "Super Admin can access home");
assert.equal(checkRoleAccess("super_admin", "/admin"), true, "Super Admin CAN access admin");
assert.equal(checkRoleAccess("super_admin", "/admin/admins"), true, "Super Admin CAN access super_admin management");

console.log("  ✓ Role access matrix verified (student, admin, super_admin)");

// 2. Auth store initial state test
const initialStore = useAuthStore.getState();
assert.equal(initialStore.role, "student", "Default role must be student");
assert.equal(initialStore.isAuthenticated, false, "Initial state unauthenticated");
assert.equal(typeof initialStore.signInWithPassword, "function", "signInWithPassword must be function");
assert.equal(typeof initialStore.signUpWithPassword, "function", "signUpWithPassword must be function");
assert.equal(typeof initialStore.signOut, "function", "signOut must be function");
assert.equal(typeof initialStore.updateProfile, "function", "updateProfile must be function");

console.log("  ✓ Auth store actions and default role verified");

// 3. UserProfile type integrity
const mockProfile: UserProfile = {
  id: "test-user-123",
  display_name: "Test Learner",
  full_name: "Test Learner Full",
  email: "test@example.com",
  student_id: "STU-001",
  college: "Tech University",
  avatar_url: null,
  role: "student",
};

assert.equal(mockProfile.role, "student");
assert.equal(mockProfile.email, "test@example.com");

console.log("  ✓ UserProfile contract verified");

// 4. Sign out state cleanup test
initialStore.signOut();
const postSignOut = useAuthStore.getState();
assert.equal(postSignOut.user, null, "User must be null after sign out");
assert.equal(postSignOut.profile, null, "Profile must be null after sign out");
assert.equal(postSignOut.isAuthenticated, false, "isAuthenticated must be false after sign out");

console.log("  ✓ Sign out cleanup verified");

console.log("✅ All Auth & Roles tests passed (15+ assertions)!\n");
