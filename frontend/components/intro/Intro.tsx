"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { Analyser } from "@/components/analyser/Analyser";
import { Footer } from "@/components/Footer";
import { UploadLink } from "@/components/UploadLink";

const subscribeNoop = () => () => {};
let cached3d: boolean | null = null;
function detect3d(): boolean {
  if (cached3d !== null) return cached3d;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let webgl = false;
  try {
    const c = document.createElement("canvas");
    webgl = !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    webgl = false;
  }
  cached3d = !reduced && webgl;
  return cached3d;
}

const HeartScene = dynamic(() => import("./HeartScene"), { ssr: false, loading: () => null });

type Timing = {
  hero: readonly [number, number];
  heart: readonly [number, number];
  left: readonly [number, number];
  right: readonly [number, number];
  panel: readonly [number, number];
};

/** 0 -> 1 -> 0 across a window of scroll progress, with soft edges. */
function windowOpacity(p: number, [a, b]: readonly [number, number]) {
  const span = Math.max(b - a, 0.001);
  const edge = Math.min(0.035, span / 3);
  if (p < a || p > b) return 0;
  if (p < a + edge) return (p - a) / edge;
  if (p > b - edge) return (b - p) / edge;
  return 1;
}

function Chapter({
  p,
  when,
  children,
  align = "left",
}: {
  p: number;
  when: readonly [number, number];
  children: ReactNode;
  align?: "left" | "center";
}) {
  const o = windowOpacity(p, when);
  return (
    <div
      aria-hidden={o < 0.05}
      className={`pointer-events-none absolute inset-x-0 z-10 ${
        align === "center" ? "top-1/2 -translate-y-1/2" : "bottom-[12vh]"
      }`}
      style={{ opacity: o, transform: `translateY(${(1 - o) * 14}px)` }}
    >
      <div className="mx-auto w-full max-w-7xl px-5 md:px-8">
        <div className="max-w-2xl">{children}</div>
      </div>
    </div>
  );
}

function Hero() {
  return (
    <>
      <p className="label mb-5">Coronary angiogram analysis · Quadruple A</p>
      <h1 className="font-serif text-[clamp(2.6rem,6vw,5.6rem)] leading-[1.02]">
        Three arteries.
        <br />
        <span className="text-muted">One image.</span>
      </h1>
      <p className="mt-6 max-w-md text-[0.98rem] leading-relaxed text-muted">
        Upload a coronary angiogram. Arbor works out which coronary system it shows, then traces the LAD, LCX and
        RCA separately.
      </p>
      <UploadLink className="pointer-events-auto mt-7 inline-flex cursor-pointer items-center gap-3 bg-accent px-6 py-3 text-sm font-medium text-bg transition-opacity hover:opacity-90">
        Upload an angiogram <span aria-hidden>→</span>
      </UploadLink>
    </>
  );
}

function Step({ n, title, children }: { n: string; title: string; children: ReactNode }) {
  return (
    <>
      <p className="label mb-3">{n}</p>
      <h2 className="font-serif text-3xl leading-[1.08] md:text-5xl">{title}</h2>
      <p className="mt-4 max-w-sm text-[0.95rem] leading-relaxed text-muted">{children}</p>
    </>
  );
}

const Tag = ({ c, children }: { c: string; children: ReactNode }) => (
  <span className="font-mono text-[0.85em]" style={{ color: c }}>
    {children}
  </span>
);

