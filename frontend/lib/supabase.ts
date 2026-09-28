import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
// Works with either the legacy "anon" key or the newer "publishable" key.
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** False when the env vars are missing: the analyser still works, the account features hide. */
export const SUPABASE_ENABLED = Boolean(url && key);

export const supabase: SupabaseClient | null = SUPABASE_ENABLED ? createClient(url!, key!) : null;

export const BUCKET = "analyses";

export type Role = "patient" | "doctor";
export interface Profile {
  id: string;
  role: Role;
  full_name: string | null;
  share_code: string;
}