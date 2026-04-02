/**
 * Terminal / plain-text report formatter.
 *
 * Produces a richly-formatted, ANSI-colored report designed for direct
 * console output.  This is the default view users see when they run
 * `npx agent-audit`.
 */

import type {
  AuditReport,
  AuditSummary,
  SecurityFinding,
  Severity,
  SkillAuditResult,
} from "@agent-audit/shared";

import {
  bold,
  dim,
  italic,
  underline,
  cyan,
  gray,
  white,
  brightWhite,
  teal,
  red,
  green,
  brightGreen,
  brightRed,
  yellow,
  severityColor,
  gradeColor,
  padEnd,
  padStart,
  center,
  visibleLength,
  box,
  symbols,
  progressBar,
  scoreGauge,
} from "../colors.js";

// ── Helpers ──────────────────────────────────────────────────────────────── //

const TERM_WIDTH = Math.min(process.stdout.columns ?? 100, 120);

const hr = (char = box.horizontal, width = TERM_WIDTH): string =>
  dim(char.repeat(width));

const heading = (text: string): string => {
  const line = box.heavyHorizontal.repeat(TERM_WIDTH);
  return `\n${dim(line)}\n  ${bold(teal(text))}\n${dim(line)}`;
};

const subheading = (text: string): string =>
  `\n  ${bold(white(text))}\n  ${dim(box.horizontal.repeat(Math.min(visibleLength(text) + 4, TERM_WIDTH - 4)))}`;

const severityBadge = (severity: Severity): string => {
  const label = severity.toUpperCase();
  const color = severityColor(severity);
  return color(bold(` ${label} `));
};

const severityIcon = (severity: Severity): string => {
  switch (severity) {
    case "critical":
      return brightRed(symbols.cross);
    case "high":
      return yellow(symbols.warning);
    case "medium":
      return severityColor("medium")(symbols.warning);
    case "low":
      return severityColor("low")(symbols.info);
    case "info":
      return gray(symbols.info);
  }
};

const indent = (text: string, level: number = 1): string => {
  const prefix = "  ".repeat(level);
  return text
    .split("\n")
    .map((l) => prefix + l)
    .join("\n");
};

// ── Table renderer ──────────────────────────────────────────────────────── //

interface Column {
  header: string;
  width: number;
  align?: "left" | "right" | "center";
}

const renderTable = (columns: Column[], rows: string[][]): string => {
  const lines: string[] = [];
  const totalWidth =
    columns.reduce((sum, c) => sum + c.width, 0) + columns.length + 1;

  // Top border
  const topBorder =
    box.roundTopLeft +
    columns.map((c) => box.horizontal.repeat(c.width)).join(box.teeDown) +
    box.roundTopRight;
  lines.push(dim(topBorder));

  // Header row
  const headerCells = columns.map((col) => {
    return center(bold(col.header), col.width);
  });
  lines.push(
    dim(box.vertical) +
      headerCells.join(dim(box.vertical)) +
      dim(box.vertical),
  );

  // Header separator
  const sep =
    box.teeRight +
    columns.map((c) => box.heavyHorizontal.repeat(c.width)).join(box.cross) +
    box.teeLeft;
  lines.push(dim(sep));

  // Data rows
  for (const row of rows) {
    const cells = row.map((cell, i) => {
      const col = columns[i];
      const align = col.align ?? "left";
      if (align === "right") return padStart(cell, col.width);
      if (align === "center") return center(cell, col.width);
      return padEnd(cell, col.width);
    });
    lines.push(
      dim(box.vertical) +
        cells.join(dim(box.vertical)) +
        dim(box.vertical),
    );
  }

  // Bottom border
  const bottomBorder =
    box.roundBottomLeft +
    columns.map((c) => box.horizontal.repeat(c.width)).join(box.teeUp) +
    box.roundBottomRight;
  lines.push(dim(bottomBorder));

  return lines.join("\n");
};

// ── Banner ──────────────────────────────────────────────────────────────── //

