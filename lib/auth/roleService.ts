import { createSupabaseServerClient, createSupabaseAdminClient } from "@/lib/supabase-server";
import { registeredProfilesByEmail, registeredProfilesById } from "@/lib/contest/registrationStore";
import { clearContestAdminAssignments, assignContestAdmin } from "@/lib/contest/service";
import type { UserRole, AccountStatus } from "@/types/auth";

export const PRIMARY_SUPER_ADMIN_EMAIL = "phaneendhra2508@gmail.com";

export const VALID_ROLES: UserRole[] = ["student", "contest_admin", "admin", "super_admin"];
export const VALID_STATUSES: AccountStatus[] = ["verified", "pending", "suspended", "disabled"];

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isUuid(id: string): boolean {
  return UUID_REGEX.test(id);
}

export function isProduction(): boolean {
  return (
    process.env.NODE_ENV === "production" &&
    process.env.SMARTZERO_FORCE_MEMORY_FALLBACK !== "true"
  );
}

export interface RoleUpdateParams {
  callerUserId: string;
  callerRole: UserRole;
  targetUserId: string;
  newRole?: UserRole;
  accountStatus?: AccountStatus;
  contestIds?: string[];
}

export interface RoleUpdateResult {
  success: boolean;
  error?: string;
  status: number;
  user?: {
    id: string;
    email?: string;
    role: UserRole;
    account_status: AccountStatus;
    assigned_contests?: string[];
  };
  provisioned?: boolean;
  temporary_password?: string;
}

/**
 * Provisions a Supabase Auth staff account for an admin or contest_admin.
 * Uses default initial temporary password "123456" and sets must_change_password: true.
 * If user already exists in Auth, updates the password and metadata instead of duplicating.
 */
export async function provisionStaffAuthAccount(params: {
  userId: string;
  email: string;
  fullName?: string;
  role: "admin" | "contest_admin";
}): Promise<{
  success: boolean;
  provisioned: boolean;
  temporaryPassword?: string;
  isNewUser?: boolean;
  error?: string;
}> {
  const adminClient = createSupabaseAdminClient();
  const tempPassword = "123456";

  if (!adminClient) {
    // Offline / unit test mode
    return { success: true, provisioned: true, temporaryPassword: tempPassword, isNewUser: true };
  }

  const { userId, email, fullName, role } = params;

  try {
    // 1. Attempt to create Supabase Auth user
    const { data: createData, error: createError } = await adminClient.auth.admin.createUser({
      id: isUuid(userId) ? userId : undefined,
      email: email.trim().toLowerCase(),
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        full_name: fullName || "",
        must_change_password: true,
        role,
      },
    });

    if (!createError && createData?.user) {
      return { success: true, provisioned: true, temporaryPassword: tempPassword, isNewUser: true };
    }

    // 2. If already registered, update existing account
    const isAlreadyRegistered =
      createError?.message?.toLowerCase().includes("already registered") ||
      createError?.message?.toLowerCase().includes("already been registered") ||
      createError?.message?.toLowerCase().includes("user already exists") ||
      createError?.message?.toLowerCase().includes("unique constraint") ||
      (createError as any)?.status === 422;

    if (isAlreadyRegistered) {
      let existingAuthUserId = userId;

      const { data: checkUser } = await adminClient.auth.admin.getUserById(userId);
      if (!checkUser?.user) {
        const { data: listData } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 100 });
        const found = listData?.users?.find(
          (u) => u.email?.toLowerCase() === email.trim().toLowerCase()
        );
        if (found) {
          existingAuthUserId = found.id;
        }
      }

      const { error: updateError } = await adminClient.auth.admin.updateUserById(existingAuthUserId, {
        password: tempPassword,
        user_metadata: {
          full_name: fullName || "",
          must_change_password: true,
          role,
        },
      });

      if (updateError) {
        console.error("[StaffProvisioning] Error updating existing staff credentials:", updateError.message);
        return {
          success: false,
          provisioned: false,
          error: "Role updated, but staff account provisioning failed. Please retry.",
        };
      }

      return { success: true, provisioned: true, temporaryPassword: tempPassword, isNewUser: false };
    }

    console.error("[StaffProvisioning] Failed to create auth user:", createError?.message);
    return {
      success: false,
      provisioned: false,
      error: "Unable to provision staff account.",
    };
  } catch (err: unknown) {
    console.error("[StaffProvisioning] Unexpected error:", err);
    return {
      success: false,
      provisioned: false,
      error: "Unable to provision staff account.",
    };
  }
}

async function getAdminClient() {
  return createSupabaseAdminClient() || (await createSupabaseServerClient());
}

