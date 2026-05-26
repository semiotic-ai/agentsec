import type { Metadata } from "next";
import Link from "next/link";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { getAgentsecVersion } from "@/lib/version";
import { SITE_NAME } from "../_brand/constants";

type Grade = "A" | "B" | "C" | "D" | "F";

type RouterRow = {
  rank: number;
  name: string;
  score: number;
  grade: Grade;
  findings: number;
  source: string | null;
  /** Marks the reference / design partner. */
  reference?: boolean;
};

const ROUTERS: readonly RouterRow[] = [
  {
    rank: 1,
    name: "Odos",
    score: 88,
    grade: "B",
    findings: 4,
    source: "https://github.com/odos-xyz/odos-skills",
    reference: true,
  },
  {
    rank: 2,
    name: "SushiSwap",
    score: 71,
    grade: "C",
    findings: 5,
    source: "https://github.com/sushi-labs/agent-skills",
  },
  {
    rank: 3,
    name: "CowSwap",
    score: 70,
    grade: "C",
    findings: 4,
    source: null,
  },
  {
    rank: 4,
    name: "KyberSwap",
    score: 49,
    grade: "D",
    findings: 29,
    source: "https://github.com/KyberNetwork/kyberswap-skills",
  },
  {
    rank: 4,
    name: "Uniswap",
    score: 49,
    grade: "D",
    findings: 12,
    source: "https://github.com/Uniswap/uniswap-ai",
  },
  {
    rank: 4,
    name: "PancakeSwap",
    score: 49,
    grade: "D",
    findings: 13,
    source: "https://github.com/pancakeswap/pancakeswap-ai",
  },
  {
    rank: 4,
    name: "Across",
    score: 49,
    grade: "D",
    findings: 8,
    source: "https://github.com/across-protocol/skills",
  },
  {
    rank: 4,
    name: "deBridge",
    score: 49,
    grade: "D",
    findings: 9,
    source: "https://github.com/debridge-finance/debridge-skills",
  },
  {
    rank: 9,
    name: "0x",
    score: 48,
    grade: "D",
    findings: 9,
    source: "https://github.com/0xProject/0x-ai",
  },
  {
    rank: 10,
    name: "LI.FI",
    score: 45,
    grade: "D",
    findings: 8,
    source: "https://github.com/lifinance/lifi-agent-skills",
  },
  {
    rank: 11,
    name: "1inch",
    score: 26,
    grade: "F",
    findings: 136,
    source: "https://github.com/Starchild-ai-agent/official-skills",
  },
];

const GRADE_TEXT: Record<Grade, string> = {
  A: "text-brand-teal",
  B: "text-brand-teal",
  C: "text-brand-yellow",
  D: "text-brand-orange",
  F: "text-brand-red",
};

const GRADE_BG: Record<Grade, string> = {
  A: "bg-brand-teal/10 border-brand-teal/30",
  B: "bg-brand-teal/10 border-brand-teal/30",
  C: "bg-brand-yellow/10 border-brand-yellow/30",
  D: "bg-brand-orange/10 border-brand-orange/30",
  F: "bg-brand-red/10 border-brand-red/30",
};

const ANNEX_RULES: readonly { id: string; title: string; what: string }[] = [
  {
    id: "AST-W01",
    title: "Unbounded Signing Authority",
    what: "Skills that sign arbitrary transactions without per-action caps or allowlisted contracts.",
  },
  {
    id: "AST-W02",
    title: "Permit / Permit2 Signature Capture",
    what: "EIP-712 Permit2 payloads signed without verifying the spender against a vetted allowlist.",
  },
  {
    id: "AST-W03",
    title: "Delegation Hijack via EIP-7702",
    what: "SetCodeAuthorizations constructed without delegate allowlists or expiry checks.",
  },
  {
    id: "AST-W04",
    title: "Blind / Opaque Signing Surface",
    what: "Typed data shown to the user that doesn't match what's actually being signed.",
  },
  {
    id: "AST-W05",
    title: "RPC Endpoint Substitution",
    what: "Hardcoded RPC URLs or no protection against unprotected mempool exposure.",
  },
  {
    id: "AST-W06",
    title: "Unverified Contract Call Targets",
    what: "Calldata constructed from model output without bytecode-hash or address pinning.",
  },
  {
    id: "AST-W07",
    title: "Cross-Chain / Bridge Action Replay",
    what: "Bridge calls without idempotency keys or destination allowlists.",
  },
  {
    id: "AST-W08",
    title: "MCP Chain-Tool Drift",
    what: "Pinned MCP servers without hash verification or tool-schema diffing on update.",
  },
  {
    id: "AST-W09",
    title: "Session-Key Caveat Erosion",
    what: "ERC-7715 session keys missing expiry, valueLimit, or target restrictions.",
  },
  {
    id: "AST-W10",
    title: "Slippage / Oracle Manipulation",
    what: "Swap or oracle queries without TWAP, deadline ceiling, or slippage caps.",
  },
  {
    id: "AST-W11",
    title: "Key Material in Agent Memory",
    what: "Hex-format private keys or mnemonics flowing into log sinks or tool outputs.",
  },
  {
    id: "AST-W12",
    title: "No On-Chain Action Audit / Kill-Switch",
    what: "No declared audit sink or kill-switch contract for incident response.",
  },
];

