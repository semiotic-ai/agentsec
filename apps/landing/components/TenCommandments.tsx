const commandments = [
  { id: "AST-01", name: "Malicious Skills" },
  { id: "AST-02", name: "Supply Chain" },
  { id: "AST-03", name: "Over-Privileged" },
  { id: "AST-04", name: "Insecure Metadata" },
  { id: "AST-05", name: "Unsafe Deserialization" },
  { id: "AST-06", name: "Weak Isolation" },
  { id: "AST-07", name: "Update Drift" },
  { id: "AST-08", name: "Poor Scanning" },
  { id: "AST-09", name: "No Governance" },
  { id: "AST-10", name: "Cross-Platform Reuse" },
] as const;

export function TenCommandments(): React.ReactNode {
  return (
    <section
      id="commandments"
      className="bg-brand-dark py-20 md:py-24 border-t border-brand-border"
    >
      <div className="max-w-3xl mx-auto px-6">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-4 text-brand-text">
          The Ten Commandments
        </h2>
        <p className="text-brand-muted text-center mb-12">
          OWASP AST10 — the ten risks AgentSec audits
        </p>
        <table className="w-full border-collapse">
          <thead className="sr-only">
            <tr>
              <th scope="col">Code</th>
              <th scope="col">Risk</th>
            </tr>
          </thead>
          <tbody>
            {commandments.map((item) => (
              <tr key={item.id} className="border-b border-brand-border/50">
                <th
                  scope="row"
                  className="py-4 pr-6 text-left font-mono text-sm text-brand-teal whitespace-nowrap"
                >
                  {item.id}
                </th>
                <td className="py-4 text-base md:text-lg text-brand-text">{item.name}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