/**
 * Authoritative Server-Side User Role & Account Status Mutation Service
 *
 * Implements strict RBAC hierarchy:
 * - super_admin: Full authority. Cannot demote primary super admin or remove last super admin.
 * - admin: Can only manage student and contest_admin roles. Cannot promote to admin or super_admin. Cannot modify peer admins.
 * - contest_admin / student: 403 Forbidden.
 */
export async function updateUserRoleAndStatus(params: RoleUpdateParams): Promise<RoleUpdateResult> {
  const { callerUserId, callerRole, targetUserId, newRole, accountStatus, contestIds } = params;

  // 1. Caller Authorization Check
  if (callerRole !== "admin" && callerRole !== "super_admin") {
    return {
      success: false,
      error: "Forbidden: Administrator privileges required.",
      status: 403,
    };
  }

  // 2. Validate Target User ID
  if (!targetUserId || typeof targetUserId !== "string" || !targetUserId.trim()) {
    return {
      success: false,
      error: "target_user_id is required.",
      status: 400,
    };
  }

  // 3. Validate Role if provided
  if (newRole !== undefined && !VALID_ROLES.includes(newRole)) {
    return {
      success: false,
      error: `Invalid role: "${newRole}". Permitted roles: ${VALID_ROLES.map((r) => `'${r}'`).join(", ")}.`,
      status: 400,
    };
  }

  // 4. Validate Account Status if provided
  if (accountStatus !== undefined && !VALID_STATUSES.includes(accountStatus)) {
    return {
      success: false,
      error: `Invalid account_status: "${accountStatus}". Permitted statuses: ${VALID_STATUSES.map((s) => `'${s}'`).join(", ")}.`,
      status: 400,
    };
  }

  // At least one mutation must be requested
  if (newRole === undefined && accountStatus === undefined) {
    return {
      success: false,
      error: "No update parameters provided (role or account_status required).",
      status: 400,
    };
  }

  const supabase = await getAdminClient();

  // 5. Lookup Target User State
  let targetEmail = "";
  let targetFullName = "";
  let currentRole: UserRole = "student";
  let currentStatus: AccountStatus = "verified";

  // Check in-memory store first
  const memProfile = registeredProfilesById.get(targetUserId);
  if (memProfile) {
    targetEmail = memProfile.email || "";
    targetFullName = memProfile.full_name || memProfile.display_name || "";
    currentRole = memProfile.role || "student";
    currentStatus = (memProfile.account_status as AccountStatus) || "verified";
  }

  // Query Supabase for authoritative current state
  let isTargetInSupabase = false;
  if (supabase && isUuid(targetUserId)) {
    try {
      const { data: profData } = await supabase
        .from("profiles")
        .select("id, email, full_name, display_name, account_status")
        .eq("id", targetUserId)
        .maybeSingle();

      if (profData) {
        isTargetInSupabase = true;
        targetEmail = profData.email || targetEmail;
        targetFullName = profData.full_name || profData.display_name || targetFullName;
        currentStatus = (profData.account_status as AccountStatus) || currentStatus;
      }

      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", targetUserId)
        .maybeSingle();

      if (roleData?.role) {
        currentRole = roleData.role as UserRole;
      }
    } catch {
      // Fall through to memory state if DB is unreachable
    }
  }

  const isTargetPrimarySuperAdmin =
    targetEmail.toLowerCase() === PRIMARY_SUPER_ADMIN_EMAIL.toLowerCase();

  if (isTargetPrimarySuperAdmin) {
    currentRole = "super_admin";
  }

  // 6. Hierarchy Enforcement for callerRole === 'admin'
  if (callerRole === "admin") {
    // Admin cannot modify their own role (self-escalation / self-demotion)
    if (callerUserId === targetUserId) {
      return {
        success: false,
        error: "Forbidden: Administrators cannot modify their own administrative role.",
        status: 403,
      };
    }

    // Admin cannot modify peer admins or super admins
    if (currentRole === "admin" || currentRole === "super_admin") {
      return {
        success: false,
        error: "Forbidden: Administrators cannot modify peer Administrators or Super Administrators.",
        status: 403,
      };
    }

    // Admin cannot promote anyone to admin or super_admin
    if (newRole === "admin" || newRole === "super_admin") {
      return {
        success: false,
        error: "Forbidden: Only Super Administrators can grant 'admin' or 'super_admin' roles.",
        status: 403,
      };
    }
  }

  // 7. Primary Super Admin Protection
  if (isTargetPrimarySuperAdmin) {
    if (newRole !== undefined && newRole !== "super_admin") {
      return {
        success: false,
        error: "Forbidden: The primary platform Super Administrator account cannot be modified or demoted.",
        status: 403,
      };
    }
    if (accountStatus !== undefined && accountStatus !== "verified") {
      return {
        success: false,
        error: "Forbidden: The primary platform Super Administrator account cannot be suspended or disabled.",
        status: 403,
      };
    }
  }

  // 8. Last Super Admin Protection
  if (currentRole === "super_admin" && newRole !== undefined && newRole !== "super_admin") {
    let superAdminCount = 1;

    if (supabase) {
      try {
        const { count, error } = await supabase
          .from("user_roles")
          .select("user_id", { count: "exact", head: true })
          .eq("role", "super_admin");

        if (!error && count !== null) {
          superAdminCount = count;
        }
      } catch {
        // Fallback
      }
    }

    if (superAdminCount <= 1) {
      return {
        success: false,
        error: "Forbidden: Cannot remove the final Super Administrator account. At least one Super Administrator must remain on the platform.",
        status: 400,
      };
    }
  }

  // 9. Execute Mutations
  const effectiveRole = newRole !== undefined ? newRole : currentRole;
  const effectiveStatus = accountStatus !== undefined ? accountStatus : currentStatus;

  // 9A. Database Persistence (Supabase)
  if (supabase && isUuid(targetUserId) && isTargetInSupabase) {
    if (accountStatus !== undefined) {
      const { error: profErr } = await supabase
        .from("profiles")
        .update({ account_status: accountStatus, updated_at: new Date().toISOString() })
        .eq("id", targetUserId);

      if (profErr) {
        console.error("[RoleService] Profile update error:", profErr.message);
        return {
          success: false,
          error: `Database error updating profile status: ${profErr.message}`,
          status: 500,
        };
      }
    }

    if (newRole !== undefined) {
      const { error: roleErr } = await supabase.from("user_roles").upsert(
        {
          user_id: targetUserId,
          role: newRole,
          created_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

      if (roleErr) {
        console.error("[RoleService] Role upsert error:", roleErr.message);
        return {
          success: false,
          error: `Database error updating user role: ${roleErr.message}`,
          status: 500,
        };
      }
    }
  }

  // Contest assignments update / cleanup
  if (newRole !== undefined) {
    if (newRole !== "contest_admin") {
      await clearContestAdminAssignments(targetUserId);
    } else if (Array.isArray(contestIds)) {
      await clearContestAdminAssignments(targetUserId);
      for (const cid of contestIds) {
        await assignContestAdmin({
          contest_id: cid,
          admin_id: targetUserId,
          assigned_by: callerUserId,
        });
      }
    }
  }

  // 9B. In-Memory Store Synchronization (for offline dev/tests/caching)
  if (memProfile) {
    memProfile.role = effectiveRole;
    memProfile.account_status = effectiveStatus;
    memProfile.updated_at = new Date().toISOString();
  }

  if (targetEmail) {
    const emailProfile = registeredProfilesByEmail.get(targetEmail.toLowerCase());
    if (emailProfile) {
      emailProfile.role = effectiveRole;
      emailProfile.account_status = effectiveStatus;
      emailProfile.updated_at = new Date().toISOString();
    }
  }

  if (newRole !== "contest_admin") {
    await clearContestAdminAssignments(targetUserId);
  }

  // 9C. Super Admin Staff Provisioning (Section B1 - B5)
  let provisioningResult: { provisioned?: boolean; temporaryPassword?: string } = {};

  if (newRole === "admin" || newRole === "contest_admin") {
    const emailToProvision = targetEmail || `${targetUserId}@smartzero.edu`;
    const prov = await provisionStaffAuthAccount({
      userId: targetUserId,
      email: emailToProvision,
      fullName: targetFullName,
      role: newRole,
    });

      if (!prov.success) {
        return {
          success: false,
          error: prov.error || "Unable to provision staff account.",
          status: 500,
        };
      }

      provisioningResult = {
        provisioned: true,
        temporaryPassword: prov.temporaryPassword,
      };
  } else if (newRole === "student" && (currentRole === "admin" || currentRole === "contest_admin")) {
    // Demoting staff to student: revoke staff auth metadata
    const adminClient = createSupabaseAdminClient();
    if (adminClient && isUuid(targetUserId)) {
      try {
        await adminClient.auth.admin.updateUserById(targetUserId, {
          user_metadata: { role: "student", staff_revoked: true },
        });
      } catch {
        // Non-blocking
      }
    }
  }

  return {
    success: true,
    status: 200,
    user: {
      id: targetUserId,
      email: targetEmail,
      role: effectiveRole,
      account_status: effectiveStatus,
      assigned_contests: effectiveRole === "contest_admin" ? (contestIds || []) : [],
    },
    provisioned: provisioningResult.provisioned,
    temporary_password: provisioningResult.temporaryPassword,
  };
}
