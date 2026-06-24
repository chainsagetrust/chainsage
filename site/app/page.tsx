import { Atmosphere } from "@/components/Atmosphere";
import { Nav } from "@/components/Nav";
import { Hero } from "@/components/Hero";
import {
  MissingLayer,
  HowItWorks,
  Roadmap,
  WhyNow,
  Virtuals,
  Footer,
} from "@/components/Sections";
import { Demo } from "@/components/Demo";
import { TrustNetwork } from "@/components/TrustNetwork";
import { LaunchCTA } from "@/components/LaunchCTA";

export default function Home() {
  return (
    <>
      <Atmosphere />
      <Nav />
      <main>
        <Hero />
        <MissingLayer />
        <HowItWorks />
        <Demo />
        <Roadmap />
        <TrustNetwork />
        <WhyNow />
        <Virtuals />
        <LaunchCTA />
      </main>
      <Footer />
    </>
  );
}
