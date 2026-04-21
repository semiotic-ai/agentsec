"use client";

import { useState } from "react";

type Severity = "red" | "orange" | "yellow";

type Commandment = {
  id: string;
  slug: string;
  name: string;
  sev: Severity;
  what: string;
  why: string;
};

const OWASP_PROJECT_URL = "https://owasp.org/www-project-agentic-skills-top-10/";

const COMMANDMENTS: readonly Commandment[] = [
  {
    id: "AST-01",
    slug: "ast01",
    name: "Malicious Skills",
    sev: "red",
    what: "Skills that look legitimate but ship hidden payloads — credential stealers, backdoors, prompt injection buried in prose.",
    why: "Skills run with the agent's full permissions. One bad install can leak keys, SSH, wallets, and shell access.",
  },
  {
    id: "AST-02",
    slug: "ast02",
    name: "Supply Chain Compromise",
    sev: "red",
    what: "Skill registries lack the provenance controls mature package ecosystems take for granted.",
    why: "Publishing barriers are minimal. A single compromised dependency inherits the agent's entire credential set.",
  },
  {
    id: "AST-03",
    slug: "ast03",
    name: "Over-Privileged Skills",
    sev: "orange",
    what: "Skills that request far more permissions than their task actually needs.",
    why: "~90% of agent skills are over-permissioned. Every extra scope widens the blast radius.",
  },
  {
    id: "AST-04",
    slug: "ast04",
    name: "Insecure Metadata",
    sev: "orange",
    what: "Hidden capabilities that don't match a skill's public description or declared manifest.",
    why: "Reviewers can't consent to risks they can't see. Brand impersonation rides in on the same vector.",
  },
  {
    id: "AST-05",
    slug: "ast05",
    name: "Unsafe Deserialization",
    sev: "red",
    what: "YAML, JSON, and markdown parsed by skill loaders without sandboxing.",
    why: "Attackers ship executable payloads that trigger on skill load, before any user action.",
  },
  {
    id: "AST-06",
    slug: "ast06",
    name: "Weak Isolation",
    sev: "red",
    what: "Skills execute without effective containment between skill and host agent.",
    why: "A sandbox escape turns a single exploited skill into full host compromise.",
  },
  {
    id: "AST-07",
    slug: "ast07",
    name: "Update Drift",
    sev: "yellow",
    what: "Skills silently change after they were approved and reviewed.",
    why: "Reviews go stale the moment the upstream skill ships a new version. Signed audits don't survive drift.",
  },
  {
    id: "AST-08",
    slug: "ast08",
    name: "Poor Scanning",
    sev: "yellow",
    what: "Traditional scanners miss AI-specific attack patterns buried in prose and metadata.",
    why: "Malicious instructions hide in plain English. Code-only matchers leave the prose layer untouched.",
  },
  {
    id: "AST-09",
    slug: "ast09",
    name: "Insufficient Governance",
    sev: "orange",
    what: "Organizations run agents with no inventory of which skills are installed where.",
    why: "You can't audit, patch, or revoke what you can't see. Incidents become forensic archaeology.",
  },
  {
    id: "AST-10",
    slug: "ast10",
    name: "Cross-Platform Reuse",
    sev: "yellow",
    what: "Skills that are safe on one platform but dangerous when reused on another.",
    why: "Permission models differ across OpenClaw, Claude Code, and Cursor. The same skill is not the same risk.",
  },
];

const SEV_DOT: Record<Severity, string> = {
  red: "bg-brand-red",
  orange: "bg-brand-orange",
  yellow: "bg-brand-yellow",
};

const SEV_TEXT: Record<Severity, string> = {
  red: "text-brand-red",
  orange: "text-brand-orange",
  yellow: "text-brand-yellow",
};

const SEV_BG: Record<Severity, string> = {
  red: "bg-brand-red/10 border-brand-red/30",
  orange: "bg-brand-orange/10 border-brand-orange/30",
  yellow: "bg-brand-yellow/10 border-brand-yellow/30",
};

const SEV_LABEL: Record<Severity, string> = {
  red: "Critical",
  orange: "High",
  yellow: "Medium",
};

export function TenCommandments(): React.ReactNode {
  const [activeId, setActiveId] = useState<string>(COMMANDMENTS[0].id);
  const active = COMMANDMENTS.find((c) => c.id === activeId) ?? COMMANDMENTS[0];

  return (
    <section
      id="commandments"
      className="section-pad bg-brand-darker border-t border-b border-brand-border/60"
    >
      <div className="max-w-[1200px] mx-auto px-6">
        <div className="text-center mb-14">
          <div className="font-eyebrow mb-3">OWASP Agentic Skills Top 10</div>
          <h2 className="font-h1 mb-4 text-brand-text">The 10 ways agent skills fail.</h2>
          <p className="font-lead max-w-[640px] mx-auto">
            AgentSec scans for each of them, every run. Click a category to read the spec.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 content-start">
            {COMMANDMENTS.map((c) => {
              const isActive = c.id === activeId;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setActiveId(c.id)}
                  className={`text-left cursor-pointer rounded-[10px] px-4 py-3.5 border transition-all duration-150 ${
                    isActive
                      ? "bg-brand-card border-brand-teal shadow-[0_0_0_1px_var(--teal),0_8px_24px_-8px_rgba(0,210,180,0.25)]"
                      : "bg-brand-secondary border-brand-border hover:border-brand-border-strong"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${SEV_DOT[c.sev]}`}
                      aria-hidden="true"
                    />
                    <span
                      className={`font-mono text-[11px] tracking-[0.04em] whitespace-nowrap ${
                        isActive ? "text-brand-teal" : "text-brand-dim"
                      }`}
                    >
                      {c.id}
                    </span>
                  </div>
                  <div className="text-sm font-medium leading-tight text-brand-text">{c.name}</div>
                </button>
              );
            })}
          </div>

          <div className="lg:sticky lg:top-24 lg:self-start rounded-[14px] bg-brand-card border border-brand-border p-8 lg:h-[480px] flex flex-col">
            <div className="flex items-center gap-3 mb-5">
              <span
                className={`px-2.5 py-1 rounded-md font-mono text-xs border ${SEV_BG[active.sev]} ${SEV_TEXT[active.sev]}`}
              >
                {active.id}
              </span>
              <span
                className={`font-mono text-[11px] uppercase tracking-[0.1em] ${SEV_TEXT[active.sev]}`}
              >
                {SEV_LABEL[active.sev]}
              </span>
            </div>
            <h3 className="font-h2 mb-6 text-brand-text">{active.name}</h3>

            <div className="mb-6">
              <div className="font-mono text-[11px] text-brand-dim uppercase tracking-[0.08em] mb-2">
                What it is
              </div>
              <p className="text-[16px] leading-[1.6] text-brand-text">{active.what}</p>
            </div>

            <div className="mb-6">
              <div className="font-mono text-[11px] text-brand-dim uppercase tracking-[0.08em] mb-2">
                Why it matters
              </div>
              <p className="text-[15px] leading-[1.6] text-brand-muted">{active.why}</p>
            </div>

            <div className="mt-auto pt-5 border-t border-brand-border/60 flex items-center justify-between gap-3 flex-wrap">
              <code className="font-mono text-xs text-brand-dim bg-brand-dark px-2.5 py-1.5 rounded border border-brand-border">
                agentsec --verbose | grep {active.id}
              </code>
              <a
                href={`${OWASP_PROJECT_URL}${active.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-xs text-brand-teal hover:underline"
              >
                OWASP {active.id} →
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
