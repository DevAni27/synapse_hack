/** Arbor mark: a small branching tree whose three limbs carry the artery colours. */
export function LogoMark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 22V13" stroke="#EDE8DF" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M12 13C12 9.5 8.5 8.5 6 5" stroke="#3E8BFF" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M12 13C12.2 9 12 6 12 2.5" stroke="#E5484D" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M12 13C12 10.5 15.5 9 18 5.5" stroke="#3DB37A" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function Wordmark() {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark />
      <span className="font-serif text-[1.35rem] leading-none">Arbor</span>
    </span>
  );
}
