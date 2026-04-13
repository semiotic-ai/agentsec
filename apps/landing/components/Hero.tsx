export function Hero(): React.ReactNode {
  return (
    <section className="flex items-center justify-center bg-brand-dark pt-24 md:pt-28 pb-6">
      <div className="max-w-4xl mx-auto px-6">
        <div className="text-center">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-5 leading-tight">
            Audit every skill <br />
            your <span className="text-brand-teal">AI Agents</span> run.
          </h1>
          <p className="text-lg md:text-xl text-brand-muted mb-6 max-w-2xl mx-auto leading-relaxed">
            One command scans every skill your agent has installed — vulnerabilities, supply chain
            risks, policy violations.{" "}
            <a href="/skill.md" className="text-brand-teal hover:underline">
              skill.md
            </a>{" "}
            ·{" "}
            <a href="/examples" className="text-brand-teal hover:underline">
              Example outputs
            </a>
          </p>
        </div>
      </div>
    </section>
  );
}
