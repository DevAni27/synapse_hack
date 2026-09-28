"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { Nav } from "@/components/Nav";

const input =
  "w-full border border-line bg-surface px-3.5 py-2.5 text-sm text-text placeholder:text-muted/60 focus:border-accent focus:outline-none";

export default function LoginPage() {
  const { enabled, loading, user, signIn, signUp } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    if (mode === "in") {
      const err = await signIn(email.trim(), password);
      if (err) setError(err);
      else router.replace("/");
    } else {
      const r = await signUp({ email: email.trim(), password, fullName: fullName.trim(), role: "doctor" });
      if (r.error) setError(r.error);
      else if (r.needsConfirmation) setNotice("Account created. Check your email for a confirmation link, then sign in.");
      else router.replace("/");
    }
    setBusy(false);
  };

  return (
    <>
      <Nav current="analyse" />
      <main className="flex-1 px-5 pb-20 pt-28 md:px-8">
        <div className="mx-auto w-full max-w-md">
          <p className="label mb-3">Doctor account</p>
          <h1 className="font-serif text-4xl leading-[1.08] md:text-5xl">
            {mode === "in" ? "Sign in" : "Create an account"}
          </h1>

          {!enabled ? (
            <p className="mt-6 border border-line p-4 text-sm leading-relaxed text-muted">
              Accounts are switched off because Supabase is not configured. Add{" "}
              <span className="font-mono text-text">NEXT_PUBLIC_SUPABASE_URL</span> and{" "}
              <span className="font-mono text-text">NEXT_PUBLIC_SUPABASE_ANON_KEY</span> to{" "}
              <span className="font-mono text-text">.env.local</span> and restart the dev server.
            </p>
          ) : loading ? null : user ? (
            <div className="mt-6 border border-line p-5">
              <p className="text-sm text-muted">You are already signed in.</p>
              <Link
                href="/"
                className="mt-4 inline-block border border-accent px-5 py-2.5 text-accent hover:bg-accent hover:text-bg"
              >
                Go to home
              </Link>
            </div>
          ) : (
            <form onSubmit={submit} className="mt-8 space-y-4">
              {mode === "up" && (
                <input
                  className={input}
                  placeholder="Full name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              )}
              <input
                className={input}
                type="email"
                placeholder="Email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <input
                className={input}
                type="password"
                placeholder="Password (min 6 characters)"
                autoComplete={mode === "in" ? "current-password" : "new-password"}
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />

              {error && <p className="text-sm text-red-400">{error}</p>}
              {notice && <p className="text-sm text-accent">{notice}</p>}

              <button
                type="submit"
                disabled={busy}
                className="w-full bg-accent px-6 py-3 text-sm font-medium text-bg transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {busy ? "Please wait…" : mode === "in" ? "Sign in" : "Create account"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setMode(mode === "in" ? "up" : "in");
                  setError(null);
                  setNotice(null);
                }}
                className="w-full text-center text-sm text-muted hover:text-text"
              >
                {mode === "in" ? "No account? Create one" : "Have an account? Sign in"}
              </button>
            </form>
          )}
        </div>
      </main>
    </>
  );
}