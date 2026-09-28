import Link from "next/link";
import { Wordmark } from "./Logo";
import { AccountLinks } from "./AccountLinks";
import { UploadLink } from "./UploadLink";

export function Nav({ current }: { current: "intro" | "analyse" }) {
  return (
    <header className="fixed inset-x-0 top-0 z-40">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 md:px-8">
        <Link href="/" aria-label="Arbor home">
          <Wordmark />
        </Link>
        <nav className="flex items-center gap-5 md:gap-6">
          <AccountLinks />
          {current === "intro" ? (
            <UploadLink className="border border-accent/60 bg-accent/10 px-4 py-2 font-mono text-[0.72rem] uppercase tracking-[0.14em] text-accent transition-colors hover:bg-accent hover:text-bg">
              Upload angiogram
            </UploadLink>
          ) : (
            <Link href="/" className="label transition-colors hover:text-text">
              Intro
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}