const banner = (): string => {
  const art = [
    `    _                    _       _             _ _ _   `,
    `   / \\   __ _  ___ _ __ | |_    / \\  _   _  __| (_) |_ `,
    `  / _ \\ / _\` |/ _ \\ '_ \\| __|  / _ \\| | | |/ _\` | | __|`,
    ` / ___ \\ (_| |  __/ | | | |_  / ___ \\ |_| | (_| | | |_ `,
    `/_/   \\_\\__, |\\___|_| |_|\\__|/_/   \\_\\__,_|\\__,_|_|\\__|`,
    `        |___/                                          `,
  ];

  return (
    "\n" +
    art.map((line) => "  " + teal(line)).join("\n") +
    "\n" +
    center(dim("Security & Quality Auditing for AI Agent Skills"), TERM_WIDTH) +
    "\n"
  );
};

// ── Section renderers ──────────────────────────────────────────────────── //

const renderSummary = (summary: AuditSummary): string => {
  const lines: string[] = [];

  lines.push(heading("Audit Summary"));
  lines.push("");

  // Key metrics in a compact grid
  const scoreColor =
    summary.averageScore >= 80
      ? brightGreen
      : summary.averageScore >= 60
        ? green
        : summary.averageScore >= 40
          ? yellow
          : brightRed;

  const avgScoreBar = scoreGauge(Math.round(summary.averageScore), 30);

  lines.push(`  ${bold("Average Score")}  ${avgScoreBar}`);
  lines.push("");

  // Stats in two columns
  const leftCol = [
    `${teal(symbols.bullet)} Skills scanned:     ${bold(String(summary.totalSkills))}`,
    `${brightGreen(symbols.check)} Certified:          ${bold(green(String(summary.certifiedSkills)))}`,
    `${brightRed(symbols.cross)} Blocked:            ${bold(summary.blockedSkills > 0 ? red(String(summary.blockedSkills)) : String(summary.blockedSkills))}`,
  ];

  const rightCol = [
    `${brightRed(symbols.cross)} Critical findings:  ${bold(summary.criticalFindings > 0 ? red(String(summary.criticalFindings)) : String(summary.criticalFindings))}`,
    `${yellow(symbols.warning)} High findings:      ${bold(summary.highFindings > 0 ? yellow(String(summary.highFindings)) : String(summary.highFindings))}`,
    `${severityColor("medium")(symbols.warning)} Medium findings:    ${bold(String(summary.mediumFindings))}`,
  ];

  const maxLeft = Math.max(...leftCol.map(visibleLength));
  const gap = 6;

  for (let i = 0; i < Math.max(leftCol.length, rightCol.length); i++) {
    const left = leftCol[i] ?? "";
    const right = rightCol[i] ?? "";
    lines.push(`  ${padEnd(left, maxLeft + gap)}${right}`);
  }

  return lines.join("\n");
};

const renderSkillTable = (results: SkillAuditResult[]): string => {
  const lines: string[] = [];
  lines.push(heading("Skill Scores"));

  const columns: Column[] = [
    { header: " Skill", width: 30, align: "left" },
    { header: "Overall", width: 9, align: "center" },
    { header: "Security", width: 10, align: "center" },
    { header: "Quality", width: 9, align: "center" },
    { header: "Maint.", width: 9, align: "center" },
    { header: "Grade", width: 7, align: "center" },
    { header: "Findings", width: 10, align: "center" },
  ];

  const rows: string[][] = results.map((r) => {
    const name =
      " " +
      (r.skill.name.length > 28
        ? r.skill.name.slice(0, 27) + symbols.ellipsis
        : r.skill.name);
    const scoreVal = (score: number) => {
      const color =
        score >= 80
          ? brightGreen
          : score >= 60
            ? green
            : score >= 40
              ? yellow
              : brightRed;
      return color(String(score));
    };
    const grade = gradeColor(r.score.grade)(bold(r.score.grade));
    const findings = r.securityFindings.length;
    const findingsStr =
      findings === 0
        ? dim("0")
        : findings > 0 && r.securityFindings.some((f) => f.severity === "critical")
          ? red(bold(String(findings)))
          : yellow(String(findings));

    return [
      name,
      scoreVal(r.score.overall),
      scoreVal(r.score.security),
      scoreVal(r.score.quality),
      scoreVal(r.score.maintenance),
      grade,
      findingsStr,
    ];
  });

  lines.push("");
  lines.push(indent(renderTable(columns, rows)));

  return lines.join("\n");
};

