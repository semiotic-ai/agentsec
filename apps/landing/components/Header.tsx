"use client";

import { useEffect, useState } from "react";

export function Header(): React.ReactNode {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = (): void => {
      setIsScrolled(window.scrollY > 10);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 w-full z-50 transition-all duration-300 ${
        isScrolled
          ? "bg-brand-dark/80 backdrop-blur-md border-b border-brand-border"
          : "bg-transparent"
      }`}
    >
      <nav className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        {/* Logo */}
        <div className="text-2xl font-bold">
          <span className="text-brand-teal">Agent</span>
          <span className="text-brand-text">Audit</span>
        </div>

        {/* Nav links */}
        <div className="hidden md:flex items-center gap-8 text-sm">
          <a href="#" className="text-brand-muted hover:text-brand-teal transition-colors">
            How It Works
          </a>
          <a href="#" className="text-brand-muted hover:text-brand-teal transition-colors">
            Security
          </a>
          <a href="https://github.com/agent-audit/agent-audit" target="_blank" rel="noopener noreferrer" className="text-brand-muted hover:text-brand-teal transition-colors">
            GitHub
          </a>
        </div>

        {/* CTA Button */}
        <a
          href="https://github.com/agent-audit/agent-audit"
          target="_blank"
          rel="noopener noreferrer"
          className="btn-secondary text-sm px-6 py-2 font-semibold"
        >
          Get Started
        </a>
      </nav>
    </header>
  );
}
