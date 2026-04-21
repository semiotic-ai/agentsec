import { AnimatedTerminal } from "@/components/AnimatedTerminal";
import { Footer } from "@/components/Footer";
import { Formats } from "@/components/Formats";
import { Header } from "@/components/Header";
import { Hero } from "@/components/Hero";
import { HowItWorks } from "@/components/HowItWorks";
import { Install } from "@/components/Install";
import { Policy } from "@/components/Policy";
import { TenCommandments } from "@/components/TenCommandments";

export default function Home(): React.ReactNode {
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-brand-teal focus:text-brand-dark focus:rounded-lg focus:font-semibold"
      >
        Skip to main content
      </a>
      <Header />
      <main id="main">
        <Hero />
        <AnimatedTerminal />
        <HowItWorks />
        <TenCommandments />
        <Formats />
        <Policy />
        <Install />
      </main>
      <Footer />
    </>
  );
}
