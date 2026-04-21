import type { Metadata } from "next";
import Link from "next/link";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { SITE_NAME } from "../_brand/constants";

export const metadata: Metadata = {
  title: "Example outputs",
  description:
    "Sample audit reports (text, JSON, HTML, SARIF), config template, and CI workflow — with CLI commands to regenerate them.",
  alternates: { canonical: "/examples" },
  openGraph: {
    title: `Example outputs | ${SITE_NAME}`,
    description:
      "Browse sample AgentSec audit reports and copy the exact CLI commands used to generate each format.",
    url: "/examples",
  },
};

type FormatKey = "html" | "text" | "json" | "sarif";

type Report = {
  format: FormatKey;
  filename: string;
  tagline: string;
  audience: string;
  href: string;
  cmd: string;
};

const REPORTS: readonly Report[] = [
  {
    format: "text",
    filename: "audit-report.txt",
    tagline: "Plain-text summary, no ANSI codes — diffable and log-friendly.",
    audience: "For CLI, logs & diffs",
    href: "/examples/audit-report.txt",
    cmd: "agentsec audit --path ./e2e/fixtures --format text --output examples/audit-report.txt",
  },
  {
    format: "html",
    filename: "audit-report.html",
    tagline: "Self-contained HTML — shareable, printable, opens in any browser.",
    audience: "For stakeholders & reviewers",
    href: "/examples/audit-report.html",
    cmd: "agentsec audit --path ./e2e/fixtures --format html --output examples/audit-report.html",
  },
  {
    format: "json",
    filename: "audit-report.json",
    tagline: "Full machine-readable audit — skills, findings, scores, metadata.",
    audience: "For CI, tooling & re-rendering",
    href: "/examples/audit-report.json",
    cmd: "agentsec audit --path ./e2e/fixtures --format json --output examples/audit-report.json",
  },
  {
    format: "sarif",
    filename: "audit-report.sarif",
    tagline: "SARIF 2.1 — inline findings in VS Code and GitHub Advanced Security.",
    audience: "For IDEs & code-scanning",
    href: "/examples/audit-report.sarif",
    cmd: "agentsec audit --path ./e2e/fixtures --format sarif --output examples/audit-report.sarif",
  },
];

const FORMAT_META: Record<FormatKey, { tone: string; badge: string }> = {
  html: { tone: "text-brand-blue", badge: "bg-brand-blue/10 border-brand-blue/30" },
  text: { tone: "text-brand-teal", badge: "bg-brand-teal/10 border-brand-teal/30" },
  json: { tone: "text-brand-yellow", badge: "bg-brand-yellow/10 border-brand-yellow/30" },
  sarif: { tone: "text-brand-purple", badge: "bg-brand-purple/10 border-brand-purple/30" },
};

type ArtifactIcon = "readme" | "config" | "workflow";

type Artifact = {
  name: string;
  path: string;
  href: string;
  desc: string;
  note?: string;
  icon: ArtifactIcon;
};

const ARTIFACTS: readonly Artifact[] = [
  {
    name: "README.md",
    path: "examples/README.md",
    href: "/examples/README.md",
    desc: "Overview of every file in this folder and how to regenerate each report.",
    icon: "readme",
  },
  {
    name: "agentsec.yml",
    path: ".github/workflows/agentsec.yml",
    href: "/examples/.github/workflows/agentsec.yml",
    desc: "GitHub Actions workflow running AgentSec on push and pull-request with SARIF upload.",
    icon: "workflow",
  },
  {
    name: "agentsec.config.example.ts",
    path: "examples/agentsec.config.example.ts",
    href: "/examples/agentsec.config.example.ts",
    desc: "Typed policy and scanner configuration template — copy as your entry point.",
    note: "Reference config — not produced by audit.",
    icon: "config",
  },
];

type Flag = {
  flag: string;
  desc: string;
  example: string;
};

const FLAGS: readonly Flag[] = [
  {
    flag: "--path <dir>",
    desc: "Directory or single skill to scan.",
    example: "./e2e/fixtures",
  },
  {
    flag: "-f, --format",
    desc: "Output format — one of text, json, html, sarif.",
    example: "text · json · html · sarif",
  },
  {
    flag: "-o, --output",
    desc: "Write to a file instead of stdout.",
    example: "examples/audit-report.html",
  },
  {
    flag: "report <audit.json>",
    desc: "Re-render a saved JSON audit into any other format.",
    example: "agentsec report audit.json --format html",
  },
];

const ICONS: Record<ArtifactIcon, React.ReactNode> = {
  readme: (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <path d="M14 2v6h6" />
      <path d="M16 13H8M16 17H8M10 9H8" />
    </svg>
  ),
  config: (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  ),
  workflow: (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
      <path d="M6.5 10v4a2 2 0 002 2H10" />
      <path d="M17.5 10v2" />
    </svg>
  ),
};

