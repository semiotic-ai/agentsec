"use client";

import { useEffect, useMemo, useState } from "react";
import type { GradeKey, SkillWatchEntity } from "./types";

type SortKey =
  | "score_overall"
  | "score_security"
  | "findings_total"
  | "install_count"
  | "skill_name"
  | "last_scanned_at"
  | "trending_rank";

type SortDir = "asc" | "desc";

type SortSpec = { key: SortKey; dir: SortDir };

type OwaspFilter = "all" | string;

type FilterOwaspEvent = CustomEvent<{ id: string }>;

const OWASP_FILTER_EVENT = "skill-watch:filter-owasp";

const SORT_OPTIONS: readonly { key: SortKey; label: string; defaultDir: SortDir }[] = [
  { key: "trending_rank", label: "Trending", defaultDir: "asc" },
  { key: "install_count", label: "Installs", defaultDir: "desc" },
  { key: "score_overall", label: "Score", defaultDir: "desc" },
  { key: "score_security", label: "Security score", defaultDir: "desc" },
  { key: "findings_total", label: "Findings", defaultDir: "desc" },
  { key: "skill_name", label: "Name", defaultDir: "asc" },
  { key: "last_scanned_at", label: "Recently scanned", defaultDir: "desc" },
];

const GRADE_FILTERS: readonly { key: "all" | GradeKey; label: string }[] = [
  { key: "all", label: "All grades" },
  { key: "A", label: "A" },
  { key: "B", label: "B" },
  { key: "C", label: "C" },
  { key: "D", label: "D" },
  { key: "F", label: "F" },
];

const VULN_FILTERS: readonly { key: "all" | "vulnerable" | "clean"; label: string }[] = [
  { key: "all", label: "All skills" },
  { key: "vulnerable", label: "Has findings" },
  { key: "clean", label: "Clean" },
];

const PAGE_SIZE = 24;
const NUMBER_FORMAT = new Intl.NumberFormat("en-US");

function findingsTotal(e: SkillWatchEntity): number {
  const f = e.fields;
  return f.findings_critical + f.findings_high + f.findings_medium + f.findings_low;
}

function compare(a: SkillWatchEntity, b: SkillWatchEntity, spec: SortSpec): number {
  const dir = spec.dir === "asc" ? 1 : -1;
  switch (spec.key) {
    case "score_overall":
      return (a.fields.score_overall - b.fields.score_overall) * dir;
    case "score_security":
      return (a.fields.score_security - b.fields.score_security) * dir;
    case "findings_total":
      return (findingsTotal(a) - findingsTotal(b)) * dir;
    case "install_count":
      return (a.fields.install_count - b.fields.install_count) * dir;
    case "skill_name":
      return a.fields.skill_name.localeCompare(b.fields.skill_name) * dir;
    case "last_scanned_at":
      return (Date.parse(a.fields.last_scanned_at) - Date.parse(b.fields.last_scanned_at)) * dir;
    case "trending_rank": {
      const ar = a.fields.trending_rank ?? Number.MAX_SAFE_INTEGER;
      const br = b.fields.trending_rank ?? Number.MAX_SAFE_INTEGER;
      return (ar - br) * dir;
    }
  }
}

function gradeChip(grade: string): string {
  const letter = grade?.charAt(0).toUpperCase();
  if (letter === "A" || letter === "B")
    return "bg-brand-green/10 text-brand-green border-brand-green/35";
  if (letter === "C") return "bg-brand-yellow/10 text-brand-yellow border-brand-yellow/35";
  if (letter === "D") return "bg-brand-orange/10 text-brand-orange border-brand-orange/35";
  return "bg-brand-red/10 text-brand-red border-brand-red/35";
}

function scoreBar(score: number): string {
  if (score >= 85) return "bg-brand-green";
  if (score >= 70) return "bg-brand-yellow";
  if (score >= 50) return "bg-brand-orange";
  return "bg-brand-red";
}

