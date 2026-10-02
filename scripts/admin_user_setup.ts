import { createClient } from "@supabase/supabase-js";
import * as path from "node:path";
import * as fs from "node:fs";

// Simple manual parser for .env.local
const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
      const idx = trimmed.indexOf("=");
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim();
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  const targetEmail = "phaneendhra2508@gmail.com";
  console.log(`🔍 Inspecting user by email: ${targetEmail}`);

  // 1. Locate Auth user
  const { data: userData, error: userError } = await supabase.auth.admin.listUsers();
  if (userError) {
    console.error("Error listing auth users:", userError);
    process.exit(1);
  }

  const user = userData.users.find(
    (u) => u.email?.toLowerCase() === targetEmail.toLowerCase()
  );

  if (!user) {
    console.error(`User with email ${targetEmail} NOT FOUND in auth.users.`);
    console.log("Existing users:", userData.users.map((u) => ({ id: u.id, email: u.email })));
    process.exit(1);
  }

  console.log(`✅ Located Auth User:`);
  console.log(`   UUID: ${user.id}`);
  console.log(`   Email: ${user.email}`);
  console.log(`   Created At: ${user.created_at}`);

  // 2. Check public.profiles
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    console.error("Error fetching profile:", profileError);
  }

  console.log(`✅ Profile row exists: ${Boolean(profile)}`);
  if (profile) {
    console.log(`   Profile data:`, profile);
  } else {
    console.log(`Creating profile row for ${user.id}...`);
    const { data: newProfile, error: createProfileError } = await supabase
      .from("profiles")
      .insert({
        id: user.id,
        email: user.email,
        full_name: user.user_metadata?.full_name || "Phaneendhra",
      })
      .select()
      .single();
    if (createProfileError) {
      console.error("Error creating profile:", createProfileError);
    } else {
      console.log(`   Profile created:`, newProfile);
    }
  }

  // 3. Check existing role in public.user_roles
  const { data: existingRoles, error: rolesError } = await supabase
    .from("user_roles")
    .select("*")
    .eq("user_id", user.id);

  if (rolesError) {
    console.error("Error fetching user_roles:", rolesError);
  }

  const prevRole = existingRoles && existingRoles.length > 0
    ? existingRoles.map((r) => r.role).join(", ")
    : "none";
  console.log(`   Previous role: ${prevRole}`);

  // 4. Assign admin role
  const hasAdminRole = existingRoles?.some((r) => r.role === "admin");
  if (!hasAdminRole) {
    console.log(`Assigning 'admin' role to ${user.id}...`);
    const { error: insertRoleError } = await supabase.from("user_roles").upsert(
      {
        user_id: user.id,
        role: "admin",
      },
      { onConflict: "user_id,role" }
    );
    if (insertRoleError) {
      console.error("Error inserting admin role:", insertRoleError);
      process.exit(1);
    }
  } else {
    console.log(`User already has 'admin' role.`);
  }

  // 5. Verify new role
  const { data: updatedRoles } = await supabase
    .from("user_roles")
    .select("*")
    .eq("user_id", user.id);
  console.log(`   New role(s):`, updatedRoles?.map((r) => r.role));

  // 6. Test is_admin RPC and has_role RPC
  const { data: hasRoleAdmin, error: hrError } = await supabase.rpc("has_role", {
    _user_id: user.id,
    _role: "admin",
  });
  if (hrError) {
    // Check alternative parameter name if defined as user_id or without leading underscore
    const { data: hr2, error: hr2Err } = await supabase.rpc("has_role", {
      user_id: user.id,
      role: "admin",
    });
    console.log(`   has_role('admin') RPC result:`, hr2, hr2Err ? hr2Err.message : "");
  } else {
    console.log(`   has_role('admin') RPC result:`, hasRoleAdmin);
  }

  const { data: isAdminRpc, error: rpcError } = await supabase.rpc("is_admin", {
    user_id: user.id,
  });

  if (rpcError) {
    const { data: ia2, error: ia2Err } = await supabase.rpc("is_admin", {
      _user_id: user.id,
    });
    console.log(`   is_admin() RPC result:`, ia2, ia2Err ? ia2Err.message : "");
  } else {
    console.log(`   is_admin() RPC result:`, isAdminRpc);
  }

  console.log("\n==================================================");
  console.log("ADMIN ASSIGNMENT VERIFICATION COMPLETE");
  console.log("==================================================");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
