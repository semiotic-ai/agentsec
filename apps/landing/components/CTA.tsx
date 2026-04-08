"use client";

import { useState } from "react";

export function CTA(): React.ReactNode {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    if (email) {
      setSubmitted(true);
      setEmail("");
      setTimeout(() => setSubmitted(false), 3000);
    }
  };

  return (
    <section className="section-pad bg-brand-dark relative overflow-hidden">
      {/* Gradient orbs */}
      <div className="absolute -top-40 -right-40 w-80 h-80 bg-brand-teal rounded-full mix-blend-multiply filter blur-3xl opacity-5 animate-pulse" />
      <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-brand-blue rounded-full mix-blend-multiply filter blur-3xl opacity-5 animate-pulse" />

      <div className="relative z-10 max-w-4xl mx-auto text-center">
        <h2 className="text-4xl md:text-5xl font-bold mb-6">Start Auditing Your Agents</h2>
        <p className="text-xl text-brand-muted mb-12 max-w-2xl mx-auto">
          One command. Every skill. Full visibility into what your AI agents are running.
        </p>

        {/* Email signup */}
        <form
          onSubmit={handleSubmit}
          className="mb-8 flex flex-col sm:flex-row gap-3 max-w-md mx-auto"
        >
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            required
            className="flex-1 px-4 py-3 rounded-lg bg-brand-secondary border border-brand-border text-brand-text placeholder-brand-muted focus:outline-none focus:border-brand-teal focus:ring-1 focus:ring-brand-teal"
          />
          <button type="submit" className="btn-primary px-6 py-3 whitespace-nowrap font-semibold">
            {submitted ? "Thanks!" : "Get Updates"}
          </button>
        </form>

        {/* Links */}
        <div className="flex flex-col sm:flex-row gap-6 justify-center mb-12 text-sm">
          <a
            href="https://github.com/Markeljan/agent-audit"
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

        {/* Footer stats */}
        <div className="pt-12 border-t border-brand-border">
          <div className="flex flex-col md:flex-row justify-center items-center gap-8 text-brand-muted text-xs">
            <div>
              <div className="text-2xl font-bold text-brand-teal">10</div>
              <div>OWASP Risk Categories</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-brand-green">119</div>
              <div>Vulnerability Patterns</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-brand-blue">4</div>
              <div>Output Formats</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-brand-yellow">100%</div>
              <div>Open Source</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
