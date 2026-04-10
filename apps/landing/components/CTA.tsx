"use client";

import { CopyCommandButton } from "./CopyCommandButton";

export function CTA(): React.ReactNode {
  return (
    <section className="section-pad bg-brand-dark relative overflow-hidden">
      {/* Gradient orbs */}
      <div className="absolute -top-40 -right-40 w-80 h-80 bg-brand-teal rounded-full mix-blend-multiply filter blur-3xl opacity-5 animate-pulse" />
      <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-brand-blue rounded-full mix-blend-multiply filter blur-3xl opacity-5 animate-pulse" />

      <div className="relative z-10 max-w-4xl mx-auto text-center">
        <h2 className="text-4xl md:text-5xl font-bold mb-6">Ready?</h2>
        <p className="text-xl text-brand-muted mb-12 max-w-2xl mx-auto">
          One command. Every skill. Zero setup.
        </p>

        {/* Copy CTA */}
        <div className="mb-12 flex justify-center">
          <CopyCommandButton command="npx agentsec" size="md" />
        </div>

        {/* Links */}
        <div className="flex flex-col sm:flex-row gap-6 justify-center text-sm">
          <a
            href="https://github.com/semiotic-agentium"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center min-h-[44px] px-2 text-brand-blue hover:text-brand-teal transition-colors"
          >
            GitHub
          </a>
          <a
            href="https://owasp.org/www-project-agentic-skills-top-10/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center min-h-[44px] px-2 text-brand-blue hover:text-brand-teal transition-colors"
          >
            OWASP AST10 Report
          </a>
          <a
            href="mailto:markeljan19@gmail.com"
            className="inline-flex items-center min-h-[44px] px-2 text-brand-blue hover:text-brand-teal transition-colors"
          >
            Contact
          </a>
        </div>
      </div>
    </section>
  );
}
