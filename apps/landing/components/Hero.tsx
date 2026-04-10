import { CopyCommandButton } from "./CopyCommandButton";

export function Hero(): React.ReactNode {
  return (
    <section className="min-h-screen flex items-center justify-center bg-brand-dark relative overflow-hidden pt-20">
      {/* Animated background grid */}
      <div className="absolute inset-0 dot-pattern opacity-20" />

      {/* Gradient orbs for visual interest */}
      <div className="absolute -top-40 -right-40 w-80 h-80 bg-brand-teal rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-pulse" />
      <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-brand-blue rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-pulse" />

      <div className="relative z-10 max-w-5xl mx-auto px-6 py-20">
        <div className="text-center">
          {/* Main headline */}
          <h1 className="text-4xl sm:text-5xl md:text-7xl font-bold mb-6 leading-tight">
            Audit every skill <br />
            your <span className="text-brand-teal">AI agents</span> run.
          </h1>

          {/* Subtitle */}
          <p className="text-xl md:text-2xl text-brand-muted mb-12 max-w-3xl mx-auto leading-relaxed">
            One command scans every skill your agent has installed. Security vulnerabilities, supply
            chain risks, and policy violations — automatically.
          </p>

          {/* Primary CTA */}
          <div className="mb-8 flex justify-center">
            <CopyCommandButton command="npx agentsec" size="lg" />
          </div>

          {/* Secondary links */}
          <div className="mb-16 flex items-center justify-center gap-4 text-sm text-brand-muted">
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

          {/* Decorative terminal demo block */}
          <div className="mb-12 flex justify-center">
            <div className="w-full max-w-xl bg-brand-secondary border border-brand-border rounded-lg p-5 overflow-x-auto terminal-block">
              <div className="flex items-center mb-4">
                <div className="flex space-x-2">
                  <div className="w-3 h-3 rounded-full bg-brand-red" />
                  <div className="w-3 h-3 rounded-full bg-brand-yellow" />
                  <div className="w-3 h-3 rounded-full bg-brand-green" />
                </div>
              </div>
              <div className="font-mono text-base">
                <span className="text-brand-muted">$ </span>
                <span className="text-brand-blue">npx agentsec</span>
                <div className="mt-4 text-brand-muted text-sm">
                  <div>Discovering installed skills...</div>
                  <div className="mt-2 text-brand-green">Found 12 skills across 3 agents</div>
                  <div className="mt-3 text-brand-text">
                    <div>
                      <span className="text-brand-red">CRITICAL</span> eval() injection in
                      fetch-data/src/index.ts:14
                    </div>
                    <div>
                      <span className="text-brand-yellow">HIGH</span> Unpinned dependency in
                      deploy-helper
                    </div>
                    <div>
                      <span className="text-brand-green">PASS</span> code-review -- all checks
                      passed
                    </div>
                  </div>
                  <div className="mt-3 text-brand-teal">
                    12 skills | 1 critical | 1 high | 10 passed
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="pt-12 border-t border-brand-border flex flex-col md:flex-row justify-center items-center gap-8 text-brand-muted text-sm">
            <div className="flex items-center gap-2">
              <span className="text-brand-teal text-lg">10</span>
              <span>OWASP Risk Categories</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-brand-teal text-lg">119</span>
              <span>Vulnerability Patterns</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-brand-teal text-lg">4</span>
              <span>Output Formats</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
