"use client";

interface Command {
  title: string;
  description: string;
  command: string;
  output: string;
}

const commands: Command[] = [
  {
    title: "Audit Your Agent",
    description:
      "Automatically discover and audit every skill your agent has installed.",
    command: "npx agent-audit",
    output: `Discovering installed skills...
✓ OpenClaw/my-webhook-skill: PASS
✓ Claude-Code/pdf-analyzer: PASS
✗ Cursor/legacy-skill: FAIL (AST03, AST07)
✓ Codex/payment-processor: PASS (2 warnings)

Results: 10 passed, 1 failed, 1 with warnings
Policy Compliance: 91%`,
  },
  {
    title: "Generate Report",
    description:
      "Create detailed HTML/JSON reports for compliance documentation.",
    command: "npx agent-audit --report json",
    output: `{
  "scannedAt": "2025-04-02T12:34:56Z",
  "skillCount": 12,
  "riskLevel": "MEDIUM",
  "findings": {
    "critical": 0,
    "high": 2,
    "medium": 5,
    "low": 8
  },
  "complianceScore": 91,
  "recommendations": [...]
}`,
  },
  {
    title: "Enforce Policy",
    description:
      "Integrate into CI/CD to block unsafe skills from deployment.",
    command: "npx agent-audit --enforce --fail-threshold 85",
    output: `Discovering installed skills...
Enforcing policy: min compliance 85%

Current compliance: 91%
✓ Policy check PASSED

Safe to deploy.`,
  },
  {
    title: "Custom Rules",
    description:
      "Define organization-specific security policies and compliance rules.",
    command: "npx agent-audit --policy ./policy.yaml",
    output: `Loading policy: ./policy.yaml
Applying 8 custom rules...

✓ All skills meet organizational standards
✓ No prohibited dependencies detected
✓ Logging requirements: 12/12 compliant
✓ Data retention: PASSED`,
  },
];

export function CLIUsage(): React.ReactNode {
  return (
    <section className="section-pad bg-brand-secondary">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            CLI Examples
          </h2>
          <p className="text-xl text-brand-muted max-w-2xl mx-auto">
            Run audits from the command line or integrate into your CI/CD
            pipeline.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {commands.map((cmd, index) => (
            <div
              key={index}
              className="border border-brand-border rounded-lg bg-brand-dark overflow-hidden hover:border-brand-teal transition-colors duration-300"
            >
              {/* Header */}
              <div className="p-6 border-b border-brand-border">
                <h3 className="text-lg font-bold mb-2">{cmd.title}</h3>
                <p className="text-sm text-brand-muted">{cmd.description}</p>
              </div>

              {/* Command */}
              <div className="p-4 bg-brand-secondary border-b border-brand-border">
                <div className="text-sm text-brand-muted mb-2">Command:</div>
                <code className="block text-brand-blue font-mono text-sm overflow-x-auto pb-2">
                  $ {cmd.command}
                </code>
              </div>

              {/* Output */}
              <div className="p-4">
                <div className="text-sm text-brand-muted mb-2">Output:</div>
                <pre className="font-mono text-xs text-brand-muted overflow-x-auto">
                  {cmd.output}
                </pre>
              </div>
            </div>
          ))}
        </div>

        {/* Quick reference */}
        <div className="mt-16 p-8 border border-brand-border rounded-lg bg-brand-dark">
          <h3 className="text-lg font-bold mb-4">Quick Reference</h3>
          <div className="grid md:grid-cols-2 gap-4 text-sm font-mono">
            <div>
              <div className="text-brand-teal mb-2">--report</div>
              <div className="text-brand-muted">
                Output format: html, json, pdf
              </div>
            </div>
            <div>
              <div className="text-brand-teal mb-2">--enforce</div>
              <div className="text-brand-muted">
                Fail if policy violations found
              </div>
            </div>
            <div>
              <div className="text-brand-teal mb-2">--policy</div>
              <div className="text-brand-muted">
                Custom policy YAML file path
              </div>
            </div>
            <div>
              <div className="text-brand-teal mb-2">--fail-threshold</div>
              <div className="text-brand-muted">
                Minimum compliance score required
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
