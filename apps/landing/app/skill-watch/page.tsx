import type { Metadata } from "next";
import Link from "next/link";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { SITE_NAME } from "../_brand/constants";
import { OwaspBars } from "./OwaspBars";
import { SkillWatchTable } from "./SkillWatchTable";
import type { SkillWatchEntity } from "./types";

const DATA_URL = "https://frames.ag/api/datasets/v1/microchipgnu/skill-watch/entities?limit=500";
const DATASET_URL = "https://skill-watch.data.frames.ag";
const FRAMES_LOGO_SRC = "/assets/frames-logo.svg";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Skill Watch",
  description:
    "Live security audits for popular AI agent skills — scored against OWASP AST-10, refreshed regularly. Browse scores, findings, and trends from the skill-watch dataset.",
  alternates: { canonical: "/skill-watch" },
  openGraph: {
    title: `Skill Watch | ${SITE_NAME}`,
    description:
      "Live AgentSec audits for popular AI agent skills, refreshed regularly. Track scores, findings, and trends.",
    url: "/skill-watch",
  },
};

type ApiResponse = {
  data?: SkillWatchEntity[];
  entities?: SkillWatchEntity[];
};

async function fetchSkillWatch(): Promise<SkillWatchEntity[]> {
  try {
    const res = await fetch(DATA_URL, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    const json = (await res.json()) as ApiResponse;
    const items = json.data ?? json.entities ?? [];
    return items.filter((e) => e?.fields && typeof e.fields === "object");
  } catch {
    return [];
  }
}

type Aggregates = {
  total: number;
  withFindings: number;
  cleanCount: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  totalFindings: number;
  avgScore: number;
  avgSecurity: number;
  totalInstalls: number;
  web3Count: number;
  mostRecentScan: string | null;
  gradeDistribution: Record<string, number>;
  owaspDistribution: { id: string; count: number }[];
};

function aggregate(skills: SkillWatchEntity[]): Aggregates {
  const grades: Record<string, number> = {};
  const owasp: Record<string, number> = {};
  let critical = 0;
  let high = 0;
  let medium = 0;
  let low = 0;
  let scoreSum = 0;
  let securitySum = 0;
  let installs = 0;
  let web3 = 0;
  let withFindings = 0;
  let mostRecent = 0;

  for (const e of skills) {
    const f = e.fields;
    const letter = f.grade?.charAt(0).toUpperCase() || "?";
    grades[letter] = (grades[letter] ?? 0) + 1;
    critical += f.findings_critical;
    high += f.findings_high;
    medium += f.findings_medium;
    low += f.findings_low;
    scoreSum += f.score_overall;
    securitySum += f.score_security;
    installs += f.install_count;
    if (f.is_web3) web3 += 1;
    if (f.has_vulnerabilities) withFindings += 1;
    if (f.top_finding_owasp && (f.findings_critical || f.findings_high || f.findings_medium)) {
      owasp[f.top_finding_owasp] = (owasp[f.top_finding_owasp] ?? 0) + 1;
    }
    const ts = Date.parse(f.last_scanned_at);
    if (!Number.isNaN(ts) && ts > mostRecent) mostRecent = ts;
  }

  const total = skills.length;
  const totalFindings = critical + high + medium + low;
  const owaspDistribution = Object.entries(owasp)
    .map(([id, count]) => ({ id, count }))
    .sort((a, b) => b.count - a.count);

  return {
    total,
    withFindings,
    cleanCount: total - withFindings,
    critical,
    high,
    medium,
    low,
    totalFindings,
    avgScore: total ? Math.round(scoreSum / total) : 0,
    avgSecurity: total ? Math.round(securitySum / total) : 0,
    totalInstalls: installs,
    web3Count: web3,
    mostRecentScan: mostRecent ? new Date(mostRecent).toISOString() : null,
    gradeDistribution: grades,
    owaspDistribution,
  };
}

const NUMBER_FORMAT = new Intl.NumberFormat("en-US");

function formatTimestamp(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  });
}

function slimEntity(e: SkillWatchEntity): SkillWatchEntity {
  // Drop the heavy `evidence` block before serializing the prop to the
  // client — the table only needs `fields`, and the per-field evidence
  // (urls + excerpts on every record) inflates the embedded HTML payload
  // by ~10x and stalls hydration on slow connections.
  return { entity_id: e.entity_id, fields: e.fields };
}

