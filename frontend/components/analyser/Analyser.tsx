"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { analyzeImage, validateFile } from "@/lib/api";
import { ApiError, type AnalysisResult } from "@/lib/types";
import { DropZone } from "./DropZone";
import { ErrorBox } from "./ErrorBox";
import { ResultsView } from "./ResultsView";
import { SaveCase } from "./SaveCase";

type Status = "idle" | "ready" | "analysing" | "success" | "error";

/**
 * The whole upload -> analyse -> results flow.
 *  variant="embedded": compact card; results open as a full-screen layer (used inside the 3D intro)
 *  variant="page":     regular page flow (used on /analyse)
 */
export function Analyser({ variant, header }: { variant: "embedded" | "page"; header?: ReactNode }) {
  const [status, setStatus] = useState<Status>("idle");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const runId = useRef(0);

  // Revoke object URLs we created
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const select = useCallback((f: File) => {
    const problem = validateFile(f);
    if (problem) {
      setFile(null);
      setPreviewUrl(null);
      setError(new ApiError("invalid_image", problem));
      setStatus("error");
      return;
    }
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
    setError(null);
    setResult(null);
    setStatus("ready");
  }, []);

  const reset = useCallback(() => {
    runId.current++;
    setFile(null);
    setPreviewUrl(null);
    setResult(null);
    setError(null);
    setStatus("idle");
  }, []);

  const analyse = useCallback(async () => {
    if (!file) return;
    const id = ++runId.current;
    setStatus("analysing");
    setError(null);
    try {
      const r = await analyzeImage(file);
      if (id !== runId.current) return; // superseded
      setResult(r);
      setStatus("success");
    } catch (e) {
      if (id !== runId.current) return;
      setError(e instanceof ApiError ? e : new ApiError("unknown", e instanceof Error ? e.message : "Analysis failed"));
      setStatus("error");
    }
  }, [file]);

  // Escape closes the full-screen results layer
  useEffect(() => {
    if (status !== "success" || variant !== "embedded") return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && reset();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [status, variant, reset]);

  const results =
    status === "success" && result ? (
      <ResultsView
        result={result}
        onReset={reset}
        actions={file ? <SaveCase result={result} file={file} /> : null}
      />
    ) : null;

  const card = (
    <div className="w-full">
      <DropZone
        previewUrl={previewUrl}
        fileName={file?.name ?? null}
        analysing={status === "analysing"}
        disabled={status === "analysing"}
        onSelect={select}
      />

      {status === "idle" && (
        <p className="label mt-3">No image selected</p>
      )}

      {error && status === "error" && (
        <div className="mt-4">
          <ErrorBox error={error} onRetry={file ? analyse : undefined} onReset={reset} />
        </div>
      )}

      {(status === "ready" || status === "analysing") && (
        <div className="mt-4 flex items-center gap-4">
          <button
            onClick={analyse}
            disabled={status === "analysing"}
            className="bg-accent px-6 py-3 text-sm font-medium text-bg transition-opacity hover:opacity-90 disabled:cursor-wait disabled:opacity-60"
          >
            {status === "analysing" ? "Analysing angiogram…" : "Analyse"}
          </button>
          {status === "analysing" && (
            <span className="label" aria-live="polite">
              Identifying coronary system
            </span>
          )}
        </div>
      )}

      <p className="label mt-6 normal-case tracking-normal">Research prototype. Not for diagnosis.</p>
    </div>
  );

  if (variant === "embedded" && results) {
    // Rendered into document.body: the upload panel has a transform, which would otherwise trap a
    // "fixed" layer inside the small panel instead of covering the whole page.
    return (
      <>
        {card}
        {createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Analysis results"
            className="fixed inset-0 z-[100] overflow-y-auto overscroll-contain bg-bg"
          >
            <button
              onClick={reset}
              className="label fixed right-5 top-5 z-10 border border-line bg-bg px-3 py-2 transition-colors hover:text-text md:right-8"
            >
              Close · Esc
            </button>
            {results}
          </div>,
          document.body,
        )}
      </>
    );
  }

  if (variant === "page") {
    return results ?? (
      <div className="px-5 pb-20 md:px-8">
        <div className="mx-auto w-full max-w-2xl">
          {header}
          {card}
        </div>
      </div>
    );
  }

  return card;
}