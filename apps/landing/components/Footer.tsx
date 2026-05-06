import { Logo } from "./Logo";

type FooterCol = {
  title: string;
  items: readonly { label: string; href: string; external?: boolean }[];
};

const COLS: readonly FooterCol[] = [
  {
    title: "Product",
    items: [
      { label: "Features", href: "/#formats" },
      { label: "OWASP AST-10", href: "/#commandments" },
      { label: "Policies", href: "/#policy" },
      { label: "Examples", href: "/examples" },
    ],
  },
  {
    title: "Docs",
    items: [
      { label: "Quick start", href: "/#install" },
      { label: "skill.md", href: "/skill.md" },
      { label: "Examples", href: "/examples" },
      {
        label: "GitHub",
        href: "https://github.com/semiotic-ai/agentsec",
        external: true,
      },
    ],
  },
  {
    title: "Platforms",
    items: [
      { label: "OpenClaw", href: "#" },
      { label: "Claude Code", href: "#" },
      { label: "Codex / Cursor", href: "#" },
      { label: "Compare", href: "#" },
    ],
  },
  {
    title: "Company",
    items: [
      { label: "Semiotic Labs", href: "https://semiotic.ai", external: true },
      { label: "Agentium", href: "https://agentium.network", external: true },
      {
        label: "npm",
        href: "https://www.npmjs.com/package/agentsec",
        external: true,
      },
      {
        label: "ClawHub",
        href: "https://clawhub.ai/semiotic-ai/agentsec",
        external: true,
      },
      {
        label: "Contact",
        href: "https://github.com/semiotic-ai/agentsec",
        external: true,
      },
    ],
  },
];

export function Footer(): React.ReactNode {
  return (
    <footer className="bg-brand-darker border-t border-brand-border pt-16 pb-8">
      <div className="max-w-[1200px] mx-auto px-6">
        <div className="grid gap-10 md:grid-cols-[1.4fr_repeat(4,1fr)] mb-14">
          <div>
            <a href="/" className="flex items-center gap-2.5 mb-4 no-underline text-brand-text">
              <span className="text-brand-teal">
                <Logo size={24} />
              </span>
              <span className="font-semibold text-lg">AgentSec</span>
            </a>
            <p className="text-[15px] leading-[1.6] text-brand-muted max-w-[300px] mb-5">
              Security auditing for AI agent skills. Aligned with OWASP AST-10.
            </p>
            <div className="flex gap-2.5">
              <SocialLink
                label="GitHub"
                href="https://github.com/semiotic-ai/agentsec"
                path="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"
              />
              <SocialLink
                label="npm"
                href="https://www.npmjs.com/package/agentsec"
                fillRule="evenodd"
                path="M1.763 0C.786 0 0 .786 0 1.763v20.474C0 23.214.786 24 1.763 24h20.474c.977 0 1.763-.786 1.763-1.763V1.763C24 .786 23.214 0 22.237 0zM5.13 5.323l13.837.019-.009 13.836h-3.464l.01-10.382h-3.456L12.04 19.17H5.113z"
              />
            </div>
          </div>
          {COLS.map((col) => (
            <div key={col.title}>
              <div className="font-eyebrow mb-3.5 text-brand-text">{col.title}</div>
              <ul className="flex flex-col gap-2.5 list-none">
                {col.items.map((it) => (
                  <li key={`${col.title}-${it.label}`}>
                    <a
                      href={it.href}
                      {...(it.external && { target: "_blank", rel: "noopener noreferrer" })}
                      className="text-sm text-brand-muted hover:text-brand-teal transition-colors"
                    >
                      {it.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="pt-6 border-t border-brand-border/60 flex flex-wrap justify-between items-center gap-4">
          <span className="text-[13px] font-mono text-brand-dim">
            © 2026 AgentSec · Built by Semiotic Labs · MIT licensed
          </span>
          <span className="text-[13px] font-mono text-brand-dim">
            v0.2.1 · <span className="text-brand-green">● operational</span>
          </span>
        </div>
      </div>
    </footer>
  );
}

function SocialLink({
  label,
  href,
  path,
  fillRule,
}: {
  label: string;
  href: string;
  path: string;
  fillRule?: "evenodd";
}): React.ReactNode {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-brand-secondary border border-brand-border text-brand-muted hover:text-brand-teal hover:border-brand-teal transition-colors"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        {fillRule ? <path fillRule={fillRule} d={path} /> : <path d={path} />}
      </svg>
      <span className="sr-only">{label}</span>
    </a>
  );
}
