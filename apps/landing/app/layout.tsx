import type { Metadata, Viewport } from "next";
import { DEPLOYMENT_URL } from "vercel-url";
import {
  BRAND_COLORS,
  GITHUB_URL,
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_TITLE,
  SITE_TWITTER,
} from "./_brand/constants";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: BRAND_COLORS.dark,
};

export const metadata: Metadata = {
  metadataBase: new URL(DEPLOYMENT_URL),
  title: {
    default: SITE_TITLE,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  generator: "Next.js",
  referrer: "origin-when-cross-origin",
  keywords: [
    "agentsec",
    "agent audit",
    "AI agent security",
    "AI security scanner",
    "skill scanner",
    "OWASP AST10",
    "OWASP Agentic Skills Top 10",
    "supply chain security",
    "vulnerability scanning",
    "LLM security",
    "prompt injection",
    "AI compliance",
    "OpenClaw",
  ],
  authors: [{ name: SITE_NAME, url: GITHUB_URL }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  category: "security",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/",
    siteName: SITE_NAME,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    creator: SITE_TWITTER,
    site: SITE_TWITTER,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }): React.ReactNode {
  return (
    <html lang="en">
      <body className="bg-brand-dark text-brand-text">{children}</body>
    </html>
  );
}
