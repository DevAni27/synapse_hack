import { Analyser } from "@/components/analyser/Analyser";
import { Footer } from "@/components/Footer";
import { Nav } from "@/components/Nav";

export const metadata = { title: "Analyse · Arbor" };

const header = (
  <div className="pb-10">
    <p className="label mb-3">Analyser</p>
    <h1 className="font-serif text-5xl leading-[1.05] md:text-6xl">Upload an angiogram.</h1>
    <p className="mt-4 max-w-md text-[0.95rem] leading-relaxed text-muted">
      Arbor identifies whether the image shows the left or right coronary system, then traces the arteries it
      finds.
    </p>
  </div>
);

export default function AnalysePage() {
  return (
    <>
      <Nav current="analyse" />
      <main className="flex-1 pt-24">
        <Analyser variant="page" header={header} />
      </main>
      <Footer />
    </>
  );
}
