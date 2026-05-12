"use client";

const OWASP_FILTER_EVENT = "skill-watch:filter-owasp";

const OWASP_NAMES: Record<string, string> = {
  AST01: "Malicious Skills",
  AST02: "Supply Chain Compromise",
  AST03: "Over-Privileged Skills",
  AST04: "Insecure Metadata",
  AST05: "Unsafe Deserialization",
  AST06: "Weak Isolation",
  AST07: "Update Drift",
  AST08: "Poor Scanning",
  AST09: "Insufficient Governance",
  AST10: "Cross-Platform Reuse",
};

export function OwaspBars({ rows }: { rows: { id: string; count: number }[] }): React.ReactNode {
  if (rows.length === 0) return null;
  const max = rows[0]?.count ?? 1;

  const handleSelect = (id: string): void => {
    window.dispatchEvent(new CustomEvent(OWASP_FILTER_EVENT, { detail: { id } }));
    const target = document.getElementById("inventory");
    if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="grid gap-3">
      {rows.map((row) => (
        <button
          key={row.id}
          type="button"
          onClick={() => handleSelect(row.id)}
          aria-label={`Filter inventory to ${row.id} ${OWASP_NAMES[row.id] ?? ""}, ${row.count} skill${row.count === 1 ? "" : "s"}`}
          className="grid grid-cols-[80px_minmax(0,1fr)_auto] items-center gap-4 px-5 py-3.5 rounded-xl border border-brand-border bg-brand-card hover:border-brand-teal/60 hover:bg-brand-card-hover transition-colors text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal"
        >
          <span className="font-mono text-[12px] text-brand-teal">{row.id}</span>
          <div>
            <div className="text-sm text-brand-text mb-1.5">{OWASP_NAMES[row.id] ?? row.id}</div>
            <div className="h-1.5 w-full bg-brand-dark rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-brand-teal"
                style={{ width: `${(row.count / max) * 100}%` }}
              />
            </div>
          </div>
          <span className="font-mono text-sm text-brand-text tabular-nums">
            {row.count}{" "}
            <span className="text-brand-dim text-xs">skill{row.count === 1 ? "" : "s"}</span>
          </span>
        </button>
      ))}
    </div>
  );
}
