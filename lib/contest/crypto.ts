import { createHash, randomBytes } from "crypto";

const DEFAULT_SALT = "smartzero_contest_v2_salt";

/**
 * Hashes a contest passcode using SHA-256 with salting.
 * Never stores plain text passcodes in the database.
 */
export function hashPasscode(passcode: string, salt = DEFAULT_SALT): string {
  const normalized = passcode.trim();
  const hash = createHash("sha256")
    .update(`${salt}:${normalized}`)
    .digest("hex");
  return hash;
}

/**
 * Verifies if a user-supplied passcode matches the stored hash.
 */
export function verifyPasscode(passcode: string, storedHash: string, salt = DEFAULT_SALT): boolean {
  if (!passcode || !storedHash) return false;
  const computed = hashPasscode(passcode, salt);
  return computed.toLowerCase() === storedHash.toLowerCase();
}

/**
 * Generates a clean random join slug (e.g., SZ-2026-X8K2)
 */
export function generateContestSlug(title: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30);
  const suffix = randomBytes(2).toString("hex").toUpperCase();
  return base ? `${base}-${suffix}` : `sz-${Date.now()}-${suffix}`;
}