const renderFindings = (results: SkillAuditResult[]): string => {
  const lines: string[] = [];

  // Collect all findings, sorted by severity
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

  if (allFindings.length === 0) {
    lines.push(heading("Security Findings"));
    lines.push("");
    lines.push(
      indent(`${brightGreen(symbols.check)} ${brightGreen("No security findings detected. Great job!")}`),
    );
    return lines.join("\n");
  }

  allFindings.sort(
    (a, b) =>
      severityOrder[a.finding.severity] - severityOrder[b.finding.severity],
  );

  lines.push(heading("Security Findings"));
  lines.push("");

  for (const { skill, finding } of allFindings) {
    const icon = severityIcon(finding.severity);
    const badge = severityBadge(finding.severity);
    const title = bold(white(finding.title));
    const rule = dim(`[${finding.rule}]`);

    lines.push(`  ${icon} ${badge} ${title} ${rule}`);
    lines.push(`    ${dim("Skill:")} ${cyan(skill)}`);

    if (finding.file) {
      const loc = finding.line
        ? `${finding.file}:${finding.line}${finding.column ? `:${finding.column}` : ""}`
        : finding.file;
      lines.push(`    ${dim("Location:")} ${underline(cyan(loc))}`);
    }

    lines.push(`    ${finding.description}`);

    if (finding.evidence) {
      lines.push(`    ${dim("Evidence:")} ${italic(dim(finding.evidence))}`);
    }

    if (finding.remediation) {
      lines.push(
        `    ${dim("Fix:")} ${green(finding.remediation)}`,
      );
    }

    lines.push("");
  }

  return lines.join("\n");
};

