"use client";

import { useState } from "react";

export function CTA(): React.ReactNode {
  const [copied, setCopied] = useState(false);

  const copyCommand = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText("npx agentsec");
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

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
          <button
            type="button"
            onClick={copyCommand}
            aria-label="Copy install command npx agentsec"
            className="group inline-flex items-center gap-3 py-3 px-5 text-base font-mono rounded-lg bg-brand-secondary border border-brand-border hover:border-brand-teal focus:outline-none focus:ring-2 focus:ring-brand-teal transition-colors"
          >
            <span className="text-brand-blue">$ npx agentsec</span>
            <span
              aria-live="polite"
              className="text-xs font-sans px-2 py-1 rounded bg-brand-dark border border-brand-border text-brand-muted group-hover:text-brand-teal group-hover:border-brand-teal transition-colors"
            >
              {copied ? "Copied!" : "Copy"}
            </span>
          </button>
        </div>

        {/* Links */}
        <div className="flex flex-col sm:flex-row gap-6 justify-center text-sm">
          <a
            href="https://github.com/semiotic-agentium"
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand-blue hover:text-brand-teal transition-colors"
          >
            GitHub
          </a>
          <a
            href="https://owasp.org/www-project-agentic-skills-top-10/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand-blue hover:text-brand-teal transition-colors"
          >
            OWASP AST10 Report
          </a>
          <a
            href="mailto:markeljan19@gmail.com"
            className="text-brand-blue hover:text-brand-teal transition-colors"
          >
            Contact
          </a>
        </div>
      </div>
    </section>
  );
}
