"use client";

import type { ReactNode } from "react";

/** Takes the visitor to the upload panel at the end of the intro (the same place scrolling ends up). */
export function UploadLink({ className, children }: { className?: string; children: ReactNode }) {
  const go = () => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const behavior: ScrollBehavior = reduced ? "auto" : "smooth";
    const intro = document.getElementById("intro-scroll");
    if (intro) {
      const top = intro.getBoundingClientRect().top + window.scrollY + intro.offsetHeight - window.innerHeight;
      window.scrollTo({ top, behavior });
      return;
    }
    // static fallback (no 3D): the upload card is already on the page
    document.getElementById("upload")?.scrollIntoView({ behavior, block: "center" });
  };
  return (
    <button type="button" onClick={go} className={className}>
      {children}
    </button>
  );
}