export function Intro() {
  const containerRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef(0);
  const [p, setP] = useState(0);
  const [timing, setTiming] = useState<Timing | null>(null);
  const [active, setActive] = useState(true);

  // null on the server / first paint, then true (3D) or false (static fallback)
  const supports3d = useSyncExternalStore(subscribeNoop, detect3d, () => null);
  const mode: "pending" | "3d" | "static" = supports3d === null ? "pending" : supports3d ? "3d" : "static";

  // Load the three.js-dependent timing lazily so three stays out of the initial bundle
  useEffect(() => {
    if (!supports3d) return;
    import("@/lib/introPath").then((m) => setTiming(m.getTiming()));
  }, [supports3d]);

  // Scroll -> progress
  useEffect(() => {
    if (mode !== "3d") return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const total = rect.height - window.innerHeight;
      const v = Math.min(1, Math.max(0, -rect.top / Math.max(total, 1)));
      progressRef.current = v;
      setP((prev) => (Math.abs(prev - v) > 0.0015 ? v : prev));
      setActive(rect.bottom > 0 && rect.top < window.innerHeight);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [mode]);

  /* ---------- static fallback (reduced motion or no WebGL) ---------- */
  if (mode === "static") {
    return (
      <>
        <section className="relative flex min-h-svh items-center overflow-hidden">
          <div
            aria-hidden
            className="absolute inset-0"
            style={{ background: "radial-gradient(60% 55% at 78% 45%, rgba(120,20,26,0.35), transparent 70%)" }}
          />
          <div className="relative mx-auto grid w-full max-w-7xl gap-12 px-5 py-28 md:grid-cols-2 md:px-8">
            <div>
              <Hero />
            </div>
            <div id="upload" className="self-center border border-line bg-surface/70 p-5 backdrop-blur-sm">
              <Analyser variant="embedded" />
            </div>
          </div>
        </section>
        <Footer />
      </>
    );
  }

  if (mode === "pending" || !timing) {
    // Reserve the space so nothing jumps while the 3D chunk loads
    return (
      <section className="relative mx-auto flex min-h-svh max-w-7xl items-end px-5 pb-[12vh] md:px-8">
        <div className="max-w-2xl opacity-0" aria-hidden>
          <Hero />
        </div>
      </section>
    );
  }

  const panelIn = Math.min(1, Math.max(0, (p - timing.panel[0]) / 0.05));
  const panelO = panelIn;

  return (
    <div id="intro-scroll" ref={containerRef} className="relative" style={{ height: "600vh" }}>
      <div className="sticky top-0 h-svh w-full overflow-hidden">
        <div className="absolute inset-0 isolate z-0">
          <HeartScene progressRef={progressRef} active={active} />
        </div>

        {/* soft vignette to keep text legible and focus the eye */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-[1]"
          style={{ background: "radial-gradient(120% 90% at 50% 50%, transparent 55%, rgba(11,13,15,0.65) 100%)" }}
        />

        {/* Chapters */}
        <Chapter p={p} when={timing.hero}>
          <Hero />
        </Chapter>

        <Chapter p={p} when={timing.heart}>
          <Step n="01 · The organ" title="The heart feeds itself.">
            Before it pumps a drop anywhere else, it has to keep its own muscle supplied. That job belongs to the
            coronary arteries.
          </Step>
        </Chapter>

        <Chapter p={p} when={timing.left}>
          <Step n="02 · Left" title="One trunk, two branches.">
            The left coronary artery leaves the aorta as a short trunk, then splits into the{" "}
            <Tag c="var(--lad)">LAD</Tag> and the <Tag c="var(--lcx)">LCX</Tag>.
          </Step>
        </Chapter>

        <Chapter p={p} when={timing.right}>
          <Step n="03 · Right" title="The right one travels alone.">
            The <Tag c="var(--rca)">RCA</Tag> takes its own route around the right side. Arbor tells the two systems
            apart, then traces every artery it finds.
          </Step>
        </Chapter>

        {/* Scroll hint */}
        <div
          aria-hidden
          className="pointer-events-none absolute bottom-6 left-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-2"
          style={{ opacity: Math.max(0, 1 - p / 0.05) }}
        >
          <span className="label">Scroll to go inside</span>
          <span className="block h-8 w-px bg-line">
            <span className="block h-3 w-px bg-text" style={{ animation: "scan 1.6s ease-in-out infinite", transformOrigin: "top" }} />
          </span>
        </div>

        {/* Upload panel: appears once the camera has arrived */}
        <div
          className="absolute inset-0 z-20 flex items-center"
          style={{ opacity: panelO, pointerEvents: panelIn > 0.7 ? "auto" : "none" }}
        >
          <div className="mx-auto w-full max-w-7xl px-5 md:px-8">
            <div
              className="max-h-[86svh] w-full max-w-[27rem] overflow-y-auto border border-line/80 bg-bg/75 p-5 backdrop-blur-md md:p-6"
              style={{ transform: `translateY(${(1 - panelIn) * 18}px)` }}
            >
              <p className="label mb-3">04 · Try it</p>
              <h2 className="mb-5 font-serif text-3xl leading-[1.08]">Upload an angiogram.</h2>
              <Analyser variant="embedded" />
            </div>
          </div>
        </div>

        {/* The page ends here. Credit + notice live in this strip instead of a footer. */}
        <p
          className="pointer-events-none absolute inset-x-0 bottom-3 z-20 px-5 text-center font-mono text-[0.62rem] uppercase tracking-[0.12em] text-muted/70 md:px-8"
          style={{ opacity: panelO }}
        >
          Research prototype, not a medical device · Quadruple A · 3D heart: neshallads, CC BY 4.0
        </p>
      </div>
    </div>
  );
}