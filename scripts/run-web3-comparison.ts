#!/usr/bin/env bun
/**
 * Web3 router comparison runner.
 *
 * Audits a fixed set of router-swap skills (Odos as reference + four
 * competitors) and renders a side-by-side comparison as Markdown, HTML,
 * JSON, and CSV under `examples/comparison/web3-routers/`.
 *
 * Usage:
 *   bun run compare:web3
 *   AGENTSEC_COMPARISON_DIR=/tmp/foo bun run compare:web3   # override fixtures dir
 *
 * The script is intentionally tolerant of missing fixtures: until the per-
 * router fixture units land, it audits whatever subset is present and
 * notes the gap in the rendered output. After every fixture has merged,
 * re-run to refresh the artifacts.
 */
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import type { AuditReport, SecurityFinding, Severity } from "../packages/shared/src/types";

const REPO_ROOT = resolve(import.meta.dir, "..");
const DEFAULT_PROFILE_DIR = join(REPO_ROOT, "e2e/fixtures/profiles/web3");
const PROFILE_DIR = process.env.AGENTSEC_COMPARISON_DIR ?? DEFAULT_PROFILE_DIR;
const OUT_DIR = join(REPO_ROOT, "examples/comparison/web3-routers");
const TMP_DIR = join(REPO_ROOT, ".agentsec-tmp/comparison");

type SkillRole = "reference" | "competitor";

interface ExpectedSkill {
  dir: string;
  label: string;
  role: SkillRole;
}

const EXPECTED_SKILLS: ExpectedSkill[] = [
  { dir: "odos-swap", label: "Odos", role: "reference" },
  { dir: "1inch-swap", label: "1inch", role: "competitor" },
  { dir: "kyberswap-swap", label: "KyberSwap", role: "competitor" },
  { dir: "0x-swap", label: "0x", role: "competitor" },
  { dir: "cowswap-swap", label: "CowSwap", role: "competitor" },
];

const SEVERITY_ORDER: Severity[] = ["critical", "high", "medium", "low", "info"];
const SEVERITY_RANK: Record<Severity, number> = {
  critical: 5,
  high: 4,
  medium: 3,
  low: 2,
  info: 1,
};
const SEVERITY_EMOJI: Record<Severity | "pass", string> = {
  critical: "🔴",
  high: "🟠",
  medium: "🟡",
  low: "🟢",
  info: "⚪",
  pass: "⚪",
};
const SEVERITY_COLOR: Record<Severity | "pass", string> = {
  critical: "var(--red)",
  high: "var(--orange)",
  medium: "var(--yellow)",
  low: "var(--green)",
  info: "var(--blue)",
  pass: "var(--text-muted)",
};
const SEVERITY_BG: Record<Severity | "pass", string> = {
  critical: "var(--red-bg)",
  high: "var(--orange-bg)",
  medium: "var(--yellow-bg)",
  low: "var(--green-bg)",
  info: "var(--blue-bg)",
  pass: "transparent",
};

interface Cell {
  severity: Severity | "pass";
  count: number;
}

interface SkillRow {
  dir: string;
  label: string;
  role: SkillRole;
  score: number;
  grade: string;
  totalFindings: number;
  cells: Record<string, Cell>;
}

interface RuleColumn {
  ruleId: string;
  owaspId?: string;
  worstSeverity: Severity | "pass";
}

interface ComparisonView {
  generatedAt: string;
  profileDir: string;
  reference: string;
  skills: SkillRow[];
  rules: RuleColumn[];
  missing: string[];
  best: { label: string; score: number } | null;
  worst: { label: string; score: number } | null;
  averageScore: number;
}

async function exists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

async function runAudit(skillPath: string, outPath: string): Promise<AuditReport> {
  const proc = Bun.spawn(
    [
      "bun",
      "packages/cli/src/cli.ts",
      "audit",
      "--path",
      skillPath,
      "--format",
      "json",
      "--output",
      outPath,
      "--no-color",
      "--profile",
      "web3",
    ],
    { cwd: REPO_ROOT, stdout: "pipe", stderr: "pipe" },
  );
  const exitCode = await proc.exited;
  if (exitCode !== 0 && exitCode !== 1) {
    // Exit 1 is normal when findings exist; anything else is a runner failure.
    const stderr = await new Response(proc.stderr).text();
    throw new Error(`audit ${skillPath} failed (exit ${exitCode}):\n${stderr}`);
  }
  const text = await readFile(outPath, "utf8");
  return JSON.parse(text) as AuditReport;
}

function pickRuleId(finding: SecurityFinding): string {
  return finding.owaspId ?? finding.rule;
}