function scoreText(score: number): string {
  if (score >= 85) return "text-brand-green";
  if (score >= 70) return "text-brand-yellow";
  if (score >= 50) return "text-brand-orange";
  return "text-brand-red";
}

function githubUrl(e: SkillWatchEntity): string {
  const { owner, repo, skill_path } = e.fields;
  const path = skill_path?.startsWith("/") ? skill_path.slice(1) : skill_path;
  return `https://github.com/${owner}/${repo}${path ? `/tree/HEAD/${path}` : ""}`;
}

function formatRelativeTime(iso: string): string {
  const ms = Date.now() - Date.parse(iso);
  if (Number.isNaN(ms)) return "unknown";
  const days = Math.floor(ms / 86_400_000);
  if (days < 1) return "today";
  if (days === 1) return "1 day ago";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  if (months === 1) return "1 month ago";
  if (months < 12) return `${months} months ago`;
  const years = Math.floor(months / 12);
  return years === 1 ? "1 year ago" : `${years} years ago`;
}

function stripMarkdownLinks(text: string): string {
  return text.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");
}

export function SkillWatchTable({ skills }: { skills: SkillWatchEntity[] }): React.ReactNode {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortSpec>({ key: "trending_rank", dir: "asc" });
  const [gradeFilter, setGradeFilter] = useState<"all" | GradeKey>("all");
  const [vulnFilter, setVulnFilter] = useState<"all" | "vulnerable" | "clean">("all");
  const [owaspFilter, setOwaspFilter] = useState<OwaspFilter>("all");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const owaspOptions = useMemo(() => {
    const set = new Set<string>();
    for (const s of skills) {
      if (s.fields.top_finding_owasp && s.fields.has_vulnerabilities) {
        set.add(s.fields.top_finding_owasp);
      }
    }
    return Array.from(set).sort();
  }, [skills]);

  useEffect(() => {
    const initial = new URLSearchParams(window.location.search).get("owasp");
    if (initial) {
      const upper = initial.toUpperCase();
      if (owaspOptions.includes(upper)) {
        setOwaspFilter(upper);
      }
    }
  }, [owaspOptions]);

  useEffect(() => {
    const handler = (event: Event): void => {
      const detail = (event as FilterOwaspEvent).detail;
      if (!detail?.id) return;
      setOwaspFilter(detail.id);
    };
    window.addEventListener(OWASP_FILTER_EVENT, handler);
    return () => window.removeEventListener(OWASP_FILTER_EVENT, handler);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const items = skills.filter((e) => {
      const f = e.fields;
      if (gradeFilter !== "all" && f.grade?.charAt(0).toUpperCase() !== gradeFilter) return false;
      if (vulnFilter === "vulnerable" && !f.has_vulnerabilities) return false;
      if (vulnFilter === "clean" && f.has_vulnerabilities) return false;
      if (owaspFilter !== "all" && f.top_finding_owasp !== owaspFilter) return false;
      if (!q) return true;
      const haystack =
        `${f.skill_name} ${f.owner} ${f.repo} ${f.description} ${f.top_finding_owasp} ${f.top_finding_rule}`.toLowerCase();
      return haystack.includes(q);
    });
    return [...items].sort((a, b) => compare(a, b, sort));
  }, [skills, query, sort, gradeFilter, vulnFilter, owaspFilter]);

  const filteredLength = filtered.length;
  // biome-ignore lint/correctness/useExhaustiveDependencies: filter changes are the trigger, not the body
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [query, gradeFilter, vulnFilter, owaspFilter]);

  const visible = filtered.slice(0, visibleCount);
  const remaining = Math.max(0, filteredLength - visible.length);
  const hasActiveFilters =
    query.length > 0 || gradeFilter !== "all" || vulnFilter !== "all" || owaspFilter !== "all";

  const onSortClick = (key: SortKey): void => {
    setSort((prev) => {
      if (prev.key === key) {
        return { key, dir: prev.dir === "asc" ? "desc" : "asc" };
      }
      const opt = SORT_OPTIONS.find((o) => o.key === key);
      return { key, dir: opt?.defaultDir ?? "desc" };
    });
  };

  const resetFilters = (): void => {
    setQuery("");
    setGradeFilter("all");
    setVulnFilter("all");
    setOwaspFilter("all");
  };

  return (
    <div>
      <div className="sticky top-[64px] z-30 -mx-6 px-6 py-3 bg-brand-dark/85 backdrop-blur-md border-y border-brand-border/40 mb-6">
        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3">
          <label className="relative block w-full sm:w-auto">
            <span className="sr-only">Search skills</span>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-dim"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search skill, owner, rule, AST…"
              className="w-full sm:w-72 pl-9 pr-3 py-2 rounded-lg bg-brand-secondary border border-brand-border focus:border-brand-teal focus:outline-none text-sm text-brand-text placeholder:text-brand-dim font-mono"
            />
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <FilterGroup
              ariaLabel="Filter by grade"
              options={GRADE_FILTERS}
              value={gradeFilter}
              onChange={(v) => setGradeFilter(v as "all" | GradeKey)}
            />
            <FilterGroup
              ariaLabel="Filter by vulnerability"
              options={VULN_FILTERS}
              value={vulnFilter}
              onChange={(v) => setVulnFilter(v as "all" | "vulnerable" | "clean")}
            />
            {owaspOptions.length > 0 && (
              <FilterGroup
                ariaLabel="Filter by OWASP category"
                options={[
                  { key: "all" as OwaspFilter, label: "All OWASP" },
                  ...owaspOptions.map((id) => ({ key: id, label: id })),
                ]}
                value={owaspFilter}
                onChange={(v) => setOwaspFilter(v)}
              />
            )}
          </div>
          <div className="sm:ml-auto flex items-center gap-3">
            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="text-[11px] font-mono text-brand-teal hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal rounded"
              >
                Reset filters
              </button>
            )}
            <div className="text-[12px] font-mono text-brand-dim tabular-nums" aria-live="polite">
              {filteredLength}/{skills.length} skills
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-3 flex-nowrap overflow-x-auto pb-1 -mx-1 px-1 scrollbar-thin">
          <span className="font-mono text-[11px] text-brand-dim uppercase tracking-[0.08em] mr-1 shrink-0">
            Sort
          </span>
          {SORT_OPTIONS.map((opt) => {
            const active = sort.key === opt.key;
            const arrow = active ? (sort.dir === "asc" ? "↑" : "↓") : "";
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => onSortClick(opt.key)}
                aria-pressed={active}
                className={`px-3 py-1.5 rounded-md text-xs font-mono border transition-colors shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal ${
                  active
                    ? "bg-brand-teal/15 border-brand-teal/50 text-brand-text"
                    : "bg-brand-secondary border-brand-border text-brand-muted hover:border-brand-border-strong hover:text-brand-text"
                }`}
              >
                {opt.label} {arrow && <span aria-hidden="true">{arrow}</span>}
              </button>
            );
          })}
        </div>
      </div>

      {filteredLength === 0 ? (
        <div className="rounded-xl border border-brand-border bg-brand-card p-10 text-center">
          <div className="font-mono text-sm text-brand-dim mb-2">no results</div>
          <p className="text-sm text-brand-muted mb-5">Nothing matches that filter combination.</p>
          <button
            type="button"
            onClick={resetFilters}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-brand-border bg-brand-secondary text-sm text-brand-text hover:border-brand-teal hover:text-brand-teal transition-colors"
          >
            Reset filters
          </button>
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {visible.map((entity) => (
              <SkillCard key={entity.entity_id} entity={entity} />
            ))}
          </div>
          {remaining > 0 && (
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-lg border border-brand-border bg-brand-card text-sm text-brand-text hover:border-brand-teal hover:text-brand-teal transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal"
              >
                Show {Math.min(PAGE_SIZE, remaining)} more
              </button>
              {remaining > PAGE_SIZE && (
                <button
                  type="button"
                  onClick={() => setVisibleCount(filteredLength)}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-lg border border-transparent bg-transparent text-sm text-brand-muted hover:text-brand-text transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal"
                >
                  Show all {NUMBER_FORMAT.format(filteredLength)}
                </button>
              )}
            </div>
          )}
          <div className="mt-4 text-center font-mono text-[11px] text-brand-dim tabular-nums">
            Showing {NUMBER_FORMAT.format(visible.length)} of {NUMBER_FORMAT.format(filteredLength)}
          </div>
        </>
      )}
    </div>
  );
}

