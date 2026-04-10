import { CopyCommandButton } from "./CopyCommandButton";

export function Hero(): React.ReactNode {
  return (
    <section className="min-h-screen flex items-center justify-center bg-brand-dark pt-24 md:pt-32">
      <div className="max-w-4xl mx-auto px-6 py-20">
        <div className="text-center">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-6 leading-tight">
            Audit every skill <br />
            your <span className="text-brand-teal">AI agents</span> run.
          </h1>
          <p className="text-lg md:text-xl text-brand-muted mb-10 max-w-2xl mx-auto leading-relaxed">
            One command scans every skill your agent has installed — vulnerabilities, supply chain
            risks, policy violations.
          </p>
          <div className="mb-8 flex justify-center">
            <CopyCommandButton command="npx agentsec" size="lg" />
          </div>
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
