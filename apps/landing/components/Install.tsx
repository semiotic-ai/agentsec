"use client";

import { useState } from "react";

type PkgManager = "npx" | "bun" | "npm" | "pnpm" | "yarn" | "clawhub";

const CMDS: Record<PkgManager, string> = {
  npx: "npx agentsec",
  bun: "bun add -g agentsec",
  npm: "npm install -g agentsec",
  pnpm: "pnpm add -g agentsec",
  yarn: "yarn global add agentsec",
  clawhub: "npx clawhub install markeljan/agentsec",
};

const KEYS = Object.keys(CMDS) as PkgManager[];

const GITHUB_URL = "https://github.com/semiotic-ai/agentsec";

export function Install(): React.ReactNode {
  const [tab, setTab] = useState<PkgManager>("npx");
  const [copied, setCopied] = useState(false);

  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(CMDS[tab]);
    } catch {
      // ignore
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const [head, ...tail] = CMDS[tab].split(" ");
  const rest = tail.join(" ");

  return (
    <section id="install" className="section-pad relative overflow-hidden">
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% 50%, rgba(0,210,180,0.1), transparent 60%)",
        }}
      />
      <div className="relative max-w-[880px] mx-auto px-6 text-center">
        <div className="font-eyebrow mb-4">Install</div>
        <h2
          className="font-display mb-6 text-brand-text"
          style={{ fontSize: "clamp(40px, 5.5vw, 72px)" }}
        >
          Audit skills.
          <br />
          <span className="text-brand-teal">Trust agents.</span>
        </h2>
        <p className="font-lead max-w-[520px] mx-auto mb-10">
          Start with <code className="font-mono text-brand-teal">npx agentsec</code>. No install, no
          config, no flags — it runs.
        </p>

        <div className="max-w-[560px] mx-auto bg-brand-secondary border border-brand-border rounded-xl overflow-hidden shadow-brand-2">
          <div className="flex border-b border-brand-border bg-brand-card">
            {KEYS.map((k) => {
              const isActive = tab === k;
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => setTab(k)}
                  className={`flex-1 py-2.5 cursor-pointer border-r border-brand-border/60 last:border-r-0 font-mono text-xs tracking-[0.04em] lowercase transition-colors ${
                    isActive
                      ? "bg-brand-secondary text-brand-teal border-b-2 border-b-brand-teal -mb-px"
                      : "bg-transparent text-brand-dim border-b-2 border-b-transparent hover:text-brand-text"
                  }`}
                >
                  {k}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={copy}
            aria-label={`Copy install command ${CMDS[tab]}`}
            className="w-full px-6 py-5 font-mono text-base text-left cursor-pointer flex items-center justify-between"
          >
            <span>
              <span className="text-brand-dim">$ </span>
              <span className="text-brand-text">{head}</span>
              {rest && <span className="text-brand-teal"> {rest}</span>}
            </span>
            <span
              className={`text-xs inline-flex items-center gap-1.5 ${
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
                "click to copy"
              )}
            </span>
          </button>
        </div>

        <div className="mt-10 flex flex-wrap gap-3 justify-center">
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-brand-teal text-brand-dark text-sm font-medium px-5 py-3 rounded-lg shadow-brand-teal hover:bg-brand-teal-dim hover:-translate-y-[1px] hover:shadow-brand-teal-strong transition-all duration-200"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
            </svg>
            Star on GitHub
          </a>
          <a
            href="/skill.md"
            className="inline-flex items-center gap-2 bg-transparent border border-brand-border text-brand-text text-sm font-medium px-5 py-3 rounded-lg hover:bg-brand-card hover:border-brand-border-strong transition-colors"
          >
            Read skill.md →
          </a>
        </div>
      </div>
    </section>
  );
}