export default function ExamplesPage(): React.ReactNode {
  return (
    <>
      <a
        href="#examples-main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-brand-teal focus:text-brand-dark focus:rounded-lg focus:font-semibold"
      >
        Skip to main content
      </a>
      <Header />
      <main id="examples-main">
        <ExamplesHero />
        <ReportsSection />
        <FlagsSection />
        <ArtifactsSection />
        <RegenerateCTA />
      </main>
      <Footer />
    </>
  );
}

function ExamplesHero(): React.ReactNode {
  return (
    <section className="relative overflow-hidden pt-[140px] pb-14">
      <div className="bg-grid pointer-events-none absolute inset-0" aria-hidden="true" />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 -translate-x-1/2 -top-52 w-[900px] h-[600px] opacity-40"
        style={{
          background: "radial-gradient(ellipse at center, rgba(0,210,180,0.16), transparent 60%)",
        }}
      />
      <div className="relative max-w-[1200px] mx-auto px-6">
        <nav
          aria-label="Breadcrumb"
          className="mb-6 font-mono text-[13px] text-brand-dim animate-fade-up"
        >
          <Link href="/" className="hover:text-brand-teal transition-colors">
            home
          </Link>
          <span className="mx-2 text-brand-border">/</span>
          <span className="text-brand-text">examples</span>
        </nav>
        <div className="animate-fade-up" style={{ animationDelay: "0.08s" }}>
          <div className="flex items-center flex-wrap gap-3 mb-6">
            <span className="inline-flex items-center gap-2 font-mono text-[11px] font-medium tracking-[0.04em] uppercase px-3 py-1.5 rounded-full border border-brand-teal/25 bg-brand-teal/10 text-brand-teal">
              <span
                className="w-1.5 h-1.5 rounded-full bg-brand-teal animate-pulse-teal"
                aria-hidden="true"
              />
              Example outputs
            </span>
            <span className="text-[13px] text-brand-dim">
              scanned against <span className="font-mono text-brand-text/90">./e2e/fixtures</span>
            </span>
          </div>
          <h1 className="font-display mb-6 text-brand-text">
            One scan.
            <br />
            <span className="bg-gradient-to-b from-brand-teal to-brand-teal-dim bg-clip-text text-transparent">
              Every artifact.
            </span>
          </h1>
          <p className="font-lead max-w-[640px]">
            Pre-generated from the repository&apos;s E2E fixture skills. Open any file to inspect —
            or copy the CLI command to regenerate it against your own project.
          </p>
        </div>
      </div>
    </section>
  );
}

function ReportsSection(): React.ReactNode {
  return (
    <section className="section-pad border-t border-brand-border/60">
      <div className="max-w-[1200px] mx-auto px-6">
        <div className="grid gap-10 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] items-end mb-12">
          <div>
            <div className="font-eyebrow mb-3">Sample reports</div>
            <h2 className="font-h1 text-brand-text">
              Four formats.
              <br />
              One scan.
            </h2>
          </div>
          <p className="font-lead max-w-[520px]">
            Pick the format that fits the audience. All four come from a single{" "}
            <code className="font-mono text-brand-teal text-[14px]">agentsec audit</code> run — or
            re-render any of them from the JSON with{" "}
            <code className="font-mono text-brand-teal text-[14px]">agentsec report</code>.
          </p>
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          {REPORTS.map((r) => (
            <ReportCard key={r.format} {...r} />
          ))}
        </div>
      </div>
    </section>
  );
}

function ReportCard({ format, filename, tagline, audience, href, cmd }: Report): React.ReactNode {
  const meta = FORMAT_META[format];
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative rounded-xl border border-brand-border bg-brand-card p-6 hover:border-brand-border-strong hover:-translate-y-0.5 transition-all duration-200 block no-underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal"
    >
      <div className="flex items-center justify-between gap-3 mb-5">
        <span
          className={`px-2.5 py-1 rounded-md font-mono text-xs border ${meta.badge} ${meta.tone}`}
        >
          --format {format}
        </span>
        <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-brand-dim">
          {audience}
        </span>
      </div>
      <div className="font-mono text-[17px] font-semibold text-brand-text mb-2 tracking-tight group-hover:text-brand-teal transition-colors break-all">
        {filename}
      </div>
      <p className="text-[14px] leading-[1.55] text-brand-muted mb-5">{tagline}</p>
      <div className="bg-brand-dark rounded-lg border border-brand-border/60 px-3.5 py-3 font-mono text-[11.5px] text-brand-muted overflow-x-auto whitespace-pre leading-[1.55]">
        <span className="text-brand-teal">$</span> {cmd}
      </div>
      <div className="mt-4 flex items-center justify-between gap-3">
        <span className="font-mono text-[11px] text-brand-dim truncate">examples/{filename}</span>
        <span className="text-sm text-brand-teal inline-flex items-center gap-1 whitespace-nowrap">
          open <span aria-hidden="true">→</span>
        </span>
      </div>
    </a>
  );
}

