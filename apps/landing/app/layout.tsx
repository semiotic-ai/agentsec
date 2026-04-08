import type { Metadata, Viewport } from "next";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: "Agent Audit - Know What Your AI Agents Run",
  description:
    "One command audits every skill your agent has installed. Security scanning and compliance verification against OWASP Agentic Skills Top 10.",
  keywords: [
    "agent audit",
    "security",
    "AI agents",
    "agent auditing",
    "vulnerability scanning",
    "compliance",
  ],
  authors: [{ name: "Agent Audit", url: "https://github.com/agent-audit/agent-audit" }],
  openGraph: {
    title: "Agent Audit - Know What Your AI Agents Run",
    description:
      "One command audits every skill your agent has installed. Security scanning and compliance verification.",
    url: "https://agent-audit.sh",
    siteName: "Agent Audit",
    images: [
      {
        url: "https://agent-audit.sh/og-image.png",
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
