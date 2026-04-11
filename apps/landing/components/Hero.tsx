export function Hero(): React.ReactNode {
  return (
    <section className="flex items-center justify-center bg-brand-dark pt-24 md:pt-28 pb-6">
      <div className="max-w-4xl mx-auto px-6">
        <div className="text-center">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-5 leading-tight">
            Audit every skill <br />
            your <span className="text-brand-teal">AI agents</span> run.
          </h1>
          <p className="text-lg md:text-xl text-brand-muted mb-6 max-w-2xl mx-auto leading-relaxed">
            One command scans every skill your agent has installed — vulnerabilities, supply chain
            risks, policy violations.
          </p>
          <div className="flex items-center justify-center gap-4 text-sm text-brand-muted">
            <a
              href="https://github.com/semiotic-agentium"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center min-h-[44px] px-2 hover:text-brand-teal transition-colors"
            >
              View on GitHub →
            </a>
            <span className="text-brand-border">·</span>
            <a
              href="https://owasp.org/www-project-agentic-skills-top-10/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center min-h-[44px] px-2 hover:text-brand-teal transition-colors"
            >
              OWASP AST10 →
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
