"use client";

import { useEffect, useState } from "react";

type NavLink = {
  href: string;
  label: string;
  icon?: React.ReactNode;
  external?: boolean;
};

const GITHUB_ICON = (
  <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
    <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
  </svg>
);

const NPM_ICON = (
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    fill="currentColor"
    fillRule="evenodd"
    className="w-4 h-4"
  >
    <path d="M1.763 0C.786 0 0 .786 0 1.763v20.474C0 23.214.786 24 1.763 24h20.474c.977 0 1.763-.786 1.763-1.763V1.763C24 .786 23.214 0 22.237 0zM5.13 5.323l13.837.019-.009 13.836h-3.464l.01-10.382h-3.456L12.04 19.17H5.113z" />
  </svg>
);

const NAV_LINKS: readonly NavLink[] = [
  {
    href: "https://github.com/semiotic-agentium",
    label: "GitHub",
    icon: GITHUB_ICON,
    external: true,
  },
  {
    href: "https://www.npmjs.com/package/agentsec",
    label: "npm",
    icon: NPM_ICON,
    external: true,
  },
];

export function Header(): React.ReactNode {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handleScroll = (): void => {
      setIsScrolled(window.scrollY > 10);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mobileOpen]);

  return (
    <header
      className={`fixed top-0 w-full z-50 transition-all duration-300 ${
        isScrolled || mobileOpen
          ? "bg-brand-dark/80 backdrop-blur-md border-b border-brand-border"
          : "bg-transparent"
      }`}
    >
      <nav className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        <div className="text-2xl font-bold">
          <span className="text-brand-teal">AgentSec</span>
        </div>

        <div className="hidden md:flex items-center gap-8 text-sm">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              {...(link.external && { target: "_blank", rel: "noopener noreferrer" })}
              className="inline-flex items-center gap-2 text-brand-muted hover:text-brand-teal transition-colors"
            >
              {link.icon}
              {link.label}
            </a>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setMobileOpen((open) => !open)}
          aria-label="Toggle navigation menu"
          aria-expanded={mobileOpen}
          aria-controls="mobile-menu"
          className="md:hidden inline-flex items-center justify-center w-11 h-11 text-brand-text hover:text-brand-teal focus:outline-none focus:ring-2 focus:ring-brand-teal rounded-md"
        >
          <span aria-hidden="true" className="text-2xl leading-none">
            {mobileOpen ? "✕" : "☰"}
          </span>
        </button>
      </nav>

      {mobileOpen && (
        <div id="mobile-menu" className="md:hidden bg-brand-secondary border-t border-brand-border">
          <ul className="flex flex-col px-6 py-2">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  {...(link.external && { target: "_blank", rel: "noopener noreferrer" })}
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-2 py-3 text-base text-brand-text hover:text-brand-teal transition-colors focus:outline-none focus:ring-2 focus:ring-brand-teal rounded-md"
                >
                  {link.icon}
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </header>
  );
}