export const metadata: Metadata = {
  title: "Web3 Router Audit",
  description:
    "AgentSec audited 11 production DEX router agent skills against the AST-10 Web3 Annex. Compare scores, grades, and findings across Odos, Uniswap, 1inch, 0x, KyberSwap, SushiSwap, LI.FI, Across, PancakeSwap, CowSwap, and deBridge.",
  alternates: { canonical: "/web3-routers" },
  openGraph: {
    title: `Web3 Router Audit | ${SITE_NAME}`,
    description:
      "11 production DEX router agent skills, audited under the AST-10 Web3 Annex. Scoreboard, full matrix, and the methodology behind the scores.",
    url: "/web3-routers",
  },
};

export default async function Web3RoutersPage(): Promise<React.ReactNode> {
  const version = await getAgentsecVersion();
  const avgScore = Math.round(ROUTERS.reduce((a, r) => a + r.score, 0) / ROUTERS.length);
  const totalFindings = ROUTERS.reduce((a, r) => a + r.findings, 0);
  const gradeCount = ROUTERS.reduce<Record<Grade, number>>(
    (acc, r) => ({ ...acc, [r.grade]: (acc[r.grade] ?? 0) + 1 }),
    { A: 0, B: 0, C: 0, D: 0, F: 0 },
  );

  return (
    <>
      <a
        href="#web3-routers-main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-brand-teal focus:text-brand-dark focus:rounded-lg focus:font-semibold"
      >
        Skip to main content
      </a>
      <Header version={version} />
      <main id="web3-routers-main">
        <Hero />
        <StatsSection
          avgScore={avgScore}
          totalFindings={totalFindings}
          gradeCount={gradeCount}
        />
        <ScoreboardSection />
        <AnnexSection />
        <CTASection />
      </main>
      <Footer />
    </>
  );
}

function Hero(): React.ReactNode {
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
          <span className="text-brand-text">web3-routers</span>
        </nav>
        <div className="animate-fade-up" style={{ animationDelay: "0.08s" }}>
          <div className="flex items-center flex-wrap gap-3 mb-6">
            <span className="inline-flex items-center gap-2 font-mono text-[11px] font-medium tracking-[0.04em] uppercase px-3 py-1.5 rounded-full border border-brand-teal/25 bg-brand-teal/10 text-brand-teal">
              Case study · AST-10 Web3 Annex
            </span>
            <span className="text-[13px] text-brand-dim">
              <span className="font-mono text-brand-text/90">11</span> production router skills{" "}
              <span className="mx-2 text-brand-border">·</span>generated{" "}
              <span className="font-mono text-brand-text/90">2026-05-26</span>
            </span>
          </div>
          <h1 className="font-display mb-6 text-brand-text">
            Every DEX router skill,
            <br />
            <span className="bg-gradient-to-b from-brand-teal to-brand-teal-dim bg-clip-text text-transparent">
              audited under the annex.
            </span>
          </h1>
          <p className="font-lead max-w-[680px]">
            We extended OWASP AST10 with{" "}
            <span className="text-brand-text font-medium">12 chain-specific rules</span> — signing
            authority, Permit2 capture, blind signing, RPC pinning, kill-switch, MCP drift, oracle
            manipulation, key material leaks — and ran them against every public DEX router agent
            skill we could find. Same audit, same coverage, side by side.
          </p>
        </div>
      </div>
    </section>
  );
}

