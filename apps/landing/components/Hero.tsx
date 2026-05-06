"use client";

import { useState } from "react";

const CMD = "npx agentsec";
const COPIED_MS = 1600;

type Skill = {
  name: string;
  version: string;
  score: number;
  grade: "A" | "B" | "C" | "D" | "F";
};

const SKILLS: readonly Skill[] = [
  { name: "helpful-summarizer", version: "1.2.0", score: 30, grade: "F" },
  { name: "code-formatter", version: "1.2.0", score: 56, grade: "D" },
  { name: "csv-analyzer", version: "1.0.0", score: 62, grade: "C" },
  { name: "i18n-translator", version: "3.2.1", score: 30, grade: "F" },
  { name: "note-taker", version: "2.0.0", score: 88, grade: "B" },
];

export function Hero(): React.ReactNode {
  return (
    <section className="relative overflow-hidden pt-[140px] pb-20">
      <div className="bg-grid pointer-events-none absolute inset-0" aria-hidden="true" />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 -translate-x-1/2 -top-52 w-[900px] h-[600px] opacity-60"
        style={{
          background: "radial-gradient(ellipse at center, rgba(0,210,180,0.18), transparent 60%)",
        }}
      />

      <div className="relative max-w-[1200px] mx-auto px-6">
        <div className="grid gap-14 lg:gap-[60px] items-center lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <div className="animate-fade-up">
            <div className="flex items-center flex-wrap gap-3 mb-6">
              <span className="inline-flex items-center gap-2 font-mono text-[11px] font-medium tracking-[0.04em] uppercase px-3 py-1.5 rounded-full border border-brand-teal/25 bg-brand-teal/10 text-brand-teal">
                <span
                  className="w-1.5 h-1.5 rounded-full bg-brand-teal animate-pulse-teal"
                  aria-hidden="true"
                />
                OWASP AST-10 + Web3 Annex
              </span>
              <span className="text-[13px] text-brand-dim">v0.2.5 · MIT</span>
            </div>

            <h1 className="font-display mb-6 text-brand-text">
              Audit every
              <br />
              <span className="bg-gradient-to-b from-brand-teal to-brand-teal-dim bg-clip-text text-transparent">
                Agent Skill
              </span>
            </h1>

            <p className="font-lead max-w-[540px] mb-8">
              One command scans every skill installed in your project — for vulnerabilities,
              supply-chain risk, and policy drift. Results in seconds, aligned with the OWASP
              Agentic Skills Top 10.
            </p>

            <CopyCommand />

            <div className="flex flex-wrap gap-3 mt-6">
              <a
                href="#commandments"
                className="inline-flex items-center gap-2 px-5 py-3 rounded-lg border border-brand-border bg-transparent text-brand-text text-sm font-medium hover:bg-brand-card hover:border-brand-border-strong transition-colors"
              >
                Read the Top 10 →
              </a>
              <a
                href="#formats"
                className="inline-flex items-center gap-2 px-5 py-3 rounded-lg border border-brand-border bg-transparent text-brand-text text-sm font-medium hover:bg-brand-card hover:border-brand-border-strong transition-colors"
              >
                See an example report
              </a>
            </div>

            <div className="flex flex-wrap gap-8 mt-12 pt-7 border-t border-brand-border/60">
              <Stat value="10" label="OWASP AST categories" />
              <Stat value="4" label="Output formats" />
              <Stat value="3" label="Agent platforms" />
              <Stat value="0–100" label="Skill score range" mono />
            </div>
          </div>

          <div className="animate-fade-up hidden lg:block" style={{ animationDelay: "0.15s" }}>
            <ScoreDashboard />
          </div>
        </div>
      </div>
    </section>
  );
}

function Stat({
  value,
  label,
  mono,
}: {
  value: string;
  label: string;
  mono?: boolean;
}): React.ReactNode {
  return (
    <div>
      <div
        className={`text-[28px] font-semibold text-brand-text leading-none tracking-[-0.02em] ${
          mono ? "font-mono" : ""
        }`}
      >
        {value}
      </div>
      <div className="text-[13px] text-brand-dim mt-1.5">{label}</div>
    </div>
  );
}

function CopyCommand(): React.ReactNode {
  const [copied, setCopied] = useState(false);
  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(CMD);
    } catch {
      // ignore
    }
    setCopied(true);
    setTimeout(() => setCopied(false), COPIED_MS);
  };
  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex items-center gap-[14px] bg-brand-secondary border border-brand-border hover:bg-brand-card hover:border-brand-teal transition-colors py-3.5 pl-5 pr-[18px] rounded-[10px] font-mono text-[15px] text-brand-text cursor-pointer"
    >
      <span className="text-brand-dim">$</span>
      <span>
        <span className="text-brand-text">npx</span>{" "}
        <span className="text-brand-teal">agentsec</span>
      </span>
      <span
        className={`inline-flex items-center gap-1.5 pl-3.5 border-l border-brand-border text-xs ${
          copied ? "text-brand-green" : "text-brand-dim"
        }`}
      >
        {copied ? (
          <>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M20 6L9 17l-5-5" />
            </svg>
            copied
          </>
        ) : (
          <>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              aria-hidden="true"
            >
              <rect x="9" y="9" width="13" height="13" rx="2" />
              <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
            </svg>
            copy
          </>
        )}
      </span>
    </button>
  );
}

