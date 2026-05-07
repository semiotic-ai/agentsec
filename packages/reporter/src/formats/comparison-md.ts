/**
 * Multi-skill comparison Markdown formatter.
 *
 * Produces a GitHub-flavored Markdown document with a side-by-side matrix
 * (skills × AST/AST-W rules) using emoji severity icons. Designed to paste
 * directly into a PR description, issue, or readme.
 */

import type { AuditReport } from "@agentsec/shared";
import { buildComparison, type CellSeverity, type ComparisonView } from "./comparison-json.js";
import { formatMd } from "./md.js";

const SEVERITY_ICON: Record<CellSeverity, string> = {
  critical: "🔴",
  high: "🟠",
  medium: "🟡",
  low: "🟢",
  pass: "⚪",
};

/** Escape pipe characters so a finding title can't break a Markdown table row. */
const escCell = (s: string): string => s.replace(/\|/g, "\\|");

const renderCell = (severity: CellSeverity, count: number): string => {
  if (severity === "pass") return SEVERITY_ICON.pass;
  return `${SEVERITY_ICON[severity]} ${count}`;
};

const renderSummary = (view: ComparisonView): string => {
  const lines: string[] = [];
  lines.push("## Summary");
  lines.push("");
  lines.push(`- **Skills compared:** ${view.skills.length}`);
  lines.push(`- **Best skill:** \`${view.summary.bestSkill || "—"}\``);
  lines.push(`- **Worst skill:** \`${view.summary.worstSkill || "—"}\``);
  lines.push(`- **Average score:** ${view.summary.avgScore}/100`);
  lines.push(`- **Total findings:** ${view.summary.totalFindings}`);
  return lines.join("\n");
};

const renderMatrix = (view: ComparisonView): string => {
  if (view.skills.length === 0) return "";
  const lines: string[] = [];
  lines.push("## Comparison Matrix");
  lines.push("");

  if (view.ruleGroups.length === 0) {
    lines.push("_No findings across compared skills._");
    return lines.join("\n");
  }

  const allRules = view.ruleGroups.flatMap((g) => g.rules);

  // Header row
  const header = ["Skill", ...allRules.map((r) => r.id)];
  const sep = header.map((_, i) => (i === 0 ? ":---" : ":---:"));
  lines.push(`| ${header.map(escCell).join(" | ")} |`);
  lines.push(`| ${sep.join(" | ")} |`);

  for (let idx = 0; idx < view.skills.length; idx++) {
    const skill = view.skills[idx];
    const row = [`**${escCell(skill.name)}** (${skill.grade} · ${skill.score})`];
    for (const rule of allRules) {
      const cell = rule.cells[idx];
      row.push(renderCell(cell.severity, cell.count));
    }
    lines.push(`| ${row.join(" | ")} |`);
  }

  return lines.join("\n");
};

const renderLegend = (): string => {
  const lines: string[] = [];
  lines.push("## Legend");
  lines.push("");
  lines.push(`- ${SEVERITY_ICON.critical} Critical`);
  lines.push(`- ${SEVERITY_ICON.high} High`);
  lines.push(`- ${SEVERITY_ICON.medium} Medium`);
  lines.push(`- ${SEVERITY_ICON.low} Low`);
  lines.push(`- ${SEVERITY_ICON.pass} Pass / no finding`);
  return lines.join("\n");
};

const renderRuleIndex = (view: ComparisonView): string => {
  const allRules = view.ruleGroups.flatMap((g) => g.rules);
  if (allRules.length === 0) return "";
  const lines: string[] = ["## Rules"];
  lines.push("");
  for (const rule of allRules) {
    const link = rule.link ? `[${rule.id}](${rule.link})` : rule.id;
    lines.push(`- ${link} — ${rule.title}`);
  }
  return lines.join("\n");
};

const renderSkillScores = (view: ComparisonView): string => {
  const lines: string[] = ["## Per-Skill Scores"];
  lines.push("");
  for (const s of view.skills) {
    lines.push(`- **${s.name}** v${s.version} — Grade **${s.grade}** (${s.score}/100)`);
  }
  return lines.join("\n");
};

/**
 * Render an `AuditReport` as a Markdown comparison view. Falls back to the
 * single-skill `formatMd` when there are fewer than two skills so callers
 * don't need to branch on skill count themselves.
 */
export const formatComparisonMd = (report: AuditReport): string => {
  if (report.skills.length < 2) return formatMd(report);

  const view = buildComparison(report);
  const sections = [
    `# AgentSec Comparison Report`,
    `_Report ${report.id} · ${report.platform} · ${report.timestamp}_`,
    renderSummary(view),
    renderMatrix(view),
    renderSkillScores(view),
    renderLegend(),
    renderRuleIndex(view),
  ].filter((s) => s.length > 0);
  return `${sections.join("\n\n")}\n`;
};
