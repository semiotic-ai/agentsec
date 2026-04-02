import { Header } from "@/components/Header";
import { Hero } from "@/components/Hero";
import { Problem } from "@/components/Problem";
import { HowItWorks } from "@/components/HowItWorks";
import { OWASP } from "@/components/OWASP";
import { CLIUsage } from "@/components/CLIUsage";
import { CTA } from "@/components/CTA";

export default function Home(): React.ReactNode {
  return (
    <>
      <Header />
      <Hero />
      <Problem />
      <HowItWorks />
      <OWASP />
      <CLIUsage />
      <CTA />
    </>
  );
}
