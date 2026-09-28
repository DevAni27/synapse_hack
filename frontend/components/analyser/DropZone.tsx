"use client";

import { useRef, useState } from "react";
import { ACCEPTED_TYPES } from "@/lib/api";

export function DropZone({
  previewUrl,
  fileName,
  disabled,
  analysing,
  onSelect,
}: {
  previewUrl: string | null;
  fileName: string | null;
  disabled?: boolean;
  analysing?: boolean;
  onSelect: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const pick = (files: FileList | null) => {
    const f = files?.[0];
    if (f) onSelect(f);
  };

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(",")}
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          pick(e.target.files);
          e.target.value = ""; // allow re-selecting the same file
        }}
      />

      {previewUrl ? (
        <div className="relative overflow-hidden border border-line bg-black">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt="Selected angiogram preview"
            className={`mx-auto block max-h-[46vh] w-auto object-contain transition-opacity ${analysing ? "opacity-40" : ""}`}
          />
          {analysing && (
            <div className="absolute inset-x-0 top-0 h-px overflow-hidden bg-line" aria-hidden>
              <div className="h-full w-1/4 bg-accent" style={{ animation: "scan 1.3s linear infinite" }} />
            </div>
          )}
          <div className="flex items-center justify-between gap-3 border-t border-line bg-surface px-4 py-2.5">
            <span className="label truncate normal-case tracking-normal" title={fileName ?? ""}>
              {fileName}
            </span>
            {!disabled && (
              <button
                onClick={() => inputRef.current?.click()}
                className="label shrink-0 underline-offset-4 transition-colors hover:text-text hover:underline"
              >
                Change image
              </button>
            )}
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            pick(e.dataTransfer.files);
          }}
          className={`group flex w-full flex-col items-center justify-center gap-3 border border-dashed px-6 py-14 text-center transition-colors ${
            dragging ? "border-accent bg-accent/5" : "border-[#3a3f48] hover:border-muted"
          }`}
        >
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" aria-hidden className="text-muted transition-colors group-hover:text-text">
            <path d="M12 16V4m0 0-4 4m4-4 4 4M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="font-serif text-2xl leading-tight">Drop an angiogram, or browse</span>
          <span className="label">PNG or JPG · up to 10 MB</span>
        </button>
      )}
    </div>
  );
}
