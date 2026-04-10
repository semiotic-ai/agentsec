const terminalOutput = `$ npx agentsec --verbose

  ✔ Found 6 skills

  ✔ fetch-data     v1.0.0  D (42)
  ✔ deploy-helper  v2.3.0  C (68)
  ✔ code-review    v1.1.0  A (95)
  ✔ summarize-docs v0.9.0  A (91)
  ✔ db-migrate     v1.4.2  B (78)
  ✔ lint-fix       v2.0.0  A (93)

  6 skills scanned  •  avg score 78  •  4 certified
  Findings: 2 critical, 1 high, 2 medium

  ⚠ WARN  3 high/critical finding(s) detected`;

export function CLIUsage(): React.ReactNode {
  return (
    <section id="cli" className="bg-brand-dark py-20 md:py-24 border-t border-brand-border">
      <div className="max-w-3xl mx-auto px-6">
        <div className="rounded-lg border border-brand-border bg-brand-secondary overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
          {/* Title bar */}
          <div className="flex items-center gap-1.5 px-4 py-3 border-b border-brand-border bg-brand-card">
            <span className="w-3 h-3 rounded-full bg-[#ff5f57]" aria-hidden="true" />
            <span className="w-3 h-3 rounded-full bg-[#febc2e]" aria-hidden="true" />
            <span className="w-3 h-3 rounded-full bg-[#28c840]" aria-hidden="true" />
            <span className="flex-1 text-center text-xs text-brand-muted font-mono select-none">
              agentsec — ~/my-project
            </span>
            <span className="w-[42px]" aria-hidden="true" />
          </div>
          {/* Body */}
          <pre className="font-mono text-sm md:text-[13px] leading-relaxed text-brand-muted overflow-x-auto whitespace-pre px-6 py-5">
            {terminalOutput}
          </pre>
        </div>
      </div>
    </section>
  );
}