function buildMatrix(
  reports: { spec: ExpectedSkill; report: AuditReport }[],
  missing: string[],
): ComparisonView {
  const ruleColumns = new Map<string, RuleColumn>();
  const skills: SkillRow[] = [];

  for (const { spec, report } of reports) {
    const result = report.skills[0];
    const score = result?.score.overall ?? 0;
    const grade = result?.score.grade ?? "F";
    const findings = result?.securityFindings ?? [];
    const cells: Record<string, Cell> = {};

    for (const f of findings) {
      const ruleId = pickRuleId(f);
      const col = ruleColumns.get(ruleId) ?? { ruleId, owaspId: f.owaspId, worstSeverity: "pass" };
      if (SEVERITY_RANK[f.severity] > rankOf(col.worstSeverity)) {
        col.worstSeverity = f.severity;
      }
      ruleColumns.set(ruleId, col);

      const cell = cells[ruleId] ?? { severity: "pass", count: 0 };
      if (SEVERITY_RANK[f.severity] > rankOf(cell.severity)) {
        cell.severity = f.severity;
      }
      cell.count += 1;
      cells[ruleId] = cell;
    }

    skills.push({
      dir: spec.dir,
      label: spec.label,
      role: spec.role,
      score,
      grade,
      totalFindings: findings.length,
      cells,
    });
  }

  const rules = Array.from(ruleColumns.values()).sort((a, b) => a.ruleId.localeCompare(b.ruleId));

  let best: ComparisonView["best"] = null;
  let worst: ComparisonView["worst"] = null;
  let scoreSum = 0;
  for (const s of skills) {
    if (best === null || s.score > best.score) best = { label: s.label, score: s.score };
    if (worst === null || s.score < worst.score) worst = { label: s.label, score: s.score };
    scoreSum += s.score;
  }
  const averageScore = skills.length > 0 ? Math.round(scoreSum / skills.length) : 0;

  return {
    generatedAt: new Date().toISOString(),
    profileDir: displayProfileDir(),
    reference: "Odos",
    skills,
    rules,
    missing,
    best,
    worst,
    averageScore,
  };
}

function displayProfileDir(): string {
  // Render as repo-relative so committed artifacts don't leak absolute paths
  // from a contributor's machine. When the env override points outside the
  // repo (e.g. the e2e stub at /tmp), fall back to a stable placeholder.
  const rel = relative(REPO_ROOT, PROFILE_DIR);
  if (rel.startsWith("..") || rel.startsWith("/") || rel === "") {
    return process.env.AGENTSEC_COMPARISON_DIR ? "<override>" : PROFILE_DIR;
  }
  return rel;
}

function rankOf(s: Severity | "pass"): number {
  return s === "pass" ? 0 : SEVERITY_RANK[s];
}

