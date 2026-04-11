/**
 * Single source of truth for brand constants used across
 * App Router metadata files and ImageResponse endpoints.
 *
 * ImageResponse (satori) cannot consume Tailwind classes or CSS
 * variables, so hex colors are mirrored here from tailwind.config.ts.
 */
export const BRAND_COLORS = {
  dark: "#0d1117",
  secondary: "#161b22",
  teal: "#00d2b4",
  text: "#e6edf3",
  muted: "#8b949e",
} as const;

export const SITE_NAME = "AgentSec";
export const SITE_TITLE = "AgentSec — audit every skill your AI agents run";
export const SITE_DESCRIPTION =
  "One command audits every skill your AI agent has installed. Vulnerabilities, supply chain risks, and policy violations — checked against OWASP AST10, automatically.";
export const SITE_TWITTER = "@semiotic_agentium";
export const GITHUB_URL = "https://github.com/semiotic-agentium";
