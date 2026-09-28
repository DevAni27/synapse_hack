const TEAM = ["Aniket", "Aadit", "Arya", "Alisha"];

export function Footer() {
  return (
    <footer className="border-t border-line bg-bg">
      <div className="mx-auto grid max-w-7xl gap-8 px-5 py-12 md:grid-cols-[1.3fr_1fr] md:px-8">
        <div>
          <p className="label mb-3">Notice</p>
          <p className="max-w-md text-sm leading-relaxed text-muted">
            Arbor is a research prototype built for a hackathon. It does not diagnose, and it is not a
            medical device. Any output must be reviewed by a qualified clinician.
          </p>
          <p className="mt-3 max-w-md text-xs leading-relaxed text-muted/70">
            3D heart: &ldquo;Realistic Human Heart&rdquo; by neshallads, CC BY 4.0.
          </p>
        </div>
        <div className="md:text-right">
          <p className="label mb-3">Built by Quadruple A</p>
          <p className="font-serif text-2xl leading-tight">{TEAM.join(" · ")}</p>
        </div>
      </div>
    </footer>
  );
}
