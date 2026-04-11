import { AnimatedTerminal } from "@/components/AnimatedTerminal";
import { ContactForm } from "@/components/ContactForm";
import { CTA } from "@/components/CTA";
import { Header } from "@/components/Header";
import { Hero } from "@/components/Hero";
import { StickyCopy } from "@/components/StickyCopy";
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
        <TenCommandments />
        <ContactForm />
      </main>
      <StickyCopy />
      <CTA />
    </>
  );
}