function StatsSection({
  avgScore,
  totalFindings,
  gradeCount,
}: {
  avgScore: number;
  totalFindings: number;
  gradeCount: Record<Grade, number>;
}): React.ReactNode {
  const stats: { label: string; value: string; tone?: "teal" | "red" | "green"; sub?: string }[] = [
    {
      label: "Reference skill",
      value: "Odos",
      tone: "teal",
      sub: "v1.0.0 · 88 / B",
    },
    {
      label: "Avg. score",
      value: `${avgScore}`,
      sub: "across 11 skills",
    },
    {
      label: "Total findings",
      value: `${totalFindings}`,
      tone: "red",
      sub: "all severities combined",
    },
    {
      label: "Failing (D or F)",
      value: `${gradeCount.D + gradeCount.F}`,
      tone: "red",
      sub: `${gradeCount.D} D · ${gradeCount.F} F`,
    },
    {
      label: "Passing (A–C)",
      value: `${gradeCount.A + gradeCount.B + gradeCount.C}`,
      tone: "green",
      sub: `${gradeCount.B} B · ${gradeCount.C} C`,
    },
    {
      label: "Annex rules",
      value: "12",
      sub: "AST-W01 → AST-W12",
    },
  ];

  return (
    <section className="section-pad border-t border-brand-border/60">
      <div className="max-w-[1200px] mx-auto px-6">
        <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
          {stats.map((s) => (
            <StatCard key={s.label} {...s} />
          ))}
        </div>
      </div>
    </section>
  );
}

function StatCard({
  label,
  value,
  tone,
  sub,
}: {
  label: string;
  value: string;
  tone?: "teal" | "red" | "green";
  sub?: string;
}): React.ReactNode {
  const valueClass =
    tone === "teal"
      ? "text-brand-teal"
      : tone === "red"
        ? "text-brand-red"
        : tone === "green"
          ? "text-brand-green"
          : "text-brand-text";
  return (
    <div className="rounded-xl border border-brand-border bg-brand-card p-5">
      <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-brand-dim mb-2">
        {label}
      </div>
      <div className={`text-[24px] leading-none font-semibold tabular-nums ${valueClass}`}>
        {value}
      </div>
      {sub && <div className="mt-2 text-[12px] text-brand-muted">{sub}</div>}
    </div>
  );
}

