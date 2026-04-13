import type { Metadata } from "next";
import Link from "next/link";
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

type TreeFile = {
  name: string;
  href: string;
  description: string;
  /** Primary command(s) shown under the row */
  commands: string[];
  /** Optional short note under commands */
  note?: string;
};

type TreeDir = {
  name: string;
  children: TreeNode[];
};

type TreeNode = TreeFile | TreeDir;

function isDir(n: TreeNode): n is TreeDir {
  return "children" in n;
}

/** Featured report formats: HTML, plain text, JSON (in that order). */
const PRIMARY_REPORTS: TreeNode[] = [
  {
    name: "audit-report.html",
    href: "/examples/audit-report.html",
    description: "Self-contained HTML report for browsers.",
    commands: [
      "agentsec audit --path ./e2e/fixtures --format html --output examples/audit-report.html",
      "agentsec report examples/audit-report.json --format html --output examples/audit-report.html",
    ],
  },
  {
    name: "audit-report.txt",
    href: "/examples/audit-report.txt",
    description: "Plain-text report (no ANSI), suitable for logs and diffs.",
    commands: [
      "agentsec audit --path ./e2e/fixtures --format text --output examples/audit-report.txt",
      "agentsec report examples/audit-report.json --format text --output examples/audit-report.txt",
    ],
  },
  {
    name: "audit-report.json",
    href: "/examples/audit-report.json",
    description: "Full machine-readable audit payload (skills, findings, scores).",
    commands: [
      "agentsec audit --path ./e2e/fixtures --format json --output examples/audit-report.json",
    ],
  },
];

const TREE: TreeNode[] = [
  {
    name: "README.md",
    href: "/examples/README.md",
    description: "Overview of these files and how to regenerate reports.",
    commands: [],
  },
  {
    name: "agentsec.config.example.ts",
    href: "/examples/agentsec.config.example.ts",
    description: "TypeScript policy and scanner configuration template.",
    commands: [
      "# Copy or adapt as agentsec.config.ts / your bundler entry; see file header comments.",
    ],
    note: "Not produced by audit — reference configuration only.",
  },
  {
    name: "audit-report.sarif",
    href: "/examples/audit-report.sarif",
    description: "SARIF 2.1 for VS Code, GitHub, and other SARIF consumers.",
    commands: [
      "agentsec audit --path ./e2e/fixtures --format sarif --output examples/audit-report.sarif",
      "agentsec report examples/audit-report.json --format sarif --output examples/audit-report.sarif",
    ],
  },
  {
    name: ".github",
    children: [
      {
        name: "workflows",
        children: [
          {
            name: "agentsec.yml",
            href: "/examples/.github/workflows/agentsec.yml",
            description: "Example GitHub Actions workflow running AgentSec on push/PR.",
            commands: ["# Uses agentsec in CI; open the file for the exact job steps and flags."],
          },
        ],
      },
    ],
  },
];

