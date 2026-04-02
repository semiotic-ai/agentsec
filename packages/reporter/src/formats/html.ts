/**
 * Self-contained HTML report formatter.
 *
 * Produces a single HTML file with all CSS and JS inlined so it can be
 * opened directly in a browser with zero external dependencies.
 *
 * Design: dark theme with teal/green accent colors matching the
 * Agent Audit brand.
 */

import type {
  AuditReport,
  AuditSummary,
  SecurityFinding,
  Severity,
  SkillAuditResult,
  AuditGrade,
  QualityMetrics,
} from "@agent-audit/shared";

// ── Helpers ─────────────────────────────────────────────────────────────── //

const esc = (s: string): string =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const severityClass = (s: Severity): string => `severity-${s}`;

const gradeClass = (g: AuditGrade): string => `grade-${g.toLowerCase()}`;

const formatTimestamp = (ts: string): string => {
  try {
    return new Date(ts).toLocaleString("en-US", {
      dateStyle: "long",
      timeStyle: "short",
    });
  } catch {
    return ts;
  }
};

// ── CSS ─────────────────────────────────────────────────────────────────── //

const CSS = `
:root {
  --bg-primary: #0d1117;
  --bg-secondary: #161b22;
  --bg-tertiary: #1c2333;
  --bg-card: #1c2333;
  --bg-hover: #252d3a;
  --border: #30363d;
  --border-light: #3d444d;
  --text-primary: #e6edf3;
  --text-secondary: #8b949e;
  --text-muted: #6e7681;
  --teal: #00d2b4;
  --teal-dim: #00a894;
  --teal-bg: rgba(0, 210, 180, 0.1);
  --green: #3fb950;
  --green-bg: rgba(63, 185, 80, 0.1);
  --yellow: #d29922;
  --yellow-bg: rgba(210, 153, 34, 0.1);
  --orange: #db6d28;
  --orange-bg: rgba(219, 109, 40, 0.1);
  --red: #f85149;
  --red-bg: rgba(248, 81, 73, 0.1);
  --blue: #58a6ff;
  --blue-bg: rgba(88, 166, 255, 0.1);
  --purple: #bc8cff;
  --font-mono: 'SF Mono', 'Cascadia Code', 'Fira Code', Consolas, monospace;
  --font-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
  --radius: 8px;
  --radius-sm: 4px;
  --shadow: 0 1px 3px rgba(0,0,0,0.3), 0 1px 2px rgba(0,0,0,0.4);
  --shadow-lg: 0 10px 25px rgba(0,0,0,0.4);
}

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: var(--font-sans);
  background: var(--bg-primary);
  color: var(--text-primary);
  line-height: 1.6;
  min-height: 100vh;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 32px 24px;
}

/* ── Header ──────────────────────────────────────────────────────────── */

.header {
  text-align: center;
  padding: 48px 0 32px;
  border-bottom: 1px solid var(--border);
  margin-bottom: 32px;
}

.header h1 {
  font-size: 2rem;
  font-weight: 700;
  color: var(--teal);
  letter-spacing: -0.02em;
  margin-bottom: 4px;
}

.header .subtitle {
  color: var(--text-secondary);
  font-size: 0.95rem;
}

.meta {
  display: flex;
  justify-content: center;
  gap: 24px;
  margin-top: 16px;
  font-size: 0.85rem;
  color: var(--text-muted);
}

.meta span { display: flex; align-items: center; gap: 6px; }

/* ── Dashboard ───────────────────────────────────────────────────────── */

.dashboard {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin-bottom: 32px;
}

.stat-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 20px;
  text-align: center;
  transition: border-color 0.15s ease;
}

.stat-card:hover { border-color: var(--teal-dim); }

.stat-card .stat-value {
  font-size: 2.2rem;
  font-weight: 700;
  font-family: var(--font-mono);
  line-height: 1.2;
}

.stat-card .stat-label {
  font-size: 0.8rem;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-top: 4px;
}

.stat-card.critical .stat-value { color: var(--red); }
.stat-card.warning .stat-value  { color: var(--yellow); }
.stat-card.success .stat-value  { color: var(--green); }
.stat-card.info .stat-value     { color: var(--teal); }

/* ── Score Gauge ─────────────────────────────────────────────────────── */

.gauge-container {
  display: flex;
  justify-content: center;
  margin-bottom: 32px;
}

.gauge {
  position: relative;
  width: 180px;
  height: 180px;
}

.gauge svg {
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
}

.gauge-bg {
  fill: none;
  stroke: var(--bg-tertiary);
  stroke-width: 12;
}

.gauge-fill {
  fill: none;
  stroke-width: 12;
  stroke-linecap: round;
  transition: stroke-dashoffset 0.6s ease;
}

.gauge-label {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
}

.gauge-score {
  font-size: 2.5rem;
  font-weight: 700;
  font-family: var(--font-mono);
  line-height: 1;
}

.gauge-text {
  font-size: 0.75rem;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

/* ── Section ─────────────────────────────────────────────────────────── */

.section {
  margin-bottom: 32px;
}

.section-title {
  font-size: 1.2rem;
  font-weight: 600;
  margin-bottom: 16px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  gap: 8px;
}

.section-title .icon { color: var(--teal); }

/* ── Skill Table ─────────────────────────────────────────────────────── */

.skill-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
}

.skill-table th {
  text-align: left;
  padding: 12px 16px;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-secondary);
  background: var(--bg-secondary);
  border-bottom: 2px solid var(--border);
}

.skill-table th.num { text-align: center; }

.skill-table td {
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
  vertical-align: middle;
}

.skill-table td.num { text-align: center; font-family: var(--font-mono); }

.skill-table tr:hover td { background: var(--bg-hover); }

.score-cell {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.score-bar {
  width: 50px;
  height: 6px;
  background: var(--bg-primary);
  border-radius: 3px;
  overflow: hidden;
}

.score-bar-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.3s ease;
}

.grade-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  font-weight: 700;
  font-size: 0.85rem;
  font-family: var(--font-mono);
}

.grade-a { background: var(--green-bg); color: var(--green); border: 1px solid var(--green); }
.grade-b { background: var(--green-bg); color: var(--green); border: 1px solid var(--green); opacity: 0.8; }
.grade-c { background: var(--yellow-bg); color: var(--yellow); border: 1px solid var(--yellow); }
.grade-d { background: var(--orange-bg); color: var(--orange); border: 1px solid var(--orange); }
.grade-f { background: var(--red-bg); color: var(--red); border: 1px solid var(--red); }

/* ── Findings ────────────────────────────────────────────────────────── */

.finding {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  margin-bottom: 12px;
  overflow: hidden;
  transition: border-color 0.15s ease;
}

.finding:hover { border-color: var(--border-light); }

.finding-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  cursor: pointer;
  user-select: none;
}

.finding-header:hover { background: var(--bg-hover); }

.finding-chevron {
  color: var(--text-muted);
  transition: transform 0.2s ease;
  flex-shrink: 0;
  font-size: 0.85rem;
}

.finding.open .finding-chevron { transform: rotate(90deg); }

.severity-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 10px;
  border-radius: 12px;
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  flex-shrink: 0;
}

.severity-critical { background: var(--red-bg); color: var(--red); border: 1px solid var(--red); }
.severity-high     { background: var(--yellow-bg); color: var(--yellow); border: 1px solid var(--yellow); }
.severity-medium   { background: var(--orange-bg); color: var(--orange); border: 1px solid var(--orange); }
.severity-low      { background: var(--blue-bg); color: var(--blue); border: 1px solid var(--blue); }
.severity-info     { background: var(--bg-tertiary); color: var(--text-secondary); border: 1px solid var(--border); }

.finding-title {
  font-weight: 600;
  font-size: 0.9rem;
  flex: 1;
}

.finding-rule {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: var(--text-muted);
}

.finding-body {
  display: none;
  padding: 0 16px 16px 48px;
  font-size: 0.85rem;
  color: var(--text-secondary);
  line-height: 1.7;
}

.finding.open .finding-body { display: block; }

.finding-detail { margin-bottom: 8px; }
.finding-detail strong { color: var(--text-primary); font-weight: 500; }

.finding-location {
  font-family: var(--font-mono);
  font-size: 0.8rem;
  color: var(--teal);
}

.finding-evidence {
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 10px 14px;
  font-family: var(--font-mono);
  font-size: 0.8rem;
  margin: 8px 0;
  overflow-x: auto;
  color: var(--text-secondary);
}

.finding-remediation {
  background: var(--green-bg);
  border-left: 3px solid var(--green);
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
  padding: 10px 14px;
  margin-top: 8px;
  font-size: 0.85rem;
  color: var(--green);
}

/* ── Quality Metrics ─────────────────────────────────────────────────── */

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
  gap: 16px;
}

.metric-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 20px;
}

.metric-card h4 {
  font-size: 0.95rem;
  margin-bottom: 14px;
  color: var(--teal);
}

.metric-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 0;
  border-bottom: 1px solid var(--border);
  font-size: 0.85rem;
}

.metric-row:last-child { border-bottom: none; }

.metric-label { color: var(--text-secondary); }
.metric-value { font-family: var(--font-mono); font-weight: 500; }

.badge-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 12px;
}

.badge {
  display: inline-flex;
  align-items: center;
  padding: 3px 10px;
  border-radius: 12px;
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.badge-present { background: var(--green-bg); color: var(--green); border: 1px solid var(--green); }
.badge-missing { background: var(--bg-tertiary); color: var(--text-muted); border: 1px solid var(--border); }

/* ── Recommendations ─────────────────────────────────────────────────── */

.rec {
  display: flex;
  gap: 12px;
  padding: 14px 16px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  margin-bottom: 10px;
  font-size: 0.85rem;
}

.rec-effort {
  font-family: var(--font-mono);
  font-size: 0.7rem;
  padding: 2px 8px;
  border-radius: 10px;
  flex-shrink: 0;
  align-self: flex-start;
}

.effort-low    { background: var(--green-bg); color: var(--green); }
.effort-medium { background: var(--yellow-bg); color: var(--yellow); }
.effort-high   { background: var(--red-bg); color: var(--red); }

.rec-body { flex: 1; }
.rec-title { font-weight: 600; color: var(--text-primary); margin-bottom: 4px; }
.rec-desc  { color: var(--text-secondary); }
.rec-skill { font-size: 0.8rem; color: var(--text-muted); margin-top: 4px; }

/* ── Footer ──────────────────────────────────────────────────────────── */

.footer {
  margin-top: 48px;
  padding-top: 24px;
  border-top: 1px solid var(--border);
  text-align: center;
  color: var(--text-muted);
  font-size: 0.8rem;
}

.footer a { color: var(--teal); text-decoration: none; }
.footer a:hover { text-decoration: underline; }
`;

