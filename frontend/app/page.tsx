import { Intro } from "@/components/intro/Intro";
import { Nav } from "@/components/Nav";

export default function Home() {
  return (
    <>
      <Nav current="intro" />
      <main className="flex-1">
        <Intro />
      </main>
    </>
  );
}