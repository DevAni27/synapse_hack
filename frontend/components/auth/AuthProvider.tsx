"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { SUPABASE_ENABLED, supabase, type Profile, type Role } from "@/lib/supabase";

interface AuthState {
  enabled: boolean;
  loading: boolean;
  user: User | null;
  profile: Profile | null;
  signIn: (email: string, password: string) => Promise<string | null>;
  /** Returns { error } or { needsConfirmation: true } when the project requires email confirmation. */
  signUp: (a: { email: string; password: string; fullName: string; role: Role }) => Promise<{ error?: string; needsConfirmation?: boolean }>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);

export function useAuth(): AuthState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used inside <AuthProvider>");
  return v;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(!SUPABASE_ENABLED);
  const [profileState, setProfileState] = useState<Profile | null>(null);

  // Track the session (also picks up sign-in / sign-out from other tabs)
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  const user = session?.user ?? null;
  const uid = user?.id ?? null;

  // Load the profile (role, name, share code) for the signed-in user
  useEffect(() => {
    if (!supabase || !uid) return;
    let cancelled = false;
    supabase
      .from("profiles")
      .select("id, role, full_name, share_code")
      .eq("id", uid)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setProfileState((data as Profile | null) ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [uid]);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) return "Supabase is not configured.";
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error ? error.message : null;
  }, []);

  const signUp = useCallback<AuthState["signUp"]>(async ({ email, password, fullName, role }) => {
    if (!supabase) return { error: "Supabase is not configured." };
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, role } },
    });
    if (error) return { error: error.message };
    return { needsConfirmation: !data.session };
  }, []);

  const signOut = useCallback(async () => {
    await supabase?.auth.signOut();
  }, []);

  const profile = user && profileState?.id === user.id ? profileState : null;
  const value = useMemo<AuthState>(
    () => ({ enabled: SUPABASE_ENABLED, loading: !ready, user, profile, signIn, signUp, signOut }),
    [ready, user, profile, signIn, signUp, signOut],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}