// ── JavaScript ──────────────────────────────────────────────────────────── //

const JS = `
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.finding-header').forEach(header => {
    header.addEventListener('click', () => {
      header.parentElement.classList.toggle('open');
    });
  });
});
`;

// ── HTML builders ───────────────────────────────────────────────────────── //

const scoreColor = (score: number): string => {
  if (score >= 80) return "var(--green)";
  if (score >= 60) return "var(--teal-dim)";
  if (score >= 40) return "var(--yellow)";
  return "var(--red)";
};

const renderGauge = (score: number): string => {
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  const offset = circumference - progress;
  const color = scoreColor(score);

  return `
    <div class="gauge-container">
      <div class="gauge">
        <svg viewBox="0 0 180 180">
          <circle class="gauge-bg" cx="90" cy="90" r="${radius}" />
          <circle class="gauge-fill" cx="90" cy="90" r="${radius}"
            stroke="${color}"
            stroke-dasharray="${circumference}"
            stroke-dashoffset="${offset}" />
        </svg>
        <div class="gauge-label">
          <div class="gauge-score" style="color:${color}">${Math.round(score)}</div>
          <div class="gauge-text">avg score</div>
        </div>
      </div>
    </div>`;
};

const renderDashboard = (summary: AuditSummary): string => {
  const cards = [
    {
      label: "Skills Scanned",
      value: summary.totalSkills,
      cls: "info",
    },
    {
      label: "Certified",
      value: summary.certifiedSkills,
      cls: "success",
    },
    {
      label: "Blocked",
      value: summary.blockedSkills,
      cls: summary.blockedSkills > 0 ? "critical" : "info",
    },
    {
      label: "Critical Findings",
      value: summary.criticalFindings,
      cls: summary.criticalFindings > 0 ? "critical" : "success",
    },
    {
      label: "High Findings",
      value: summary.highFindings,
      cls: summary.highFindings > 0 ? "warning" : "success",
    },
    {
      label: "Medium / Low",
      value: `${summary.mediumFindings} / ${summary.lowFindings}`,
      cls: "info",
    },
  ];

  return `
    <div class="dashboard">
      ${cards.map((c) => `
        <div class="stat-card ${c.cls}">
          <div class="stat-value">${c.value}</div>
          <div class="stat-label">${esc(c.label)}</div>
        </div>`).join("")}
    </div>`;
};