export default async function SkillWatchPage(): Promise<React.ReactNode> {
  const skills = await fetchSkillWatch();
  const agg = aggregate(skills);
  const slimSkills = skills.map(slimEntity);

  return (
    <>
      <a
        href="#skill-watch-main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-brand-teal focus:text-brand-dark focus:rounded-lg focus:font-semibold"
      >
        Skip to main content
      </a>
      <Header />
      <main id="skill-watch-main">
        <SkillWatchHero count={agg.total} lastScan={agg.mostRecentScan} />
        {skills.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            <StatsSection agg={agg} />
            <OwaspSection agg={agg} />
            <TableSection skills={slimSkills} />
          </>
        )}
        <SourceCTA />
      </main>
      <Footer />
    </>
  );
}

function SkillWatchHero({
  count,
  lastScan,
}: {
  count: number;
  lastScan: string | null;
}): React.ReactNode {
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
          <span className="text-brand-text">skill-watch</span>
        </nav>
        <div className="animate-fade-up" style={{ animationDelay: "0.08s" }}>
          <div className="flex items-center flex-wrap gap-3 mb-6">
            <span className="inline-flex items-center gap-2 font-mono text-[11px] font-medium tracking-[0.04em] uppercase px-3 py-1.5 rounded-full border border-brand-teal/25 bg-brand-teal/10 text-brand-teal">
              <span
                className="w-1.5 h-1.5 rounded-full bg-brand-teal animate-pulse-teal"
                aria-hidden="true"
              />
              Live · refreshed hourly
            </span>
            <span className="text-[13px] text-brand-dim">
              {count > 0 ? (
                <>
                  <span className="font-mono text-brand-text/90">
                    {NUMBER_FORMAT.format(count)}
                  </span>{" "}
                  skills monitored
                  {lastScan && (
                    <>
                      <span className="mx-2 text-brand-border">·</span>last scan{" "}
                      <span className="font-mono text-brand-text/90">
                        {formatTimestamp(lastScan)}
                      </span>
                    </>
                  )}
                </>
              ) : (
                "Awaiting dataset"
              )}
            </span>
          </div>
          <h1 className="font-display mb-6 text-brand-text">
            Skill Watch.
            <br />
            <span className="bg-gradient-to-b from-brand-teal to-brand-teal-dim bg-clip-text text-transparent">
              Audits in the wild.
            </span>
          </h1>
          <p className="font-lead max-w-[680px]">
            Live AgentSec audits of agent skills across the public ecosystem — scored against OWASP
            AST-10, ranked by trend, and ready to inspect. Pulled from the{" "}
            <a
              href={DATASET_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-brand-teal hover:opacity-80 transition-opacity align-middle"
            >
              <span className="font-mono">skill-watch</span>
              <span className="text-brand-muted">on</span>
              {/* biome-ignore lint/performance/noImgElement: small inline brand mark, not a hero image */}
              <img src={FRAMES_LOGO_SRC} alt="Frames" className="h-[1.1em] w-auto inline-block" />
            </a>
            .
          </p>
        </div>
      </div>
    </section>
  );
}

function StatsSection({ agg }: { agg: Aggregates }): React.ReactNode {
  const stats: { label: string; value: string; tone?: "teal" | "red" | "green"; sub?: string }[] = [
    {
      label: "Skills monitored",
      value: NUMBER_FORMAT.format(agg.total),
      tone: "teal",
    },
    {
      label: "With findings",
      value: NUMBER_FORMAT.format(agg.withFindings),
      tone: "red",
      sub: `${agg.total ? Math.round((agg.withFindings / agg.total) * 100) : 0}% of inventory`,
    },
    {
      label: "Clean skills",
      value: NUMBER_FORMAT.format(agg.cleanCount),
      tone: "green",
      sub: "no vulnerabilities flagged",
    },
    {
      label: "Avg. overall score",
      value: `${agg.avgScore}`,
      sub: "out of 100",
    },
    {
      label: "Avg. security score",
      value: `${agg.avgSecurity}`,
      sub: "out of 100",
    },
    {
      label: "Total installs",
      value: NUMBER_FORMAT.format(agg.totalInstalls),
      sub: "across monitored skills",
    },
  ];

  return (
    <section className="section-pad border-t border-brand-border/60">
      <div className="max-w-[1200px] mx-auto px-6">
        <div className="grid gap-10 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] items-end mb-12">
          <div>
            <div className="font-eyebrow mb-3">Snapshot</div>
            <h2 className="font-h1 text-brand-text">
              The state of
              <br />
              the skill shelf.
            </h2>
          </div>
          <p className="font-lead max-w-[520px]">
            Each row in the dataset is a real skill scanned by AgentSec. These stats roll up the
            current cohort — the share of skills carrying open findings, the average security score,
            and where the risk concentrates.
          </p>
        </div>

        <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-6 mb-10">
          {stats.map((s) => (
            <StatCard key={s.label} {...s} />
          ))}
        </div>

        <div className="grid gap-4 md:grid-cols-[1.2fr_1fr]">
          <SeverityBreakdown agg={agg} />
          <GradeDistribution agg={agg} />
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
      <div className={`text-[28px] leading-none font-semibold tabular-nums ${valueClass}`}>
        {value}
      </div>
      {sub && <div className="mt-2 text-[12px] text-brand-muted">{sub}</div>}
    </div>
  );
}

