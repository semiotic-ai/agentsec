"use client";

import { useEffect, useState } from "react";

type NavLink = {
  href: string;
  label: string;
  external?: boolean;
};

const NAV_LINKS: readonly NavLink[] = [
  { href: "#cli", label: "CLI Examples" },
  {
    href: "https://github.com/semiotic-agentium",
    label: "GitHub",
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
              className="text-brand-muted hover:text-brand-teal transition-colors"
            >
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
                  className="block py-3 text-base text-brand-text hover:text-brand-teal transition-colors focus:outline-none focus:ring-2 focus:ring-brand-teal rounded-md"
                >
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
