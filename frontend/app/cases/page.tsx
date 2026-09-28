"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { ResultsView } from "@/components/analyser/ResultsView";
import { Nav } from "@/components/Nav";
import { ARTERY_COLOR, ARTERY_ORDER } from "@/lib/arteries";
import { deleteCase, listCases, resultFromCase, signPaths, type CaseRow } from "@/lib/cases";
import type { AnalysisResult } from "@/lib/types";

interface Loaded {
  rows: CaseRow[];
  thumbs: Record<string, string>;
}

async function fetchAll(): Promise<Loaded> {
  const rows = await listCases();
  const thumbs = await signPaths(rows.map((r) => r.original_path));
  return { rows, thumbs };
}

export default function CasesPage() {
  const { enabled, loading, user } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<AnalysisResult | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const uid = user?.id ?? null;

  useEffect(() => {
    if (enabled && !loading && !user) router.replace("/login");
  }, [enabled, loading, user, router]);

  const refresh = useCallback(async () => {
    try {
      setData(await fetchAll());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load cases.");
    }
  }, []);

  // initial load (state is only set inside the promise callbacks)
  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    fetchAll()
      .then((d) => !cancelled && setData(d))
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : "Could not load cases."));
    return () => {
      cancelled = true;
    };
  }, [uid]);

  const show = async (row: CaseRow) => {
    try {
      setOpen(await resultFromCase(row));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not open that case.");
    }
  };

  const remove = async (row: CaseRow) => {
    try {
      await deleteCase(row);
      setConfirming(null);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete that case.");
    }
  };

  return (
    <>
      <Nav current="analyse" />
      <main className="flex-1 px-5 pb-20 pt-28 md:px-8">
        <div className="mx-auto w-full max-w-6xl">
          <p className="label mb-3">Doctor</p>
          <h1 className="font-serif text-4xl leading-[1.08] md:text-5xl">My cases</h1>
          <p className="mt-3 max-w-lg text-[0.95rem] leading-relaxed text-muted">
            Analyses you have run while signed in. Only you can see them.
          </p>

          <div className="mt-8">
            {error && (
              <p role="alert" className="mb-4 border border-[#E5484D]/50 p-3 text-sm text-[#ff8b8f]">
                {error}
              </p>
            )}

            {!data ? (
              <p className="label">Loading…</p>
            ) : data.rows.length === 0 ? (
              <div className="border border-dashed border-line p-8 text-center">
                <p className="text-sm text-muted">No saved cases yet.</p>
                <Link
                  href="/analyse"
                  className="mt-4 inline-block border border-accent px-5 py-2.5 text-sm text-accent hover:bg-accent hover:text-bg"
                >
                  Analyse an angiogram
                </Link>
              </div>
            ) : (
              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {data.rows.map((r) => (
                  <li key={r.id} className="border border-line">
                    <button type="button" onClick={() => show(r)} className="block w-full text-left">
                      <div className="aspect-square overflow-hidden bg-black">
                        {data.thumbs[r.original_path] && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={data.thumbs[r.original_path]} alt="" className="h-full w-full object-cover" />
                        )}
                      </div>
                      <div className="p-3.5">
                        <div className="flex items-baseline justify-between">
                          <span className="font-serif text-2xl">{r.coronary_view}</span>
                          <span className="font-mono text-sm text-muted">{(r.confidence * 100).toFixed(2)}%</span>
                        </div>
                        <div className="mt-2 flex gap-1.5">
                          {ARTERY_ORDER.filter((a) => r.arteries_detected.includes(a)).map((a) => (
                            <span key={a} className="font-mono text-[0.7rem]" style={{ color: ARTERY_COLOR[a] }}>
                              {a}
                            </span>
                          ))}
                        </div>
                        <p className="label mt-2 normal-case tracking-normal">
                          {new Date(r.created_at).toLocaleString()}
                        </p>
                      </div>
                    </button>
                    <div className="border-t border-line px-3.5 py-2">
                      {confirming === r.id ? (
                        <span className="flex gap-4">
                          <button type="button" onClick={() => remove(r)} className="label text-[#ff8b8f]">
                            Confirm delete
                          </button>
                          <button type="button" onClick={() => setConfirming(null)} className="label">
                            Cancel
                          </button>
                        </span>
                      ) : (
                        <button type="button" onClick={() => setConfirming(r.id)} className="label hover:text-text">
                          Delete
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </main>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Saved analysis"
          className="fixed inset-0 z-50 overflow-y-auto bg-bg/95 backdrop-blur-md"
        >
          <ResultsView result={open} onReset={() => setOpen(null)} resetLabel="Back to cases" />
        </div>
      )}
    </>
  );
}