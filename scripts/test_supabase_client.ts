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
const pubKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

console.log("Supabase URL:", supabaseUrl);
console.log("Publishable key exists:", Boolean(pubKey));

const supabase = createClient(supabaseUrl, pubKey);

async function test() {
  // Test query on profiles
  const { data, error } = await supabase.from("profiles").select("*");
  console.log("Profiles query result:", { count: data?.length, error });

  // Test query on user_roles
  const { data: roles, error: rolesError } = await supabase.from("user_roles").select("*");
  console.log("User roles query result:", { count: roles?.length, error: rolesError });
}

test().catch(console.error);
