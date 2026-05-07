/**
 * Multi-skill comparison HTML fragment.
 *
 * Renders a side-by-side matrix (skills × AST / AST-W rules) as a
 * self-contained `<section class="comparison-view">` element that can be
 * prepended to the standard per-skill HTML report. The CSS is inlined so
 * the fragment is embeddable without additional `<link>` or `<style>` tags
 * beyond what's already in the host document; variables reference the
 * same dark-theme custom properties (`--teal`, `--bg-card`, etc.) that
 * `formatHtml` defines.
 */

import type { AuditReport } from "@agentsec/shared";
import {
  buildComparison,
  type CellSeverity,
  type ComparisonRule,
  type ComparisonView,
} from "./comparison-json.js";

const esc = (s: string): string =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

/** Severity to CSS background color for matrix cells. */
const SEVERITY_BG: Record<CellSeverity, string> = {
  critical: "#ff4d4f",
  high: "#ff7a45",
  medium: "#ffa940",
  low: "#52c41a",
  pass: "#444",
};

const SEVERITY_FG: Record<CellSeverity, string> = {
  critical: "#fff",
  high: "#1a1a1a",
  medium: "#1a1a1a",
  low: "#0c2b08",
  pass: "#aaa",
};

const COMPARISON_CSS = `
.comparison-view {
  margin-bottom: 32px;
  padding: 24px;
  background: var(--bg-secondary, #161b22);
  border: 1px solid var(--border, #30363d);
  border-radius: var(--radius, 8px);
}
.comparison-view h2 {
  font-size: 1.4rem;
  font-weight: 700;
  color: var(--teal, #00d2b4);
  margin-bottom: 16px;
}
.comparison-view .cmp-summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
  margin-bottom: 20px;
}
.comparison-view .cmp-card {
  background: var(--bg-card, #1c2333);
  border: 1px solid var(--border, #30363d);
  border-radius: var(--radius-sm, 4px);
  padding: 14px 16px;
}
.comparison-view .cmp-card-label {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-secondary, #8b949e);
  margin-bottom: 4px;
}
.comparison-view .cmp-card-value {
  font-size: 1.05rem;
  font-weight: 600;
  color: var(--text-primary, #e6edf3);
  font-family: var(--font-mono, monospace);
}
.comparison-view .cmp-card.best .cmp-card-value { color: #52c41a; }
.comparison-view .cmp-card.worst .cmp-card-value { color: #ff4d4f; }
.comparison-view .cmp-table-wrap {
  overflow-x: auto;
  border: 1px solid var(--border, #30363d);
  border-radius: var(--radius-sm, 4px);
}
.comparison-view table.cmp-matrix {
  border-collapse: collapse;
  width: 100%;
  font-size: 0.85rem;
}
.comparison-view table.cmp-matrix th,
.comparison-view table.cmp-matrix td {
  padding: 8px 10px;
  text-align: center;
  border-bottom: 1px solid var(--border, #30363d);
  border-right: 1px solid var(--border, #30363d);
  white-space: nowrap;
}
.comparison-view table.cmp-matrix thead th {
  background: var(--bg-tertiary, #1c2333);
  color: var(--text-secondary, #8b949e);
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  position: sticky;
  top: 0;
}
.comparison-view table.cmp-matrix th.cmp-rule-id {
  font-family: var(--font-mono, monospace);
  color: var(--teal, #00d2b4);
  text-transform: none;
  letter-spacing: 0;
}
.comparison-view table.cmp-matrix th.cmp-rule-id a {
  color: inherit;
  text-decoration: none;
  border-bottom: 1px dotted currentColor;
}
.comparison-view table.cmp-matrix th.cmp-group {
  background: #0d1117;
  color: var(--text-primary, #e6edf3);
  text-align: left;
  font-size: 0.8rem;
  letter-spacing: 0.05em;
}
.comparison-view table.cmp-matrix th.cmp-skill,
.comparison-view table.cmp-matrix td.cmp-skill {
  position: sticky;
  left: 0;
  background: var(--bg-card, #1c2333);
  text-align: left;
  font-weight: 600;
  z-index: 1;
}
.comparison-view table.cmp-matrix td.cmp-skill .cmp-skill-grade {
  display: inline-block;
  margin-left: 6px;
  padding: 1px 8px;
  border-radius: 10px;
  font-family: var(--font-mono, monospace);
  font-size: 0.7rem;
  background: var(--bg-tertiary, #1c2333);
  color: var(--text-secondary, #8b949e);
  border: 1px solid var(--border, #30363d);
}
.comparison-view table.cmp-matrix td.cmp-cell {
  font-family: var(--font-mono, monospace);
  font-weight: 600;
  font-size: 0.78rem;
}
.comparison-view .cmp-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 16px;
  font-size: 0.78rem;
  color: var(--text-secondary, #8b949e);
}
.comparison-view .cmp-legend .cmp-swatch {
  display: inline-block;
  width: 12px;
  height: 12px;
  border-radius: 2px;
  margin-right: 6px;
  vertical-align: middle;
}
`;

