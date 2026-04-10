interface Flag {
  flag: string;
  description: string;
}

const flags: Flag[] = [
  {
    flag: "--verbose",
    description: "Show detailed findings, score breakdowns, and remediation.",
  },
  {
    flag: "--format json",
    description: "Machine-readable output for CI pipelines and dashboards.",
  },
  {
    flag: "--fail-on high",
    description: "Exit non-zero on high or critical findings (CI gate).",
  },
];

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
    <section id="cli" className="section-pad bg-brand-secondary">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">CLI Examples</h2>
          <p className="text-xl text-brand-muted max-w-2xl mx-auto">
            Run audits from the command line or integrate into your CI/CD pipeline.
          </p>
        </div>

        {/* Terminal */}
        <div className="p-6 mb-8 border border-brand-border rounded-lg bg-brand-dark overflow-hidden">
          <pre className="font-mono text-sm text-brand-muted overflow-x-auto whitespace-pre">
            {terminalOutput}
          </pre>
        </div>

        {/* Flags */}
        <div className="grid md:grid-cols-3 gap-4">
          {flags.map((item) => (
            <div
              key={item.flag}
              className="p-5 border border-brand-border rounded-lg bg-brand-dark hover:border-brand-teal transition-colors duration-300"
            >
              <code className="block text-brand-teal font-mono text-sm mb-2">{item.flag}</code>
              <p className="text-sm text-brand-muted">{item.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
