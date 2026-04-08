import { CLIUsage } from "@/components/CLIUsage";
import { CTA } from "@/components/CTA";
import { Header } from "@/components/Header";
import { Hero } from "@/components/Hero";
import { HowItWorks } from "@/components/HowItWorks";

export default function Home(): React.ReactNode {
  return (
    <>
      <Header />
      <Hero />
      <HowItWorks />
      <CLIUsage />
      <CTA />
    </>
  );
}