function FlagsSection(): React.ReactNode {
  return (
    <section className="section-pad bg-brand-darker border-t border-b border-brand-border/60">
      <div className="max-w-[1200px] mx-auto px-6">
        <div className="text-center mb-12">
          <div className="font-eyebrow mb-3">CLI reference</div>
          <h2 className="font-h1 mb-4 text-brand-text">The flags behind every example.</h2>
          <p className="font-lead max-w-[640px] mx-auto">
            Each sample was generated by composing these four. Swap{" "}
            <code className="font-mono text-brand-teal">--path</code> with your repo and you&apos;ll
            get the same set of artifacts.
          </p>
        </div>
        <div className="max-w-[960px] mx-auto grid gap-4 md:grid-cols-2">
          {FLAGS.map((f) => (
            <div
              key={f.flag}
              className="rounded-xl border border-brand-border bg-brand-card p-5 hover:border-brand-border-strong transition-colors"
            >
              <div className="font-mono text-sm text-brand-teal mb-1.5">{f.flag}</div>
              <div className="text-[15px] text-brand-text mb-2 leading-[1.5]">{f.desc}</div>
              <div className="font-mono text-[12px] text-brand-dim break-all">{f.example}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ArtifactsSection(): React.ReactNode {
  return (
    <section className="section-pad">
      <div className="max-w-[1200px] mx-auto px-6">
        <div className="grid gap-10 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] items-end mb-12">
          <div>
            <div className="font-eyebrow mb-3">Configuration</div>
            <h2 className="font-h1 text-brand-text">More configuration examples.</h2>
          </div>
          <p className="font-lead max-w-[520px]">
            A README describing every artifact, a ready-to-copy CI workflow, and a typed config
            template. Mirrors the repository&apos;s{" "}
            <code className="font-mono text-brand-teal text-[14px]">examples/</code> directory.
          </p>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {ARTIFACTS.map((a) => (
            <ArtifactCard key={a.name} {...a} />
          ))}
        </div>
      </div>
    </section>
  );
}

function ArtifactCard({ name, path, href, desc, note, icon }: Artifact): React.ReactNode {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group rounded-xl border border-brand-border bg-brand-card p-6 hover:border-brand-border-strong hover:-translate-y-0.5 transition-all duration-200 flex flex-col no-underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal"
    >
      <div className="flex items-center gap-3 mb-5">
        <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-brand-secondary border border-brand-border text-brand-teal shrink-0">
          {ICONS[icon]}
        </div>
        <div className="font-mono text-[11px] text-brand-dim truncate">{path}</div>
      </div>
      <div className="font-mono text-[15px] font-semibold text-brand-text mb-2 group-hover:text-brand-teal transition-colors break-all">
        {name}
      </div>
      <p className="text-sm leading-[1.55] text-brand-muted">{desc}</p>
      {note && <p className="text-xs text-brand-dim mt-3 italic">{note}</p>}
      <div className="mt-auto pt-5 text-sm text-brand-teal inline-flex items-center gap-1">
        view file <span aria-hidden="true">→</span>
      </div>
    </a>
  );
}

function RegenerateCTA(): React.ReactNode {
  return (
    <section className="section-pad relative overflow-hidden border-t border-brand-border/60">
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% 50%, rgba(0,210,180,0.1), transparent 60%)",
        }}
      />
      <div className="relative max-w-[880px] mx-auto px-6 text-center">
        <div className="font-eyebrow mb-4">Regenerate</div>
        <h2 className="font-h1 mb-5 text-brand-text">Run it on your own project.</h2>
        <p className="font-lead max-w-[520px] mx-auto mb-8">
          Run <code className="font-mono text-brand-teal">npx agentsec</code> in your project and
          you&apos;ll get the same four artifacts in seconds.
        </p>
        <div className="flex flex-wrap gap-3 justify-center">
          <a
            href="/#install"
            className="inline-flex items-center gap-2 bg-brand-teal text-brand-dark text-sm font-medium px-5 py-3 rounded-lg shadow-brand-teal hover:bg-brand-teal-dim hover:-translate-y-[1px] hover:shadow-brand-teal-strong transition-all duration-200"
          >
            Run AgentSec
          </a>
          <a
            href="/#commandments"
            className="inline-flex items-center gap-2 bg-transparent border border-brand-border text-brand-text text-sm font-medium px-5 py-3 rounded-lg hover:bg-brand-card hover:border-brand-border-strong transition-colors"
          >
            Read the Top 10 →
          </a>
        </div>
      </div>
    </section>
  );
}
