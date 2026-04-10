import type { Metadata, Viewport } from "next";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: "AgentSec — audit every skill your AI agents run",
  description:
    "One command audits every skill your AI agent has installed. Vulnerabilities, supply chain risks, and policy violations — checked against OWASP AST10, automatically.",
  keywords: [
    "agentsec",
    "security",
    "AI agents",
    "AI agent security",
    "OWASP AST10",
    "vulnerability scanning",
    "compliance",
  ],
  authors: [{ name: "AgentSec", url: "https://github.com/semiotic-agentium" }],
  openGraph: {
    title: "AgentSec — audit every skill your AI agents run",
    description:
      "One command audits every skill your AI agent has installed. Vulnerabilities, supply chain risks, and policy violations — checked against OWASP AST10, automatically.",
    url: "https://agentsec.sh",
    siteName: "AgentSec",
    images: [
      {
        url: "https://agentsec.sh/og-image.png",
        width: 1200,
        height: 630,
      },
    ],
    locale: "en_US",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }): React.ReactNode {
  return (
    <html lang="en">
      <body className="bg-brand-dark text-brand-text">{children}</body>
    </html>
  );
}