const renderScoreBar = (score: number): string => {
  const pct = Math.max(0, Math.min(100, score));
  return `
    <span class="score-cell">
      <span class="score-bar">
        <span class="score-bar-fill" style="width:${pct}%;background:${scoreColor(score)}"></span>
      </span>
      <span>${score}</span>
    </span>`;
};

const renderSkillTable = (results: SkillAuditResult[]): string => {
  const rows = results
    .map((r) => {
      const gc = gradeClass(r.score.grade);
      return `
        <tr>
          <td>${esc(r.skill.name)}</td>
          <td class="num">${renderScoreBar(r.score.overall)}</td>
          <td class="num">${r.score.security}</td>
          <td class="num">${r.score.quality}</td>
          <td class="num">${r.score.maintenance}</td>
          <td class="num"><span class="grade-badge ${gc}">${r.score.grade}</span></td>
          <td class="num">${r.securityFindings.length}</td>
        </tr>`;
    })
    .join("");

  return `
    <div class="section">
      <h3 class="section-title"><span class="icon">&#9881;</span> Skill Scores</h3>
      <table class="skill-table">
        <thead>
          <tr>
            <th>Skill</th>
            <th class="num">Overall</th>
            <th class="num">Security</th>
            <th class="num">Quality</th>
            <th class="num">Maint.</th>
            <th class="num">Grade</th>
            <th class="num">Findings</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
};

const renderFindingCard = (
  finding: SecurityFinding,
  skillName: string,
): string => {
  const loc =
    finding.file
      ? finding.line
        ? `${finding.file}:${finding.line}${finding.column ? `:${finding.column}` : ""}`
        : finding.file
      : null;

  return `
    <div class="finding">
      <div class="finding-header">
        <span class="finding-chevron">&#9654;</span>
        <span class="severity-badge ${severityClass(finding.severity)}">${esc(finding.severity)}</span>
        <span class="finding-title">${esc(finding.title)}</span>
        <span class="finding-rule">${esc(finding.rule)}</span>
      </div>
      <div class="finding-body">
        <div class="finding-detail"><strong>Skill:</strong> ${esc(skillName)}</div>
        <div class="finding-detail"><strong>Category:</strong> ${esc(finding.category)}</div>
        ${loc ? `<div class="finding-detail"><strong>Location:</strong> <span class="finding-location">${esc(loc)}</span></div>` : ""}
        <div class="finding-detail">${esc(finding.description)}</div>
        ${finding.evidence ? `<div class="finding-evidence">${esc(finding.evidence)}</div>` : ""}
        ${finding.remediation ? `<div class="finding-remediation">${esc(finding.remediation)}</div>` : ""}
      </div>
    </div>`;
};

const renderFindings = (results: SkillAuditResult[]): string => {
  const severityOrder: Record<Severity, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
    info: 4,
  };

  const allFindings: Array<{ skill: string; finding: SecurityFinding }> = [];
  for (const r of results) {
    for (const f of r.securityFindings) {
      allFindings.push({ skill: r.skill.name, finding: f });
    }
  }

  allFindings.sort(
    (a, b) =>
      severityOrder[a.finding.severity] - severityOrder[b.finding.severity],
  );

  if (allFindings.length === 0) {
    return `
      <div class="section">
        <h3 class="section-title"><span class="icon">&#128274;</span> Security Findings</h3>
        <p style="color:var(--green);padding:16px">&#10003; No security findings detected.</p>
      </div>`;
  }

  return `
    <div class="section">
      <h3 class="section-title"><span class="icon">&#128274;</span> Security Findings</h3>
      ${allFindings.map((f) => renderFindingCard(f.finding, f.skill)).join("")}
    </div>`;
};

const renderMetricCard = (r: SkillAuditResult): string => {
  const m = r.qualityMetrics;

  const metricRow = (label: string, value: string) =>
    `<div class="metric-row"><span class="metric-label">${esc(label)}</span><span class="metric-value">${esc(value)}</span></div>`;

  const badge = (label: string, present: boolean) =>
    `<span class="badge ${present ? "badge-present" : "badge-missing"}">${esc(label)}</span>`;

  return `
    <div class="metric-card">
      <h4>${esc(r.skill.name)}</h4>
      ${metricRow("Code Complexity", String(m.codeComplexity))}
      ${metricRow("Test Coverage", m.testCoverage !== null ? `${m.testCoverage}%` : "n/a")}
      ${metricRow("Documentation", `${m.documentationScore}%`)}
      ${metricRow("Maintenance Health", `${m.maintenanceHealth}%`)}
      ${metricRow("Dependencies", `${m.dependencyCount} (${m.outdatedDependencies} outdated)`)}
      ${metricRow("Lines of Code", String(m.linesOfCode))}
      <div class="badge-row">
        ${badge("README", m.hasReadme)}
        ${badge("LICENSE", m.hasLicense)}
        ${badge("TESTS", m.hasTests)}
        ${badge("TYPES", m.hasTypes)}
      </div>
    </div>`;
};

const renderQualityMetrics = (results: SkillAuditResult[]): string => {
  return `
    <div class="section">
      <h3 class="section-title"><span class="icon">&#9889;</span> Quality Metrics</h3>
      <div class="metrics-grid">
        ${results.map(renderMetricCard).join("")}
      </div>
    </div>`;
};

const renderRecommendations = (results: SkillAuditResult[]): string => {
  const allRecs = results.flatMap((r) =>
    r.recommendations.map((rec) => ({ skill: r.skill.name, rec })),
  );

  if (allRecs.length === 0) return "";

  const severityOrder: Record<Severity, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
    info: 4,
  };

  allRecs.sort(
    (a, b) => severityOrder[a.rec.priority] - severityOrder[b.rec.priority],
  );

  return `
    <div class="section">
      <h3 class="section-title"><span class="icon">&#128161;</span> Recommendations</h3>
      ${allRecs
        .map(
          ({ skill, rec }) => `
        <div class="rec">
          <span class="severity-badge ${severityClass(rec.priority)}">${esc(rec.priority)}</span>
          <span class="rec-effort effort-${rec.effort}">${esc(rec.effort)}</span>
          <div class="rec-body">
            <div class="rec-title">${esc(rec.title)}</div>
            <div class="rec-desc">${esc(rec.description)}</div>
            <div class="rec-skill">${esc(rec.category)} &middot; ${esc(skill)}</div>
          </div>
        </div>`,
        )
        .join("")}
    </div>`;
};

const renderPolicyViolations = (results: SkillAuditResult[]): string => {
  const all = results.flatMap((r) =>
    r.policyViolations.map((v) => ({ skill: r.skill.name, violation: v })),
  );

  if (all.length === 0) return "";

  return `
    <div class="section">
      <h3 class="section-title"><span class="icon">&#128220;</span> Policy Violations</h3>
      ${all
        .map(
          ({ skill, violation }) => `
        <div class="rec">
          <span class="severity-badge ${severityClass(violation.severity)}">${esc(violation.severity)}</span>
          <div class="rec-body">
            <div class="rec-title">${esc(violation.policy)}</div>
            <div class="rec-desc">${esc(violation.message)}</div>
            <div class="rec-skill">${esc(skill)}</div>
          </div>
        </div>`,
        )
        .join("")}
    </div>`;
};

// ── Public API ──────────────────────────────────────────────────────────── //

export const formatHtml = (report: AuditReport): string => {
  const ts = formatTimestamp(report.timestamp);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Agent Audit Report</title>
  <style>${CSS}</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Agent Audit</h1>
      <div class="subtitle">Security &amp; Quality Report</div>
      <div class="meta">
        <span>Report: ${esc(report.id)}</span>
        <span>Platform: ${esc(report.platform)}</span>
        <span>Generated: ${esc(ts)}</span>
      </div>
    </div>

    ${renderGauge(report.summary.averageScore)}
    ${renderDashboard(report.summary)}
    ${renderSkillTable(report.skills)}
    ${renderFindings(report.skills)}
    ${renderQualityMetrics(report.skills)}
    ${renderPolicyViolations(report.skills)}
    ${renderRecommendations(report.skills)}

    <div class="footer">
      Generated by <a href="https://github.com/agent-audit/agent-audit">Agent Audit</a>
    </div>
  </div>
  <script>${JS}</script>
</body>
</html>`;
};
