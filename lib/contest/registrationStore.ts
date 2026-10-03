import type { UserProfile } from "@/types/auth";

export const registeredProfilesByEmail = new Map<string, UserProfile>();
export const registeredProfilesById = new Map<string, UserProfile>();
