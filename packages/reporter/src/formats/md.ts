/**
 * Plain Markdown report formatter for a single skill (or a multi-skill
 * report rendered without the comparison matrix). Designed for pasting into
 * a PR description or readme; no ANSI, no HTML, no JS.
 */

import type { AuditReport, SecurityFinding, SkillAuditResult } from "@agentsec/shared";

const SEVERITY_ICON = {
  critical: "🔴",
  high: "🟠",
  medium: "🟡",
  low: "🟢",
  info: "⚪",
} as const;

const SEVERITY_ORDER: Record<SecurityFinding["severity"], number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  info: 4,
};

const renderFinding = (f: SecurityFinding): string => {
  const icon = SEVERITY_ICON[f.severity];
  const id = f.owaspId ? `**${f.owaspId}** · ` : "";
  const loc = f.file ? ` _(${f.file}${f.line ? `:${f.line}` : ""})_` : "";
  const lines = [`- ${icon} ${id}${f.title}${loc}`];
  if (f.description) lines.push(`  ${f.description}`);
  if (f.remediation) lines.push(`  _Fix:_ ${f.remediation}`);
  return lines.join("\n");
};

const renderSkill = (r: SkillAuditResult): string => {
  const lines: string[] = [];
  lines.push(`## ${r.skill.name} v${r.skill.version}`);
  lines.push("");
  lines.push(
    `Grade **${r.score.grade}** · Overall ${r.score.overall}/100 · Security ${r.score.security} · Quality ${r.score.quality} · Maintenance ${r.score.maintenance}`,
  );

  if (r.web3?.detected) {
    lines.push("");
    lines.push(`> Web3 capability detected (${r.web3.confidence})`);
  }

  if (r.securityFindings.length === 0) {
    lines.push("");
    lines.push("_No security findings._");
    return lines.join("\n");
  }

  const sorted = [...r.securityFindings].sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity],
  );
  lines.push("");
  lines.push(`### Findings (${sorted.length})`);
  lines.push("");
  for (const f of sorted) {
    lines.push(renderFinding(f));
  }
  return lines.join("\n");
};

/**
 * Render a single-skill audit report as Markdown. For multi-skill reports
 * each skill is rendered in sequence after a top-level summary; callers that
 * want the matrix view should use `formatComparisonMd` instead.
 */
export const formatMd = (report: AuditReport): string => {
  const sections: string[] = [];
  sections.push(`# AgentSec Report`);
  sections.push(`_Report ${report.id} · ${report.platform} · ${report.timestamp}_`);
  sections.push(
    `**Skills:** ${report.summary.totalSkills} · **Avg score:** ${report.summary.averageScore}/100 · **Critical:** ${report.summary.criticalFindings} · **High:** ${report.summary.highFindings} · **Medium:** ${report.summary.mediumFindings} · **Low:** ${report.summary.lowFindings}`,
  );
  for (const r of report.skills) {
    sections.push(renderSkill(r));
  }
  return `${sections.join("\n\n")}\n`;
};