function SeverityBreakdown({ agg }: { agg: Aggregates }): React.ReactNode {
  const rows = [
    { label: "Critical", count: agg.critical, color: "bg-brand-red", text: "text-brand-red" },
    { label: "High", count: agg.high, color: "bg-brand-orange", text: "text-brand-orange" },
    { label: "Medium", count: agg.medium, color: "bg-brand-yellow", text: "text-brand-yellow" },
    { label: "Low", count: agg.low, color: "bg-brand-blue", text: "text-brand-blue" },
  ];
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <div className="rounded-xl border border-brand-border bg-brand-card p-6">
      <div className="flex items-baseline justify-between mb-5">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-brand-dim mb-1">
            Findings by severity
          </div>
          <h3 className="font-h2 text-brand-text">
            {NUMBER_FORMAT.format(agg.totalFindings)}{" "}
            <span className="text-brand-dim text-base font-mono">total</span>
          </h3>
        </div>
      </div>
      <div className="flex flex-col gap-3">
        {rows.map((row) => (
          <div key={row.label}>
            <div className="flex items-baseline justify-between gap-3 mb-1">
              <span className={`font-mono text-xs ${row.text}`}>{row.label}</span>
              <span className="font-mono text-xs text-brand-muted tabular-nums">
                {NUMBER_FORMAT.format(row.count)}
              </span>
            </div>
            <div className="h-2 w-full bg-brand-dark rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${row.color}`}
                style={{ width: `${(row.count / max) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function GradeDistribution({ agg }: { agg: Aggregates }): React.ReactNode {
  const order = ["A", "B", "C", "D", "F"] as const;
  const max = Math.max(1, ...order.map((g) => agg.gradeDistribution[g] ?? 0));
  const dominant = order.reduce(
    (best, g) => ((agg.gradeDistribution[g] ?? 0) > (agg.gradeDistribution[best] ?? 0) ? g : best),
    "A" as (typeof order)[number],
  );
  const dominantCount = agg.gradeDistribution[dominant] ?? 0;
  const failing = (agg.gradeDistribution.D ?? 0) + (agg.gradeDistribution.F ?? 0);
  return (
    <div className="rounded-xl border border-brand-border bg-brand-card p-6">
      <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-brand-dim mb-1">
        Grade distribution
      </div>
      <h3 className="font-h2 text-brand-text mb-1">
        Mostly{" "}
        <span className="font-mono">
          {dominant}
          <span className="text-brand-dim text-base"> · {dominantCount}</span>
        </span>
      </h3>
      <div className="text-[12px] text-brand-muted mb-5">
        {failing} failing (D or F)
        {failing === 0 ? "" : ` · ${Math.round((failing / agg.total) * 100)}% of cohort`}
      </div>
      <div className="grid grid-cols-5 gap-3 items-end h-[140px]">
        {order.map((letter) => {
          const count = agg.gradeDistribution[letter] ?? 0;
          const heightPct = (count / max) * 100;
          const color =
            letter === "A" || letter === "B"
              ? "bg-brand-green"
              : letter === "C"
                ? "bg-brand-yellow"
                : letter === "D"
                  ? "bg-brand-orange"
                  : "bg-brand-red";
          return (
            <div key={letter} className="flex flex-col items-center gap-2 h-full">
              <div className="font-mono text-[12px] text-brand-muted tabular-nums">{count}</div>
              <div className="w-full flex-1 flex items-end">
                <div
                  className={`w-full rounded-md ${color}`}
                  style={{ height: `${Math.max(4, heightPct)}%`, opacity: count === 0 ? 0.2 : 1 }}
                />
              </div>
              <div className="font-mono text-[12px] text-brand-text font-semibold">{letter}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function OwaspSection({ agg }: { agg: Aggregates }): React.ReactNode {
  if (agg.owaspDistribution.length === 0) return null;
  return (
    <section className="section-pad bg-brand-darker border-t border-b border-brand-border/60">
      <div className="max-w-[1200px] mx-auto px-6">
        <div className="grid gap-10 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] items-end mb-12">
          <div>
            <div className="font-eyebrow mb-3">Top categories</div>
            <h2 className="font-h1 text-brand-text">
              Where skills
              <br />
              fail the most.
            </h2>
          </div>
          <p className="font-lead max-w-[520px]">
            Each skill&apos;s most severe finding gets bucketed into an OWASP AST-10 category. Click
            a row to drill into the matching skills below.
          </p>
        </div>
        <OwaspBars rows={agg.owaspDistribution} />
      </div>
    </section>
  );
}

function TableSection({ skills }: { skills: SkillWatchEntity[] }): React.ReactNode {
  return (
    <section id="inventory" className="section-pad scroll-mt-24">
      <div className="max-w-[1200px] mx-auto px-6">
        <div className="grid gap-10 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] items-end mb-10">
          <div>
            <div className="font-eyebrow mb-3">The inventory</div>
            <h2 className="font-h1 text-brand-text">
              Every skill,
              <br />
              every score.
            </h2>
          </div>
          <p className="font-lead max-w-[520px]">
            Filter by grade, isolate skills carrying findings, or search by owner. Each card links
            straight to the upstream repository on GitHub.
          </p>
        </div>
        <SkillWatchTable skills={skills} />
      </div>
    </section>
  );
}

function EmptyState(): React.ReactNode {
  return (
    <section className="section-pad border-t border-brand-border/60">
      <div className="max-w-[720px] mx-auto px-6 text-center">
        <div className="rounded-xl border border-brand-border bg-brand-card p-10">
          <div className="font-mono text-[11px] uppercase tracking-[0.08em] text-brand-dim mb-3">
            Dataset unavailable
          </div>
          <h2 className="font-h2 text-brand-text mb-4">
            Couldn&apos;t reach the skill-watch dataset.
          </h2>
          <p className="text-brand-muted mb-6">
            The upstream API at <span className="font-mono text-brand-text">frames.ag</span> did not
            respond. This page revalidates every hour — try again shortly, or pull the dataset
            directly.
          </p>
          <a
            href={DATA_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-5 py-3 rounded-lg border border-brand-border bg-brand-secondary text-sm text-brand-text hover:border-brand-teal hover:text-brand-teal transition-colors"
          >
            Open dataset JSON →
          </a>
        </div>
      </div>
    </section>
  );
}

function SourceCTA(): React.ReactNode {
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
        <h2 className="font-h1 mb-5 text-brand-text">See your skill on the watch list.</h2>
        <p className="font-lead max-w-[560px] mx-auto mb-8">
          Skill Watch is built from <span className="font-mono text-brand-teal">agentsec</span>{" "}
          audits run against the public ecosystem. Run the same command on your repo and you&apos;ll
          get the same report — locally, in CI, or before you publish.
        </p>
        <div className="flex flex-wrap gap-3 justify-center">
          <a
            href="/#install"
            className="inline-flex items-center gap-2 bg-brand-teal text-brand-dark text-sm font-medium px-5 py-3 rounded-lg shadow-brand-teal hover:bg-brand-teal-dim hover:-translate-y-[1px] hover:shadow-brand-teal-strong transition-all duration-200"
          >
            Install AgentSec
          </a>
          <a
            href={DATASET_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-transparent border border-brand-border text-brand-text text-sm font-medium px-5 py-3 rounded-lg hover:bg-brand-card hover:border-brand-border-strong transition-colors"
          >
            View dataset on{" "}
            {/* biome-ignore lint/performance/noImgElement: small inline brand mark, not a hero image */}
            <img src={FRAMES_LOGO_SRC} alt="Frames" className="h-[18px] w-auto" />
            <span aria-hidden="true">→</span>
          </a>
        </div>
      </div>
    </section>
  );
}