function renderMd(view: ComparisonView): string {
  const lines: string[] = [];
  lines.push("# Web3 Router Comparison");
  lines.push("");
  lines.push(`Generated: ${view.generatedAt}`);
  lines.push("");
  lines.push("Reference skill: **Odos**. Competitors are audited with the AST-10 Web3 Annex");
  lines.push("rules forced on (`--profile web3`) so coverage is identical across rows.");
  lines.push("");

  if (view.skills.length === 0) {
    lines.push("> No fixtures found. Run after the per-router fixture units (1-5) merge.");
    return `${lines.join("\n")}\n`;
  }

  lines.push("## Summary");
  lines.push("");
  lines.push("| Skill | Role | Score | Grade | Findings |");
  lines.push("| --- | --- | ---: | :-: | ---: |");
  for (const s of view.skills) {
    lines.push(`| ${s.label} | ${s.role} | ${s.score} | ${s.grade} | ${s.totalFindings} |`);
  }
  lines.push("");

  if (view.rules.length > 0) {
    lines.push("## Rule matrix");
    lines.push("");
    lines.push("Cells show the worst severity flagged for each rule, with finding count.");
    lines.push("Empty cells mean no finding for that rule.");
    lines.push("");
    const header = ["Rule", ...view.skills.map((s) => s.label)].join(" | ");
    const sep = ["---", ...view.skills.map(() => ":-:")].join(" | ");
    lines.push(`| ${header} |`);
    lines.push(`| ${sep} |`);
    for (const col of view.rules) {
      const row = [`\`${col.ruleId}\``];
      for (const s of view.skills) {
        const cell = s.cells[col.ruleId];
        if (!cell) {
          row.push("");
        } else {
          row.push(`${SEVERITY_EMOJI[cell.severity]} ${cell.severity} (${cell.count})`);
        }
      }
      lines.push(`| ${row.join(" | ")} |`);
    }
    lines.push("");
  }

  if (view.missing.length > 0) {
    lines.push("## Missing fixtures");
    lines.push("");
    for (const m of view.missing) {
      lines.push(`- \`${m}\``);
    }
    lines.push("");
  }

  lines.push("## Legend");
  lines.push("");
  for (const sev of SEVERITY_ORDER) {
    lines.push(`- ${SEVERITY_EMOJI[sev]} ${sev}`);
  }
  lines.push("");

  return `${lines.join("\n")}\n`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderHtml(view: ComparisonView): string {
  const styles = `
:root {
  --bg-primary: #0d1117;
  --bg-secondary: #161b22;
  --bg-tertiary: #1c2333;
  --bg-card: #1c2333;
  --bg-hover: #252d3a;
  --border: #30363d;
  --text-primary: #e6edf3;
  --text-secondary: #8b949e;
  --text-muted: #6e7681;
  --teal: #00d2b4;
  --green: #3fb950;
  --green-bg: rgba(63, 185, 80, 0.15);
  --yellow: #d29922;
  --yellow-bg: rgba(210, 153, 34, 0.18);
  --orange: #db6d28;
  --orange-bg: rgba(219, 109, 40, 0.2);
  --red: #f85149;
  --red-bg: rgba(248, 81, 73, 0.2);
  --blue: #58a6ff;
  --blue-bg: rgba(88, 166, 255, 0.15);
  --font-mono: 'SF Mono', 'Cascadia Code', 'Fira Code', Consolas, monospace;
  --font-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
}
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: var(--font-sans); background: var(--bg-primary); color: var(--text-primary); line-height: 1.5; min-height: 100vh; }
.container { max-width: 1200px; margin: 0 auto; padding: 32px 24px; }
h1 { font-size: 1.8rem; color: var(--teal); margin-bottom: 4px; }
.subtitle { color: var(--text-secondary); margin-bottom: 24px; font-size: 0.95rem; }
.cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 32px; }
.card { background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; padding: 16px; }
.card .label { font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; }
.card .value { font-family: var(--font-mono); font-size: 1.6rem; font-weight: 600; margin-top: 4px; }
.card.best .value { color: var(--green); }
.card.worst .value { color: var(--red); }
.card.avg .value { color: var(--teal); }
.section { margin-bottom: 32px; }
.section h2 { font-size: 1.2rem; margin-bottom: 12px; padding-bottom: 6px; border-bottom: 1px solid var(--border); }
.matrix-wrap { overflow-x: auto; border: 1px solid var(--border); border-radius: 8px; }
table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
th, td { padding: 8px 10px; text-align: left; border-bottom: 1px solid var(--border); white-space: nowrap; }
thead th { position: sticky; top: 0; background: var(--bg-secondary); color: var(--text-secondary); font-weight: 600; text-transform: uppercase; font-size: 0.72rem; letter-spacing: 0.05em; }
tbody tr:hover { background: var(--bg-hover); }
.rule-id { font-family: var(--font-mono); color: var(--text-secondary); }
.cell-content { display: inline-flex; align-items: center; gap: 6px; padding: 2px 8px; border-radius: 4px; font-family: var(--font-mono); font-size: 0.78rem; }
.cell-empty { color: var(--text-muted); font-family: var(--font-mono); font-size: 0.78rem; }
.role-badge { display: inline-block; padding: 1px 8px; border-radius: 999px; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.04em; font-weight: 600; }
.role-reference { background: var(--blue-bg); color: var(--blue); }
.role-competitor { background: var(--bg-tertiary); color: var(--text-secondary); }
.legend { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; color: var(--text-secondary); font-size: 0.8rem; }
.legend span { display: inline-flex; align-items: center; gap: 4px; }
.muted { color: var(--text-muted); }
.warning { background: var(--yellow-bg); border: 1px solid var(--yellow); color: var(--yellow); padding: 12px 16px; border-radius: 8px; margin-bottom: 24px; font-size: 0.9rem; }
`;

  const cards = (() => {
    if (view.skills.length === 0) return "";
    const items: string[] = [];
    if (view.best) {
      items.push(
        `<div class="card best"><div class="label">Best</div><div class="value">${escapeHtml(view.best.label)}</div><div class="muted">score ${view.best.score}</div></div>`,
      );
    }
    if (view.worst) {
      items.push(
        `<div class="card worst"><div class="label">Worst</div><div class="value">${escapeHtml(view.worst.label)}</div><div class="muted">score ${view.worst.score}</div></div>`,
      );
    }
    items.push(
      `<div class="card avg"><div class="label">Average score</div><div class="value">${view.averageScore}</div></div>`,
    );
    items.push(
      `<div class="card"><div class="label">Skills audited</div><div class="value">${view.skills.length}</div></div>`,
    );
    return `<div class="cards">${items.join("")}</div>`;
  })();

  const summaryTable = (() => {
    if (view.skills.length === 0) return "";
    const rows = view.skills
      .map(
        (s) =>
          `<tr><td>${escapeHtml(s.label)}</td><td><span class="role-badge role-${s.role}">${s.role}</span></td><td>${s.score}</td><td>${s.grade}</td><td>${s.totalFindings}</td></tr>`,
      )
      .join("");
    return `
<div class="section">
  <h2>Summary</h2>
  <div class="matrix-wrap">
    <table>
      <thead><tr><th>Skill</th><th>Role</th><th>Score</th><th>Grade</th><th>Findings</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>
</div>`;
  })();

  const matrix = (() => {
    if (view.rules.length === 0 || view.skills.length === 0) return "";
    const headers = [
      "<th>Rule</th>",
      ...view.skills.map((s) => `<th>${escapeHtml(s.label)}</th>`),
    ].join("");
    const rows = view.rules
      .map((col) => {
        const cellTds = view.skills
          .map((s) => {
            const cell = s.cells[col.ruleId];
            if (!cell) {
              return '<td><span class="cell-empty">·</span></td>';
            }
            const color = SEVERITY_COLOR[cell.severity];
            const bg = SEVERITY_BG[cell.severity];
            return `<td><span class="cell-content" style="color:${color};background:${bg}">${SEVERITY_EMOJI[cell.severity]} ${cell.severity}<span class="muted">×${cell.count}</span></span></td>`;
          })
          .join("");
        return `<tr><td><span class="rule-id">${escapeHtml(col.ruleId)}</span></td>${cellTds}</tr>`;
      })
      .join("");
    return `
<div class="section">
  <h2>Rule matrix</h2>
  <div class="matrix-wrap">
    <table>
      <thead><tr>${headers}</tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>
  <div class="legend">
    ${SEVERITY_ORDER.map((s) => `<span style="color:${SEVERITY_COLOR[s]}">${SEVERITY_EMOJI[s]} ${s}</span>`).join("")}
    <span class="muted">· no finding</span>
  </div>
</div>`;
  })();

  const missingBanner =
    view.missing.length > 0
      ? `<div class="warning">Missing fixtures: ${view.missing.map((m) => `<code>${escapeHtml(m)}</code>`).join(", ")}. Re-run after they merge to refresh this report.</div>`
      : "";

  const emptyBanner =
    view.skills.length === 0
      ? '<div class="warning">No fixtures discovered. Run after the per-router fixture units (1-5) merge.</div>'
      : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Web3 Router Comparison — agentsec</title>
  <style>${styles}</style>
</head>
<body>
  <div class="container">
    <h1>Web3 Router Comparison</h1>
    <div class="subtitle">Reference skill: <strong>Odos</strong>. Competitors audited with <code>--profile web3</code>.</div>
    <div class="muted" style="margin-bottom:24px;font-size:0.85rem">Generated ${escapeHtml(view.generatedAt)} from <code>${escapeHtml(view.profileDir)}</code></div>
    ${emptyBanner}
    ${missingBanner}
    ${cards}
    ${summaryTable}
    ${matrix}
  </div>
</body>
</html>
`;
}

function renderCsv(view: ComparisonView): string {
  const rows: string[] = ["skill,rule_id,severity,count"];
  for (const s of view.skills) {
    for (const [ruleId, cell] of Object.entries(s.cells)) {
      if (cell.count === 0) continue;
      rows.push([csvField(s.label), csvField(ruleId), cell.severity, String(cell.count)].join(","));
    }
  }
  return `${rows.join("\n")}\n`;
}

function csvField(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

async function main(): Promise<void> {
  await mkdir(OUT_DIR, { recursive: true });
  await mkdir(TMP_DIR, { recursive: true });

  console.log(`Auditing fixtures in ${PROFILE_DIR}`);

  const reports: { spec: ExpectedSkill; report: AuditReport }[] = [];
  const missing: string[] = [];

  for (const spec of EXPECTED_SKILLS) {
    const skillPath = join(PROFILE_DIR, spec.dir);
    if (!(await exists(skillPath))) {
      console.warn(`  · skipping ${spec.dir} — fixture not found`);
      missing.push(spec.dir);
      continue;
    }
    const outPath = join(TMP_DIR, `${spec.dir}.json`);
    console.log(`  · auditing ${spec.dir}`);
    const report = await runAudit(skillPath, outPath);
    reports.push({ spec, report });
  }

  const view = buildMatrix(reports, missing);

  await writeFile(join(OUT_DIR, "report.json"), `${JSON.stringify(view, null, 2)}\n`);
  await writeFile(join(OUT_DIR, "report.md"), renderMd(view));
  await writeFile(join(OUT_DIR, "report.html"), renderHtml(view));
  await writeFile(join(OUT_DIR, "scores.csv"), renderCsv(view));

  console.log(`\nWrote artifacts to ${OUT_DIR}`);
  if (missing.length > 0) {
    console.log(`Missing fixtures (${missing.length}): ${missing.join(", ")}`);
  }
}

main().catch((err) => {
  console.error(`run-web3-comparison failed: ${err.message}`);
  process.exit(1);
});
