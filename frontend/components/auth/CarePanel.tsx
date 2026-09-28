"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { linkPatient, listLinked, unlink, type LinkedPerson } from "@/lib/cases";
import type { Profile } from "@/lib/supabase";

/**
 * Patient: shows a share code to hand to a doctor, and who currently has access (revocable).
 * Doctor: enter a patient's code to see their cases; list and remove linked patients.
 */
export function CarePanel({ profile, onChange }: { profile: Profile; onChange: () => void }) {
  const [people, setPeople] = useState<LinkedPerson[]>([]);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const isDoctor = profile.role === "doctor";

  const load = useCallback(async () => {
    try {
      setPeople(await listLinked(profile.role, profile.id));
    } catch {
      setPeople([]);
    }
  }, [profile.role, profile.id]);

  useEffect(() => {
    let cancelled = false;
    listLinked(profile.role, profile.id)
      .then((p) => !cancelled && setPeople(p))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [profile.role, profile.id]);

  const add = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await linkPatient(code);
      setCode("");
      await load();
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not link that patient.");
    }
    setBusy(false);
  };

  const remove = async (id: string) => {
    try {
      await unlink(profile.role, profile.id, id);
      await load();
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove the link.");
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(profile.share_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked: the code is visible anyway */
    }
  };

  return (
    <section className="border border-line p-5" aria-label={isDoctor ? "Your patients" : "Sharing"}>
      {isDoctor ? (
        <>
          <p className="label mb-3">Your patients</p>
          <form onSubmit={add} className="flex flex-wrap gap-2">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Patient share code"
              aria-label="Patient share code"
              className="min-w-0 flex-1 border border-line bg-surface px-3.5 py-2.5 font-mono text-sm placeholder:text-muted/60 focus:border-accent focus:outline-none"
            />
            <button
              type="submit"
              disabled={busy || !code.trim()}
              className="border border-accent px-4 py-2.5 text-sm text-accent transition-colors hover:bg-accent hover:text-bg disabled:opacity-50"
            >
              Add patient
            </button>
          </form>
        </>
      ) : (
        <>
          <p className="label mb-3">Share with your doctor</p>
          <div className="flex flex-wrap items-center gap-3">
            <span className="border border-line bg-surface px-3.5 py-2.5 font-mono text-lg tracking-widest">
              {profile.share_code}
            </span>
            <button type="button" onClick={copy} className="label hover:text-text">
              {copied ? "Copied" : "Copy code"}
            </button>
          </div>
          <p className="mt-3 max-w-md text-[0.8rem] leading-relaxed text-muted">
            Give this code to your doctor. Once they enter it, they can see the cases you save. You can remove access
            at any time.
          </p>
        </>
      )}

      {error && <p role="alert" className="mt-3 text-sm text-[#ff8b8f]">{error}</p>}

      {people.length > 0 && (
        <ul className="mt-4 divide-y divide-line border-t border-line">
          {people.map((p) => (
            <li key={p.id} className="flex items-center justify-between py-2.5 text-sm">
              <span>{p.full_name || "Unnamed"}</span>
              <button type="button" onClick={() => remove(p.id)} className="label hover:text-text">
                {isDoctor ? "Remove" : "Revoke access"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}