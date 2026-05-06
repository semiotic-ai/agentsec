type Step = {
  n: string;
  title: string;
  body: string;
  meta: string;
};

const STEPS: readonly Step[] = [
  {
    n: "01",
    title: "Discover",
    body: "Crawls .skill/, skill.md files, and platform manifests across your project. No config, no flags — it finds every installed skill.",
    meta: "openclaw · claude · codex",
  },
  {
    n: "02",
    title: "Audit",
    body: "Runs each skill through 10 OWASP categories: malicious prose injection, over-permissioned scopes, supply-chain drift, weak isolation, and more.",
    meta: "10 categories · 47 rules",
  },
  {
    n: "03",
    title: "Report",
    body: "Text for humans, JSON for scripts, SARIF for IDEs, HTML for stakeholders. Gate CI with the exit code — zero special flags required.",
    meta: "4 formats · 4 policy presets",
  },
];

export function HowItWorks(): React.ReactNode {
  return (
    <section className="section-pad border-t border-brand-border/60">
      <div className="max-w-[1200px] mx-auto px-6">
        <div className="grid gap-10 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] items-end mb-14">
          <div>
            <div className="font-eyebrow mb-3">How it works</div>
            <h2 className="font-h1 text-brand-text">
              Three steps.
              <br />
              Seconds each.
            </h2>
          </div>
          <p className="font-lead max-w-[520px]">
            AgentSec is a single binary with zero runtime dependencies. It runs locally, never
            phones home, and produces deterministic audit artifacts you can diff, sign, and replay.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          {STEPS.map((s) => (
            <div
              key={s.n}
              className="relative rounded-xl border border-brand-border bg-brand-card p-6 hover:border-brand-border-strong hover:-translate-y-0.5 transition-all duration-200"
            >
              <div className="flex items-center gap-2.5 font-mono text-xs text-brand-teal tracking-[0.08em] mb-5">
                <span>{s.n}</span>
                <span
                  aria-hidden="true"
                  className="flex-1 h-px"
                  style={{
                    background: "linear-gradient(90deg, rgba(0,210,180,0.2), transparent)",
                  }}
                />
              </div>
              <h3 className="text-[28px] font-semibold leading-tight tracking-[-0.02em] mb-3 text-brand-text">
                {s.title}
              </h3>
              <p className="text-[15px] leading-[1.6] text-brand-muted mb-5">{s.body}</p>
              <div className="font-mono text-[11px] text-brand-dim pt-4 border-t border-brand-border/60">
                {s.meta}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