const renderSummary = (view: ComparisonView): string => {
  const cards = [
    { label: "Best skill", value: view.summary.bestSkill || "—", cls: "best" },
    { label: "Worst skill", value: view.summary.worstSkill || "—", cls: "worst" },
    { label: "Average score", value: String(view.summary.avgScore), cls: "" },
    { label: "Total findings", value: String(view.summary.totalFindings), cls: "" },
  ];
  return `<div class="cmp-summary">${cards
    .map(
      (c) => `
        <div class="cmp-card${c.cls ? ` ${c.cls}` : ""}">
          <div class="cmp-card-label">${esc(c.label)}</div>
          <div class="cmp-card-value">${esc(c.value)}</div>
        </div>`,
    )
    .join("")}</div>`;
};

const renderCell = (severity: CellSeverity, count: number): string => {
  const isPass = severity === "pass";
  const label = isPass ? "—" : `${count}`;
  const title = isPass ? "No findings" : `${count} ${severity} finding${count === 1 ? "" : "s"}`;
  return `<td class="cmp-cell" style="background:${SEVERITY_BG[severity]};color:${SEVERITY_FG[severity]}" title="${esc(title)}">${esc(label)}</td>`;
};

const renderRuleHeader = (rule: ComparisonRule): string => {
  const inner = rule.link
    ? `<a href="${esc(rule.link)}" target="_blank" rel="noopener" title="${esc(rule.title)}">${esc(rule.id)}</a>`
    : esc(rule.id);
  return `<th class="cmp-rule-id" title="${esc(rule.title)}">${inner}</th>`;
};

const renderMatrix = (view: ComparisonView): string => {
  if (view.skills.length === 0) return "";
  if (view.ruleGroups.length === 0) {
    return `
      <div class="cmp-table-wrap">
        <table class="cmp-matrix">
          <thead>
            <tr>
              <th class="cmp-skill">Skill</th>
              <th>Findings</th>
            </tr>
          </thead>
          <tbody>
            ${view.skills
              .map(
                (s) => `
              <tr>
                <td class="cmp-skill">${esc(s.name)} <span class="cmp-skill-grade">${esc(s.grade)} · ${s.score}</span></td>
                <td class="cmp-cell" style="background:${SEVERITY_BG.pass};color:${SEVERITY_FG.pass}">—</td>
              </tr>`,
              )
              .join("")}
          </tbody>
        </table>
      </div>`;
  }

  const headerCells = view.ruleGroups
    .flatMap((g) => g.rules.map((rule) => renderRuleHeader(rule)))
    .join("");

  const groupHeader =
    view.ruleGroups.length > 1
      ? `<tr>
          <th class="cmp-skill"></th>
          ${view.ruleGroups
            .map(
              (g) =>
                `<th class="cmp-group" colspan="${g.rules.length}">${g.category === "AST-W" ? "AST-10 Web3 Annex" : "AST-10 Core"}</th>`,
            )
            .join("")}
        </tr>`
      : "";

  const bodyRows = view.skills
    .map((s, idx) => {
      const cells = view.ruleGroups
        .flatMap((g) =>
          g.rules.map((rule) => {
            const cell = rule.cells[idx];
            return renderCell(cell.severity, cell.count);
          }),
        )
        .join("");
      return `<tr>
        <td class="cmp-skill">${esc(s.name)} <span class="cmp-skill-grade">${esc(s.grade)} · ${s.score}</span></td>
        ${cells}
      </tr>`;
    })
    .join("");

  return `
    <div class="cmp-table-wrap">
      <table class="cmp-matrix">
        <thead>
          ${groupHeader}
          <tr>
            <th class="cmp-skill">Skill</th>
            ${headerCells}
          </tr>
        </thead>
        <tbody>${bodyRows}</tbody>
      </table>
    </div>`;
};

const renderLegend = (): string => {
  const items: { sev: CellSeverity; label: string }[] = [
    { sev: "critical", label: "Critical" },
    { sev: "high", label: "High" },
    { sev: "medium", label: "Medium" },
    { sev: "low", label: "Low" },
    { sev: "pass", label: "Pass / N/A" },
  ];
  return `<div class="cmp-legend">${items
    .map(
      (i) =>
        `<span><span class="cmp-swatch" style="background:${SEVERITY_BG[i.sev]}"></span>${esc(i.label)}</span>`,
    )
    .join("")}</div>`;
};

/**
 * Render the comparison view as a self-contained HTML fragment. Returns an
 * empty string when there are fewer than two skills (no comparison is
 * meaningful).
 */
export const formatComparisonHtml = (report: AuditReport): string => {
  if (report.skills.length < 2) return "";
  const view = buildComparison(report);

  return `<section class="comparison-view">
  <style>${COMPARISON_CSS}</style>
  <h2>Skill Comparison</h2>
  ${renderSummary(view)}
  ${renderMatrix(view)}
  ${renderLegend()}
</section>`;
};
