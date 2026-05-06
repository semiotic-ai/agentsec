type Critical = true | false | "cve";

type Preset = {
  name: string;
  critical: Critical;
  high: boolean;
  tests: boolean;
  tag: string;
  note: string;
};

const POLICIES: readonly Preset[] = [
  {
    name: "default",
    critical: true,
    high: false,
    tests: false,
    tag: "Balanced",
    note: "Blocks critical findings.",
  },
  {
    name: "strict",
    critical: true,
    high: true,
    tests: true,
    tag: "Enterprise",
    note: "Blocks critical & high, enforces tests.",
  },
  {
    name: "permissive",
    critical: "cve",
    high: false,
    tests: false,
    tag: "Dev",
    note: "Only blocks critical CVEs.",
  },
  {
    name: "owasp-top-10",
    critical: true,
    high: true,
    tests: false,
    tag: "Compliance",
    note: "Direct mapping to OWASP AST-10.",
  },
];

export function Policy(): React.ReactNode {
  return (
    <section
      id="policy"
      className="section-pad bg-brand-darker border-t border-b border-brand-border/60"
    >
      <div className="max-w-[1200px] mx-auto px-6">
        <div className="text-center mb-12">
          <div className="font-eyebrow mb-3">Policies</div>
          <h2 className="font-h1 mb-4 text-brand-text">Pick a preset. Or write your own.</h2>
          <p className="font-lead max-w-[640px] mx-auto">
            Every audit runs against a policy. Four presets ship built-in, and you can define custom
            gates in <code className="font-mono text-brand-teal">.agentsecrc</code>.
          </p>
        </div>

        <div className="max-w-[960px] mx-auto bg-brand-card border border-brand-border rounded-[14px] overflow-hidden">
          <div className="hidden md:grid grid-cols-[1.3fr_1fr_1fr_1fr_1.5fr] gap-4 px-5 py-3.5 border-b border-brand-border bg-brand-secondary font-mono text-[11px] text-brand-dim uppercase tracking-[0.08em]">
            <span>Preset</span>
            <span>Blocks critical</span>
            <span>Blocks high</span>
            <span>Requires tests</span>
            <span>Use case</span>
          </div>
          {POLICIES.map((p, i) => (
            <div
              key={p.name}
              className={`grid grid-cols-1 md:grid-cols-[1.3fr_1fr_1fr_1fr_1.5fr] gap-3 md:gap-4 px-5 py-4 md:py-[18px] md:items-center ${
                i < POLICIES.length - 1 ? "border-b border-brand-border/60" : ""
              }`}
            >
              <div>
                <code className="font-mono text-sm text-brand-teal">--policy {p.name}</code>
                <div className="text-[11px] text-brand-dim mt-1">{p.tag}</div>
              </div>
              <PolicyCell
                label="Blocks critical"
                on={p.critical === true}
                specialLabel={p.critical === "cve" ? "CVE only" : undefined}
              />
              <PolicyCell label="Blocks high" on={p.high} />
              <PolicyCell label="Requires tests" on={p.tests} />
              <div className="text-sm text-brand-muted">{p.note}</div>
            </div>
          ))}
        </div>

        <div className="max-w-[960px] mx-auto mt-8 bg-brand-secondary border border-brand-border rounded-xl px-6 py-5 font-mono text-[13px] leading-[1.7]">
          <div className="text-[11px] text-brand-dim uppercase tracking-[0.08em] mb-2">
            .agentsecrc
          </div>
          <div>
            <span className="text-brand-dim">{"{"}</span>
          </div>
          <div>
            {"  "}
            <span className="text-brand-blue">"policy"</span>:{" "}
            <span className="text-brand-teal">"strict"</span>,
          </div>
          <div>
            {"  "}
            <span className="text-brand-blue">"platform"</span>:{" "}
            <span className="text-brand-teal">"openclaw"</span>,
          </div>
          <div>
            {"  "}
            <span className="text-brand-blue">"format"</span>:{" "}
            <span className="text-brand-teal">"sarif"</span>,
          </div>
          <div>
            {"  "}
            <span className="text-brand-blue">"output"</span>:{" "}
            <span className="text-brand-teal">"audit.sarif"</span>
          </div>
          <div>
            <span className="text-brand-dim">{"}"}</span>
          </div>
        </div>
      </div>
    </section>
  );
}

function PolicyCell({
  label,
  on,
  specialLabel,
}: {
  label: string;
  on: boolean;
  specialLabel?: string;
}): React.ReactNode {
  if (specialLabel) {
    return (
      <span className="font-mono text-sm text-brand-yellow inline-flex items-center">
        <span className="md:hidden font-sans text-xs text-brand-dim mr-2">{label}:</span>
        {specialLabel}
      </span>
    );
  }
  return on ? (
    <span className="inline-flex items-center gap-1.5 text-sm text-brand-green">
      <span className="md:hidden font-sans text-xs text-brand-dim mr-2">{label}:</span>
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
      yes
    </span>
  ) : (
    <span className="text-sm text-brand-dim inline-flex items-center">
      <span className="md:hidden font-sans text-xs text-brand-dim mr-2">{label}:</span>—
    </span>
  );
}