function ScoreboardSection(): React.ReactNode {
  return (
    <section
      id="scoreboard"
      className="section-pad bg-brand-darker border-t border-b border-brand-border/60 scroll-mt-24"
    >
      <div className="max-w-[1200px] mx-auto px-6">
        <div className="grid gap-10 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] items-end mb-12">
          <div>
            <div className="font-eyebrow mb-3">The scoreboard</div>
            <h2 className="font-h1 text-brand-text">
              11 skills,
              <br />
              ranked.
            </h2>
          </div>
          <p className="font-lead max-w-[520px]">
            Every public DEX router agent skill we could find, audited with{" "}
            <code className="font-mono text-brand-teal text-[14px]">--profile web3</code> forced on
            so coverage is identical across rows. Click through to each upstream repository on
            GitHub.
          </p>
        </div>

        <div className="rounded-[14px] bg-brand-card border border-brand-border overflow-hidden">
          <div className="flex items-center justify-between gap-4 px-5 py-3 border-b border-brand-border bg-brand-secondary">
            <div className="font-mono text-[11px] uppercase tracking-[0.08em] text-brand-dim">
              bun run compare:web3
            </div>
            <div className="font-mono text-[11px] text-brand-dim">2026-05-26</div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left font-mono text-[11px] uppercase tracking-[0.05em] text-brand-dim border-b border-brand-border">
                  <th className="px-5 py-3 font-normal">#</th>
                  <th className="px-3 py-3 font-normal">Skill</th>
                  <th className="px-3 py-3 font-normal text-right">Score</th>
                  <th className="px-3 py-3 font-normal text-center">Grade</th>
                  <th className="px-3 py-3 font-normal text-right">Findings</th>
                  <th className="px-5 py-3 font-normal text-right">Source</th>
                </tr>
              </thead>
              <tbody>
                {ROUTERS.map((r) => (
                  <tr
                    key={r.name}
                    className={`border-b border-brand-border/40 last:border-b-0 ${
                      r.reference ? "bg-brand-teal/[0.04]" : "hover:bg-brand-secondary/50"
                    } transition-colors`}
                  >
                    <td className="px-5 py-3 font-mono text-xs text-brand-dim">{r.rank}</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-brand-text font-medium">{r.name}</span>
                        {r.reference && (
                          <span className="font-mono text-[10px] tracking-[0.06em] uppercase px-1.5 py-0.5 rounded border border-brand-teal/40 bg-brand-teal/10 text-brand-teal">
                            reference
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-brand-text">{r.score}</td>
                    <td className="px-3 py-3 text-center">
                      <span
                        className={`inline-flex items-center justify-center w-7 h-7 rounded-md border font-mono text-xs font-semibold ${GRADE_BG[r.grade]} ${GRADE_TEXT[r.grade]}`}
                      >
                        {r.grade}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-xs text-brand-dim">
                      {r.findings}
                    </td>
                    <td className="px-5 py-3 text-right">
                      {r.source ? (
                        <a
                          href={r.source}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono text-xs text-brand-muted hover:text-brand-teal transition-colors"
                        >
                          github →
                        </a>
                      ) : (
                        <span className="font-mono text-xs text-brand-dim">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3 border-t border-brand-border bg-brand-secondary/50 flex items-center justify-between gap-4 flex-wrap">
            <span className="font-mono text-[11px] text-brand-dim">
              Audited under <code className="text-brand-teal">--profile web3</code>
            </span>
            <a
              href="/examples/web3-routers/report.html"
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-xs text-brand-teal hover:underline"
            >
              View full rule matrix →
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

function AnnexSection(): React.ReactNode {
  return (
    <section className="section-pad">
      <div className="max-w-[1200px] mx-auto px-6">
        <div className="grid gap-10 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] items-end mb-12">
          <div>
            <div className="font-eyebrow mb-3">The methodology</div>
            <h2 className="font-h1 text-brand-text">
              12 chain-specific
              <br />
              rules.
            </h2>
          </div>
          <p className="font-lead max-w-[520px]">
            The base OWASP AST10 covers generic skill risks — prompt injection, supply chain,
            over-privilege. The Web3 Annex extends it with rules that apply to any skill that holds
            keys, signs typed data, calls smart contracts, bridges assets, or exposes chain
            capabilities through MCP.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {ANNEX_RULES.map((rule) => (
            <div
              key={rule.id}
              className="rounded-[10px] border border-brand-border bg-brand-card p-5 hover:border-brand-border-strong transition-colors"
            >
              <div className="flex items-start gap-3 mb-2">
                <span className="font-mono text-[11px] text-brand-teal whitespace-nowrap mt-[3px]">
                  {rule.id}
                </span>
                <h3 className="text-[15px] font-medium text-brand-text leading-tight">
                  {rule.title}
                </h3>
              </div>
              <p className="text-[13px] text-brand-muted leading-[1.55] pl-[68px]">{rule.what}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CTASection(): React.ReactNode {
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
        <div className="font-eyebrow mb-4">Run it yourself</div>
        <h2 className="font-h1 mb-5 text-brand-text">Audit your skill in 5 seconds.</h2>
        <p className="font-lead max-w-[560px] mx-auto mb-8">
          The same command we ran on every router above — auto-detects web3 skills and applies the
          annex on top of OWASP AST10. JSON, HTML, and SARIF outputs ship out of the box.
        </p>
        <div className="font-mono text-[15px] bg-brand-dark border border-brand-border rounded-md px-5 py-4 mb-8 inline-block text-brand-text">
          <span className="text-brand-dim">$ </span>npx agentsec
        </div>
        <div className="flex flex-wrap gap-3 justify-center">
          <a
            href="/#enterprise"
            className="inline-flex items-center gap-2 bg-brand-teal text-brand-dark text-sm font-medium px-5 py-3 rounded-lg shadow-brand-teal hover:bg-brand-teal-dim hover:-translate-y-[1px] hover:shadow-brand-teal-strong transition-all duration-200"
          >
            Get in touch
          </a>
          <a
            href="/examples/web3-routers/report.html"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-transparent border border-brand-border text-brand-text text-sm font-medium px-5 py-3 rounded-lg hover:bg-brand-card hover:border-brand-border-strong transition-colors"
          >
            View full matrix →
          </a>
        </div>
      </div>
    </section>
  );
}
