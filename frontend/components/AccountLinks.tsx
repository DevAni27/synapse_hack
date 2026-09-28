"use client";

import Link from "next/link";
import { useAuth } from "@/components/auth/AuthProvider";

/** Sign in / My cases / Sign out for the nav. Renders nothing when Supabase is not configured. */
export function AccountLinks() {
  const { enabled, loading, user, signOut } = useAuth();
  if (!enabled || loading) return null;
  if (!user) {
    return (
      <Link href="/login" className="label transition-colors hover:text-text">
        Sign in
      </Link>
    );
  }
  return (
    <>
      <Link href="/cases" className="label transition-colors hover:text-text">
        My cases
      </Link>
      <button type="button" onClick={signOut} className="label transition-colors hover:text-text">
        Sign out
      </button>
    </>
  );
}