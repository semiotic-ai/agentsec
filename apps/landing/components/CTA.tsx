export function CTA(): React.ReactNode {
  return (
    <footer className="bg-brand-dark border-t border-brand-border py-12 md:py-16">
      <div className="max-w-4xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="text-center md:text-left">
          <div className="text-lg font-bold text-brand-teal mb-1">AgentSec</div>
        </div>
        <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm md:text-md">
          <a
            href="https://semiotic.ai"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center min-h-[44px] px-2 text-brand-muted hover:text-brand-teal transition-colors"
          >
            SEMIOTIC LABS
          </a>
          <a
            href="https://agentium.network"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center min-h-[44px] px-2 text-brand-muted hover:text-brand-teal transition-colors"
          >
            AGENTIUM
          </a>
        </nav>
      </div>
    </footer>
  );
}
