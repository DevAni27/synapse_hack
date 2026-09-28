"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { saveCase } from "@/lib/cases";
import type { AnalysisResult } from "@/lib/types";

/** Saves the result to the signed-in doctor's account automatically, once, when the results appear. */
export function SaveCase({ result, file }: { result: AnalysisResult; file: File }) {
  const { enabled, loading, user } = useAuth();
  const uid = user?.id ?? null;
  const [state, setState] = useState<"saving" | "saved" | "error">("saving");
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const startedFor = useRef(-1);

  useEffect(() => {
    if (!enabled || !uid || startedFor.current === attempt) return;
    startedFor.current = attempt;
    saveCase(result, file)
      .then(() => setState("saved"))
      .catch((e) => {
        setError(e instanceof Error ? e.message : "Could not save.");
        setState("error");
      });
  }, [enabled, uid, attempt, result, file]);

  if (!enabled || loading) return null;

  if (!uid) {
    return (
      <Link
        href="/login"
        target="_blank"
        className="border border-line px-5 py-2.5 text-sm text-muted transition-colors hover:border-muted hover:text-text"
      >
        Sign in to save this result
      </Link>
    );
  }

  if (state === "saving") {
    return <span className="label px-2">Saving to your cases…</span>;
  }

  if (state === "saved") {
    return (
      <Link href="/cases" className="border border-accent/50 px-5 py-2.5 text-sm text-accent">
        Saved · view my cases
      </Link>
    );
  }

  return (
    <div className="flex flex-col items-start gap-1.5">
      <button
        type="button"
        onClick={() => {
          setError(null);
          setState("saving");
          setAttempt((a) => a + 1);
        }}
        className="bg-accent px-5 py-2.5 text-sm font-medium text-bg transition-opacity hover:opacity-90"
      >
        Retry save
      </button>
      {error && (
        <p role="alert" className="max-w-xs text-[0.75rem] leading-snug text-[#ff8b8f]">
          {error}
        </p>
      )}
    </div>
  );
}