function renderTree(nodes: TreeNode[], prefix: string): React.ReactNode {
  return (
    <ul className="space-y-0">
      {nodes.map((node, i) => {
        const isLast = i === nodes.length - 1;
        const branch = isLast ? "└── " : "├── ";
        const childPrefix = prefix + (isLast ? "    " : "│   ");

        if (isDir(node)) {
          return (
            <li key={node.name} className="list-none mb-1">
              <div className="font-mono text-sm text-brand-muted select-none whitespace-pre">
                {prefix}
                {branch}
                {node.name}
                <span className="text-brand-border">/</span>
              </div>
              <div className="mt-0.5">{renderTree(node.children, childPrefix)}</div>
            </li>
          );
        }

        return (
          <li key={node.name} className="list-none mb-6 last:mb-0">
            <div className="font-mono text-sm whitespace-pre-wrap break-words">
              <span className="text-brand-muted select-none">{prefix + branch}</span>
              <a href={node.href} className="text-brand-teal hover:underline">
                {node.name}
              </a>
            </div>
            <p className="mt-1.5 text-sm text-brand-muted pl-0 sm:pl-[2ch]">{node.description}</p>
            {node.commands.length > 0 && (
              <pre className="mt-2 p-3 rounded-lg bg-brand-secondary/80 border border-brand-border text-xs text-brand-text overflow-x-auto whitespace-pre-wrap break-words">
                {node.commands.join("\n\n")}
              </pre>
            )}
            {node.note && <p className="mt-2 text-xs text-brand-muted">{node.note}</p>}
          </li>
        );
      })}
    </ul>
  );
}

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
      <main id="examples-main" className="pt-24 md:pt-28 pb-16 md:pb-24">
        <div className="max-w-3xl mx-auto px-6">
          <p className="text-sm text-brand-muted mb-2">
            <Link href="/" className="text-brand-teal hover:underline">
              Home
            </Link>
            <span className="mx-2 text-brand-border">/</span>
            <span className="text-brand-text">examples</span>
          </p>
          <h1 className="text-3xl md:text-4xl font-bold text-brand-text mb-3">Example outputs</h1>
          <p className="text-brand-muted leading-relaxed mb-8">
            Pre-generated artifacts from scanning the repo&apos;s E2E fixture skills. Open any file
            below; each entry lists the CLI flags and example commands used to produce it.
          </p>

          <section aria-labelledby="primary-heading" className="mb-12">
            <h2 id="primary-heading" className="text-lg font-semibold text-brand-text mb-1">
              Sample reports
            </h2>
            <p className="text-sm text-brand-muted mb-4">
              HTML for browsers, plain text for logs and diffs, JSON for tooling and re-rendering
              other formats.
            </p>
            <div className="font-mono text-sm text-brand-muted mb-2 select-none">examples/</div>
            {renderTree(PRIMARY_REPORTS, "")}
          </section>

          <section
            aria-labelledby="flags-heading"
            className="mb-10 p-4 rounded-lg border border-brand-border bg-brand-secondary/40"
          >
            <h2 id="flags-heading" className="text-sm font-semibold text-brand-text mb-2">
              Common flags
            </h2>
            <dl className="grid gap-2 text-sm text-brand-muted">
              <div>
                <dt className="inline font-mono text-brand-teal">--path</dt>
                <dd className="inline ml-2">
                  Directory or single skill to scan (repo example uses{" "}
                  <span className="font-mono text-brand-text/90">./e2e/fixtures</span>).
                </dd>
              </div>
              <div>
                <dt className="inline font-mono text-brand-teal">-f / --format</dt>
                <dd className="inline ml-2">
                  <span className="font-mono text-brand-text/90">text</span>,{" "}
                  <span className="font-mono text-brand-text/90">json</span>,{" "}
                  <span className="font-mono text-brand-text/90">html</span>,{" "}
                  <span className="font-mono text-brand-text/90">sarif</span>.
                </dd>
              </div>
              <div>
                <dt className="inline font-mono text-brand-teal">-o / --output</dt>
                <dd className="inline ml-2">Write the report to a file instead of only stdout.</dd>
              </div>
              <div>
                <dt className="inline font-mono text-brand-teal">report</dt>
                <dd className="inline ml-2">
                  <span className="font-mono text-brand-text/90">
                    agentsec report &lt;audit.json&gt;
                  </span>{" "}
                  re-renders from a saved JSON audit using{" "}
                  <span className="font-mono text-brand-text/90">--format</span> and{" "}
                  <span className="font-mono text-brand-text/90">--output</span>.
                </dd>
              </div>
            </dl>
            <p className="mt-3 text-xs text-brand-muted">
              From this repository root you can run the same commands with{" "}
              <span className="font-mono text-brand-text/90">bun packages/cli/src/cli.ts</span>{" "}
              instead of <span className="font-mono text-brand-text/90">agentsec</span>.
            </p>
          </section>

          <section aria-labelledby="tree-heading">
            <h2 id="tree-heading" className="text-lg font-semibold text-brand-text mb-1">
              All example files
            </h2>
            <p className="text-sm text-brand-muted mb-4">
              README, config template, SARIF export, and CI workflow — same tree as the repository{" "}
              <span className="font-mono text-brand-text/90">examples/</span> folder.
            </p>
            <div className="font-mono text-sm text-brand-muted mb-2 select-none">examples/</div>
            {renderTree(TREE, "")}
          </section>
        </div>
      </main>
    </>
  );
}