const renderQualityDetails = (results: SkillAuditResult[]): string => {
  const lines: string[] = [];
  lines.push(heading("Quality Metrics"));
  lines.push("");

  for (const r of results) {
    const m = r.qualityMetrics;
    lines.push(subheading(r.skill.name));
    lines.push("");

    const metrics = [
      ["Code complexity", String(m.codeComplexity), m.codeComplexity <= 10],
      ["Test coverage", m.testCoverage !== null ? `${m.testCoverage}%` : dim("n/a"), (m.testCoverage ?? 0) >= 60],
      ["Documentation", `${m.documentationScore}%`, m.documentationScore >= 50],
      ["Maintenance health", `${m.maintenanceHealth}%`, m.maintenanceHealth >= 60],
      ["Dependencies", `${m.dependencyCount} (${m.outdatedDependencies} outdated)`, m.outdatedDependencies === 0],
      ["Lines of code", String(m.linesOfCode), true],
    ] as const;

    for (const [label, value, ok] of metrics) {
      const icon = ok ? green(symbols.check) : yellow(symbols.warning);
      lines.push(`    ${icon} ${padEnd(dim(label), 25)} ${value}`);
    }

    // Badges
    const badges: string[] = [];
    if (m.hasReadme) badges.push(green("README"));
    if (m.hasLicense) badges.push(green("LICENSE"));
    if (m.hasTests) badges.push(green("TESTS"));
    if (m.hasTypes) badges.push(green("TYPES"));
    if (!m.hasReadme) badges.push(dim("README"));
    if (!m.hasLicense) badges.push(dim("LICENSE"));
    if (!m.hasTests) badges.push(dim("TESTS"));
    if (!m.hasTypes) badges.push(dim("TYPES"));

    // Deduplicate -- only show each label once (green wins over dim)
    const seen = new Set<string>();
    const uniqueBadges: string[] = [];
    for (const b of badges) {
      const plain = b.replace(/\x1b\[[0-9;]*m/g, "");
      if (!seen.has(plain)) {
        seen.add(plain);
        uniqueBadges.push(b);
      }
    }

    lines.push(`    ${dim("Badges:")} ${uniqueBadges.join(dim(" | "))}`);
    lines.push("");
  }

  return lines.join("\n");
};

const renderRecommendations = (results: SkillAuditResult[]): string => {
  const lines: string[] = [];

  const allRecs = results.flatMap((r) =>
    r.recommendations.map((rec) => ({ skill: r.skill.name, rec })),
  );

  if (allRecs.length === 0) return "";

  lines.push(heading("Recommendations"));
  lines.push("");

  // Group by priority
  const byPriority = new Map<Severity, typeof allRecs>();
  for (const item of allRecs) {
    const list = byPriority.get(item.rec.priority) ?? [];
    list.push(item);
    byPriority.set(item.rec.priority, list);
  }

  const order: Severity[] = ["critical", "high", "medium", "low", "info"];
  for (const priority of order) {
    const items = byPriority.get(priority);
    if (!items || items.length === 0) continue;

    for (const { skill, rec } of items) {
      const icon = severityIcon(priority);
      const effortBadge =
        rec.effort === "low"
          ? green("quick fix")
          : rec.effort === "medium"
            ? yellow("moderate")
            : red("significant");

      lines.push(
        `  ${icon} ${bold(rec.title)} ${dim("(")}${dim(rec.category)}${dim(")")} ${dim("[")}${effortBadge}${dim("]")}`,
      );
      lines.push(`    ${rec.description}`);
      lines.push(`    ${dim("Skill:")} ${cyan(skill)}`);
      lines.push("");
    }
  }

  return lines.join("\n");
};

const renderPolicyViolations = (results: SkillAuditResult[]): string => {
  const lines: string[] = [];

  const allViolations = results.flatMap((r) =>
    r.policyViolations.map((v) => ({ skill: r.skill.name, violation: v })),
  );

  if (allViolations.length === 0) return "";

  lines.push(heading("Policy Violations"));
  lines.push("");

  for (const { skill, violation } of allViolations) {
    const icon = severityIcon(violation.severity);
    const actionBadge =
      violation.action === "block"
        ? red(bold("BLOCKED"))
        : violation.action === "warn"
          ? yellow("WARNING")
          : dim("INFO");

    lines.push(
      `  ${icon} ${actionBadge} ${bold(violation.policy)} ${dim(symbols.arrowRight)} ${skill}`,
    );
    lines.push(`    ${violation.message}`);
    lines.push("");
  }

  return lines.join("\n");
};

const renderFooter = (report: AuditReport): string => {
  const lines: string[] = [];
  lines.push(hr());
  lines.push("");

  const ts = new Date(report.timestamp).toLocaleString();
  lines.push(
    `  ${dim("Report ID:")}   ${dim(report.id)}`,
  );
  lines.push(
    `  ${dim("Generated:")}   ${dim(ts)}`,
  );
  lines.push(
    `  ${dim("Platform:")}    ${dim(report.platform)}`,
  );
  lines.push("");
  lines.push(
    center(
      dim("Generated by ") + teal(bold("Agent Audit")),
      TERM_WIDTH,
    ),
  );
  lines.push("");

  return lines.join("\n");
};

// ── Public API ──────────────────────────────────────────────────────────── //

export const formatText = (report: AuditReport): string => {
  const sections: string[] = [
    banner(),
    renderSummary(report.summary),
    renderSkillTable(report.skills),
    renderFindings(report.skills),
    renderQualityDetails(report.skills),
    renderPolicyViolations(report.skills),
    renderRecommendations(report.skills),
    renderFooter(report),
  ];

  // Filter out empty sections
  return sections.filter(Boolean).join("\n");
};