function FilterGroup<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: readonly { key: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  ariaLabel: string;
}): React.ReactNode {
  return (
    // biome-ignore lint/a11y/useSemanticElements: fieldset blocks React click delegation in this layout
    <div
      role="group"
      aria-label={ariaLabel}
      className="inline-flex rounded-lg border border-brand-border bg-brand-secondary p-0.5"
    >
      {options.map((opt) => {
        const active = opt.key === value;
        return (
          <button
            key={opt.key}
            type="button"
            onClick={() => onChange(opt.key)}
            aria-pressed={active}
            className={`px-2.5 py-1 rounded-md text-[12px] font-mono transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal ${
              active ? "bg-brand-card text-brand-text" : "text-brand-muted hover:text-brand-text"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function SkillCard({ entity }: { entity: SkillWatchEntity }): React.ReactNode {
  const f = entity.fields;
  const total = findingsTotal(entity);
  const description = stripMarkdownLinks(f.description ?? "").trim();
  const trending = f.trending_rank;
  const hot = f.hot_rank;
  const gradeLabel = f.grade?.trim() || "—";

  return (
    <a
      href={githubUrl(entity)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${f.skill_name} by ${f.owner}, grade ${gradeLabel}, ${total} findings, ${NUMBER_FORMAT.format(f.install_count)} installs`}
      className="group flex flex-col rounded-xl border border-brand-border bg-brand-card hover:border-brand-border-strong hover:-translate-y-0.5 transition-all duration-200 no-underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal"
    >
      <div className="p-5 flex items-start justify-between gap-3 border-b border-brand-border/60">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            {trending !== undefined && (
              <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.06em] px-2 py-0.5 rounded-full border border-brand-teal/30 bg-brand-teal/10 text-brand-teal">
                <span aria-hidden="true">↑</span> #{trending}
              </span>
            )}
            {hot !== undefined && (
              <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.06em] px-2 py-0.5 rounded-full border border-brand-orange/30 bg-brand-orange/10 text-brand-orange">
                <span aria-hidden="true">●</span> hot #{hot}
              </span>
            )}
            {f.is_web3 && (
              <span className="font-mono text-[10px] uppercase tracking-[0.06em] px-2 py-0.5 rounded-full border border-brand-purple/30 bg-brand-purple/10 text-brand-purple">
                web3
              </span>
            )}
          </div>
          <div className="font-mono text-[15px] font-semibold text-brand-text group-hover:text-brand-teal transition-colors truncate">
            {f.skill_name}
          </div>
          <div className="font-mono text-[11px] text-brand-dim truncate mt-0.5">
            {f.owner}/{f.repo}
          </div>
        </div>
        <span
          role="img"
          aria-label={`Grade ${gradeLabel}`}
          className={`inline-flex items-center justify-center w-10 h-10 rounded-md border font-mono font-bold text-base shrink-0 ${gradeChip(gradeLabel)}`}
        >
          {gradeLabel}
        </span>
      </div>

      {description && (
        <div className="px-5 pt-4 pb-3 text-[13px] leading-[1.55] text-brand-muted line-clamp-2">
          {description}
        </div>
      )}

      <div className="px-5 py-4 grid grid-cols-2 gap-x-4 gap-y-3">
        <ScoreLine label="overall" score={f.score_overall} />
        <ScoreLine label="security" score={f.score_security} />
        <ScoreLine label="quality" score={f.score_quality} />
        <ScoreLine label="maintenance" score={f.score_maintenance} />
      </div>

      <div className="px-5 py-3 border-t border-brand-border/60 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 text-[11px] font-mono">
          {f.findings_critical > 0 && (
            <FindingChip count={f.findings_critical} color="red" label="crit" />
          )}
          {f.findings_high > 0 && (
            <FindingChip count={f.findings_high} color="orange" label="high" />
          )}
          {f.findings_medium > 0 && (
            <FindingChip count={f.findings_medium} color="yellow" label="med" />
          )}
          {f.findings_low > 0 && <FindingChip count={f.findings_low} color="blue" label="low" />}
          {total === 0 && (
            <span className="inline-flex items-center gap-1.5 text-brand-green">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-green" aria-hidden="true" />
              no findings
            </span>
          )}
        </div>
        <div className="text-[11px] font-mono text-brand-dim">
          {NUMBER_FORMAT.format(f.install_count)} installs
        </div>
      </div>

      {total > 0 && f.top_finding_owasp && (
        <div className="px-5 py-3 border-t border-brand-border/60 flex items-center justify-between gap-3 flex-wrap text-[11px] font-mono text-brand-dim">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-brand-border bg-brand-secondary text-brand-muted">
            top: {f.top_finding_owasp}
            <span className="text-brand-dim">·</span>
            <span className="text-brand-text">{f.top_finding_rule}</span>
          </span>
          <div className="flex items-center gap-2">
            <Capability ok={f.has_readme} label="readme" />
            <Capability ok={f.has_license} label="license" />
            <Capability ok={f.has_tests} label="tests" />
          </div>
        </div>
      )}
      {!(total > 0 && f.top_finding_owasp) && (
        <div className="px-5 py-3 border-t border-brand-border/60 flex items-center justify-end gap-2 text-[11px] font-mono text-brand-dim">
          <Capability ok={f.has_readme} label="readme" />
          <Capability ok={f.has_license} label="license" />
          <Capability ok={f.has_tests} label="tests" />
        </div>
      )}

      <div className="px-5 py-2.5 border-t border-brand-border/60 flex items-center justify-between text-[11px] font-mono text-brand-dim">
        <span>scanned {formatRelativeTime(f.last_scanned_at)}</span>
        <span className="text-brand-teal opacity-40 group-hover:opacity-100 transition-opacity">
          github →
        </span>
      </div>
    </a>
  );
}

function ScoreLine({ label, score }: { label: string; score: number }): React.ReactNode {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 mb-1">
        <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-brand-dim">
          {label}
        </span>
        <span className={`font-mono text-[12px] font-medium ${scoreText(score)}`}>{score}</span>
      </div>
      <div className="w-full h-1 rounded-full bg-brand-dark overflow-hidden">
        <div
          className={`h-full rounded-full ${scoreBar(score)}`}
          style={{ width: `${Math.max(2, score)}%` }}
        />
      </div>
    </div>
  );
}

function FindingChip({
  count,
  color,
  label,
}: {
  count: number;
  color: "red" | "orange" | "yellow" | "blue";
  label: string;
}): React.ReactNode {
  const dot =
    color === "red"
      ? "bg-brand-red"
      : color === "orange"
        ? "bg-brand-orange"
        : color === "yellow"
          ? "bg-brand-yellow"
          : "bg-brand-blue";
  const text =
    color === "red"
      ? "text-brand-red"
      : color === "orange"
        ? "text-brand-orange"
        : color === "yellow"
          ? "text-brand-yellow"
          : "text-brand-blue";
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} aria-hidden="true" />
      <span className={`font-medium ${text}`}>{count}</span>
      <span className="text-brand-dim">{label}</span>
    </span>
  );
}

function Capability({ ok, label }: { ok: boolean; label: string }): React.ReactNode {
  return (
    <span
      role="img"
      aria-label={`${label}: ${ok ? "present" : "missing"}`}
      className={`inline-flex items-center gap-1 ${ok ? "text-brand-green" : "text-brand-dim line-through"}`}
    >
      <span aria-hidden="true">{ok ? "✓" : "·"}</span>
      {label}
    </span>
  );
}