function ScoreDashboard(): React.ReactNode {
  return (
    <div
      className="overflow-hidden rounded-[14px] border border-brand-border shadow-brand-3"
      style={{ background: "linear-gradient(180deg, var(--bg-3), var(--bg-2))" }}
    >
      <div className="flex items-center gap-2.5 px-[18px] py-3.5 border-b border-brand-border bg-brand-secondary">
        <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" aria-hidden="true" />
        <span className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" aria-hidden="true" />
        <span className="w-2.5 h-2.5 rounded-full bg-[#28c840]" aria-hidden="true" />
        <span className="flex-1 text-center font-mono text-xs text-brand-dim">
          ~/my-project · agentsec audit
        </span>
      </div>

      <div className="grid grid-cols-[auto_1fr] gap-5 items-center px-[22px] py-5 border-b border-brand-border/60">
        <CircularScore score={53} />
        <div>
          <div className="font-eyebrow mb-1.5">Project score</div>
          <div className="text-[15px] text-brand-text mb-1">8 skills scanned · 0 certified</div>
          <div className="flex flex-wrap gap-2.5">
            <SevChip count="17" color="red" name="critical" />
            <SevChip count="30" color="orange" name="high" />
            <SevChip count="39" color="yellow" name="medium" />
            <SevChip count="33" color="blue" name="low" />
          </div>
        </div>
      </div>

      <div>
        {SKILLS.map((s) => (
          <SkillRow key={s.name} {...s} />
        ))}
      </div>

      <div className="flex justify-between items-center px-[18px] py-3 border-t border-brand-border/60 bg-brand-secondary font-mono text-xs text-brand-dim">
        <span>
          policy: <span className="text-brand-teal">strict</span>
        </span>
        <span className="text-brand-yellow">⚠ WARN · 47 high/critical</span>
      </div>
    </div>
  );
}

function SevChip({
  count,
  color,
  name,
}: {
  count: string;
  color: "red" | "orange" | "yellow" | "blue";
  name: string;
}): React.ReactNode {
  const dot =
    color === "red"
      ? "bg-brand-red"
      : color === "orange"
        ? "bg-brand-orange"
        : color === "yellow"
          ? "bg-brand-yellow"
          : "bg-brand-blue";
  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} aria-hidden="true" />
      <span className="text-brand-text font-medium">{count}</span>
      <span className="text-brand-dim">{name}</span>
    </span>
  );
}

function SkillRow({ name, version, score, grade }: Skill): React.ReactNode {
  const gradeColor =
    grade === "A" || grade === "B"
      ? "bg-brand-green/10 text-brand-green border-brand-green/35"
      : grade === "C"
        ? "bg-brand-yellow/10 text-brand-yellow border-brand-yellow/35"
        : grade === "D"
          ? "bg-brand-orange/10 text-brand-orange border-brand-orange/35"
          : "bg-brand-red/10 text-brand-red border-brand-red/35";
  const barColor =
    score >= 85
      ? "bg-brand-green"
      : score >= 70
        ? "bg-brand-yellow"
        : score >= 50
          ? "bg-brand-orange"
          : "bg-brand-red";
  return (
    <div className="grid grid-cols-[auto_1fr_auto_auto] gap-3.5 items-center px-[22px] py-3 border-b border-brand-border/60 last:border-b-0">
      <span
        className={`inline-flex items-center justify-center w-7 h-7 rounded-md border font-mono font-bold text-sm ${gradeColor}`}
      >
        {grade}
      </span>
      <div className="min-w-0">
        <div className="font-mono text-[13px] text-brand-text truncate">{name}</div>
        <div className="font-mono text-[11px] text-brand-dim">v{version}</div>
      </div>
      <div className="w-[120px] h-1.5 bg-brand-dark rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${score}%` }} />
      </div>
      <div className="font-mono text-[13px] text-brand-muted min-w-[32px] text-right">{score}</div>
    </div>
  );
}

function CircularScore({ score }: { score: number }): React.ReactNode {
  const r = 34;
  const c = 2 * Math.PI * r;
  const off = c - (score / 100) * c;
  const color =
    score >= 85
      ? "var(--green)"
      : score >= 70
        ? "var(--yellow)"
        : score >= 50
          ? "var(--orange)"
          : "var(--red)";
  return (
    <div
      role="img"
      aria-label={`Project score ${score} of 100`}
      className="relative w-[84px] h-[84px]"
    >
      <svg width="84" height="84" viewBox="0 0 84 84" aria-hidden="true">
        <circle cx="42" cy="42" r={r} stroke="var(--border-1)" strokeWidth="6" fill="none" />
        <circle
          cx="42"
          cy="42"
          r={r}
          stroke={color}
          strokeWidth="6"
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={off}
          strokeLinecap="round"
          transform="rotate(-90 42 42)"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-[22px] font-semibold text-brand-text leading-none">{score}</div>
        <div className="text-[10px] text-brand-dim font-mono mt-0.5">/ 100</div>
      </div>
    </div>
  );
}
