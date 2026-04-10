/**
 * Main audit command.
 *
 * Discovers installed agent skills, scans each for security issues,
 * calculates quality metrics, evaluates policy rules, and generates
 * a full audit report.
 */

import type {
  AgentSkill,
  AuditReport,
  AuditSummary,
  PolicyConfig,
  PolicyViolation,
  QualityMetrics,
  Recommendation,
  SecurityFinding,
  SkillAuditResult,
} from "@agentsec/shared";
import { buildAuditScore, compareSeverity } from "@agentsec/shared";

import type { AuditConfig } from "../config";
import {
  color,
  createSpinner,
  formatGrade,
  heading,
  info,
  keyValue,
  noopSpinner,
  progressBar,
  severityBadge,
  success,
  warn,
} from "../ui";

// ---------------------------------------------------------------------------
// Skill discovery
// ---------------------------------------------------------------------------

async function discoverSkills(config: AuditConfig): Promise<AgentSkill[]> {
  try {
    const openclaw = await import("@agentsec/openclaw");

    // Use SkillDiscovery class which is the actual API
    const SkillDiscovery = openclaw.SkillDiscovery ?? openclaw.default?.SkillDiscovery;
    if (typeof SkillDiscovery === "function") {
      const discovery = new SkillDiscovery();
      if (config.path) {
        // Try --path as a single skill directory first (better UX than
        // forcing users to pass the parent directory). Fall back to parent-
        // directory scanning so `--path ./skills` still discovers many skills.
        const single = await discovery.parseSkill(config.path);
        if (single) return [single];
        return await discovery.scanDirectory(config.path);
      }
      return await discovery.discover(config.platform);
    }
  } catch {
    // Package not yet built -- return empty
  }
  return [];
}

// ---------------------------------------------------------------------------
// Scanning
// ---------------------------------------------------------------------------

async function scanSkill(skill: AgentSkill): Promise<SecurityFinding[]> {
  try {
    const scanner = await import("@agentsec/scanner");

    // Try class-based API first, then function-based
    if (typeof scanner.scanSkill === "function") {
      return await scanner.scanSkill(skill);
    }
    if (typeof scanner.Scanner === "function") {
      const s = new scanner.Scanner();
      return await s.scan(skill);
    }
    if (typeof scanner.default?.scanSkill === "function") {
      return await scanner.default.scanSkill(skill);
    }
  } catch {
    // Package not yet built
  }
  return [];
}

// ---------------------------------------------------------------------------
// Metrics
// ---------------------------------------------------------------------------

async function calculateMetrics(skill: AgentSkill): Promise<QualityMetrics> {
  try {
    const metrics = await import("@agentsec/metrics");

    // Use MetricsAnalyzer class which is the actual API
    const MetricsAnalyzer = metrics.MetricsAnalyzer ?? metrics.default?.MetricsAnalyzer;
    if (typeof MetricsAnalyzer === "function") {
      const analyzer = new MetricsAnalyzer();
      return await analyzer.analyze(skill);
    }
  } catch {
    // Package not yet built
  }

  // Sensible defaults when metrics package is unavailable
  return {
    codeComplexity: 0,
    testCoverage: null,
    documentationScore: 0,
    maintenanceHealth: 50,
    dependencyCount: Object.keys(skill.manifest.dependencies ?? {}).length,
    outdatedDependencies: 0,
    hasReadme: false,
    hasLicense: false,
    hasTests: false,
    hasTypes: false,
    linesOfCode: skill.files.reduce((sum, f) => sum + f.content.split("\n").length, 0),
  };
}

// ---------------------------------------------------------------------------
// Policy evaluation
// ---------------------------------------------------------------------------

async function loadPolicy(nameOrPath: string | null): Promise<PolicyConfig | null> {
  if (!nameOrPath) return null;

  try {
    const policy = await import("@agentsec/policy");

    // Try loading as a preset name first, then as a file path
    const getFn = policy.getPreset ?? policy.default?.getPreset;
    const loadFn = policy.loadPolicyFile ?? policy.default?.loadPolicyFile;

    if (typeof getFn === "function") {
      const preset = getFn(nameOrPath) as PolicyConfig | null;
      if (preset) return preset;
    }

    if (typeof loadFn === "function") {
      return await loadFn(nameOrPath);
    }
  } catch {
    // Package not yet implemented
  }
  return null;
}

async function evaluatePolicy(
  policyConfig: PolicyConfig,
  result: SkillAuditResult,
): Promise<PolicyViolation[]> {
  try {
    const policy = await import("@agentsec/policy");

    // Use PolicyEngine.evaluate() which is the actual API
    const PolicyEngine = policy.PolicyEngine ?? policy.default?.PolicyEngine;
    if (typeof PolicyEngine === "function") {
      const engine = new PolicyEngine(policyConfig);
      const evalResult = engine.evaluate(result);
      // The engine may return PolicyViolation[] directly or a result object
      if (Array.isArray(evalResult)) return evalResult;
      if (evalResult?.violations) return evalResult.violations;
    }

    // Fallback: use evaluateCondition per rule manually
    const evalCondition = policy.evaluateCondition ?? policy.default?.evaluateCondition;
    if (typeof evalCondition === "function") {
      const violations: PolicyViolation[] = [];
      for (const rule of policyConfig.rules) {
        const condResult = evalCondition(rule.condition, result);
        if (condResult.met) {
          violations.push({
            policy: rule.id,
            severity: rule.severity,
            message: `${rule.description}: ${condResult.reason}`,
            action: rule.action,
          });
        }
      }
      return violations;
    }
  } catch {
    // Package not yet implemented
  }
  return [];
}

// ---------------------------------------------------------------------------
// Recommendations
// ---------------------------------------------------------------------------

function generateRecommendations(
  findings: SecurityFinding[],
  metrics: QualityMetrics,
): Recommendation[] {
  const recs: Recommendation[] = [];

  // Security recommendations based on findings
  const critCount = findings.filter((f) => f.severity === "critical").length;
  const highCount = findings.filter((f) => f.severity === "high").length;

  if (critCount > 0) {
    recs.push({
      category: "security",
      priority: "critical",
      title: "Address critical security findings immediately",
      description: `${critCount} critical finding(s) were detected. These represent severe risks and should be resolved before deployment.`,
      effort: "high",
    });
  }

  if (highCount > 0) {
    recs.push({
      category: "security",
      priority: "high",
      title: "Resolve high-severity security findings",
      description: `${highCount} high-severity finding(s) require attention. These could lead to significant security breaches.`,
      effort: "medium",
    });
  }

  // Quality recommendations
  if (!metrics.hasTests) {
    recs.push({
      category: "quality",
      priority: "medium",
      title: "Add automated tests",
      description:
        "No test files were detected. Adding tests improves reliability and prevents regressions.",
      effort: "medium",
    });
  }

  if (!metrics.hasTypes) {
    recs.push({
      category: "quality",
      priority: "low",
      title: "Add type definitions",
      description:
        "No type definitions found. Type checking catches bugs early and improves developer experience.",
      effort: "low",
    });
  }

  if (!metrics.hasReadme) {
    recs.push({
      category: "maintenance",
      priority: "low",
      title: "Add a README file",
      description: "Documentation helps other developers understand the skill's purpose and usage.",
      effort: "low",
    });
  }

  if (metrics.outdatedDependencies > 0) {
    recs.push({
      category: "maintenance",
      priority: "medium",
      title: "Update outdated dependencies",
      description: `${metrics.outdatedDependencies} dependencies are outdated. Keeping them current reduces security risk.`,
      effort: "low",
    });
  }

  return recs;
}

// ---------------------------------------------------------------------------
// Report generation
// ---------------------------------------------------------------------------

async function writeReport(report: AuditReport, config: AuditConfig): Promise<void> {
  try {
    const reporter = await import("@agentsec/reporter");

    // Use ReportGenerator class or format functions
    const ReportGenerator = reporter.ReportGenerator ?? reporter.default?.ReportGenerator;
    if (typeof ReportGenerator === "function") {
      const generator = new ReportGenerator();
      const output = await generator.generate(report, config.format);
      if (config.output) {
        await Bun.write(
          config.output,
          typeof output === "string" ? output : JSON.stringify(output, null, 2),
        );
        info(`Report written to ${color.underline(config.output)}`);
      }
      return;
    }

    // Fallback to standalone format functions
    const formatFns: Record<string, ((r: AuditReport) => string) | undefined> = {
      text: reporter.formatText,
      json: reporter.formatJson,
      sarif: reporter.formatSarif,
      html: reporter.formatHtml,
    };
    const formatFn = formatFns[config.format];
    if (formatFn) {
      const output = formatFn(report);
      if (config.output) {
        await Bun.write(config.output, output);
        info(`Report written to ${color.underline(config.output)}`);
      }
      return;
    }
  } catch {
    // Reporter package not available -- fall through to JSON
  }

  // Fallback: write raw JSON if reporter is unavailable
  if (config.output) {
    await Bun.write(config.output, JSON.stringify(report, null, 2));
    info(`Report written to ${color.underline(config.output)}`);
  }
}

// ---------------------------------------------------------------------------
// Console output
// ---------------------------------------------------------------------------

function printSummary(summary: AuditSummary): void {
  heading("Audit Summary");

  keyValue("Skills scanned", String(summary.totalSkills));
  keyValue("Average score", String(summary.averageScore));
  keyValue("Certified skills", color.green(String(summary.certifiedSkills)));
  keyValue(
    "Blocked skills",
    summary.blockedSkills > 0 ? color.red(String(summary.blockedSkills)) : color.green("0"),
  );

  console.log();
  keyValue(
    "Critical findings",
    summary.criticalFindings > 0 ? color.red(String(summary.criticalFindings)) : color.dim("0"),
  );
  keyValue(
    "High findings",
    summary.highFindings > 0 ? color.red(String(summary.highFindings)) : color.dim("0"),
  );
  keyValue(
    "Medium findings",
    summary.mediumFindings > 0 ? color.yellow(String(summary.mediumFindings)) : color.dim("0"),
  );
  keyValue(
    "Low findings",
    summary.lowFindings > 0 ? color.cyan(String(summary.lowFindings)) : color.dim("0"),
  );
}

function printCompactSummary(summary: AuditSummary): void {
  console.log();

  // One-line stats
  const parts = [
    `${summary.totalSkills} skill${summary.totalSkills === 1 ? "" : "s"} scanned`,
    `avg score ${color.bold(String(summary.averageScore))}`,
    `${color.green(String(summary.certifiedSkills))} certified`,
  ];
  if (summary.blockedSkills > 0) {
    parts.push(color.red(`${summary.blockedSkills} blocked`));
  }
  console.log(`  ${parts.join(color.dim("  \u2022  "))}`);

  // Finding counts (only show if there are any)
  const totalFindings =
    summary.criticalFindings + summary.highFindings + summary.mediumFindings + summary.lowFindings;
  if (totalFindings > 0) {
    const findingParts: string[] = [];
    if (summary.criticalFindings > 0)
      findingParts.push(color.red(`${summary.criticalFindings} critical`));
    if (summary.highFindings > 0) findingParts.push(color.red(`${summary.highFindings} high`));
    if (summary.mediumFindings > 0)
      findingParts.push(color.yellow(`${summary.mediumFindings} medium`));
    if (summary.lowFindings > 0) findingParts.push(color.cyan(`${summary.lowFindings} low`));
    console.log(`  ${color.dim("Findings:")} ${findingParts.join(color.dim(", "))}`);
  }
}

function printSkillResult(result: SkillAuditResult, verbose: boolean): void {
  console.log();
  console.log(
    `  ${color.bold(result.skill.name)} ${color.dim(`v${result.skill.version}`)}  ` +
      formatGrade(result.score.grade, result.score.overall),
  );
  console.log(`  ${color.dim(result.skill.path)}`);

  // Score breakdown
  keyValue("  Security", `${result.score.security}/100`);
  keyValue("  Quality", `${result.score.quality}/100`);
  keyValue("  Maintenance", `${result.score.maintenance}/100`);

  // Findings
  if (result.securityFindings.length > 0) {
    console.log();
    const sorted = [...result.securityFindings].sort((a, b) =>
      compareSeverity(a.severity, b.severity),
    );
    const toShow = verbose ? sorted : sorted.slice(0, 5);

    for (const finding of toShow) {
      console.log(`    ${severityBadge(finding.severity)} ${finding.title}`);
      if (verbose && finding.description) {
        console.log(`      ${color.dim(finding.description)}`);
      }
      if (finding.file) {
        const loc = finding.line ? `${finding.file}:${finding.line}` : finding.file;
        console.log(`      ${color.dim(loc)}`);
      }
    }

    if (!verbose && sorted.length > 5) {
      console.log(color.dim(`    ... and ${sorted.length - 5} more (use --verbose to see all)`));
    }
  }

  // Policy violations
  if (result.policyViolations.length > 0) {
    console.log();
    for (const v of result.policyViolations) {
      const icon = v.action === "block" ? color.red("\u2718") : color.yellow("\u26a0");
      console.log(`    ${icon} [${v.action.toUpperCase()}] ${v.message}`);
    }
  }

  // Recommendations (verbose only)
  if (verbose && result.recommendations.length > 0) {
    console.log();
    console.log(color.dim("    Recommendations:"));
    for (const rec of result.recommendations) {
      console.log(
        `    ${color.cyan("\u2192")} ${rec.title} ${color.dim(`[${rec.effort} effort]`)}`,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Final status helpers (extracted to keep runAudit's complexity in check)
// ---------------------------------------------------------------------------

function printVerboseHint(verbose: boolean): void {
  if (!verbose) {
    console.log(color.dim("  Run with --verbose for detailed findings and recommendations."));
  }
}

function printBlockedStatus(blockedCount: number, verbose: boolean): void {
  console.log(
    color.bgRed(color.bold(` FAIL `)) +
      ` ${blockedCount} skill${blockedCount === 1 ? "" : "s"} blocked by policy`,
  );
  printVerboseHint(verbose);
  console.log();
}

function printPassOrWarnStatus(summary: AuditSummary, verbose: boolean): void {
  const highOrCritical = summary.criticalFindings + summary.highFindings;
  if (highOrCritical > 0) {
    console.log(
      `${color.yellow(color.bold(` WARN `))} ${highOrCritical} high/critical finding(s) detected`,
    );
  } else {
    console.log(`${color.bgGreen(color.bold(` PASS `))} All skills passed audit`);
  }
  printVerboseHint(verbose);
  console.log();
}

function printNoSkillsHint(config: AuditConfig): void {
  console.log();
  info(
    `Looked for ${color.bold(config.platform)} skills${config.path ? ` in ${config.path}` : ""}`,
  );
  info("Use --platform to target a different agent platform");
  info("Use --path to specify a custom skill directory");
  console.log();
}

function buildEmptyReport(platform: AuditConfig["platform"]): AuditReport {
  return {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    platform,
    skills: [],
    summary: {
      totalSkills: 0,
      averageScore: 0,
      criticalFindings: 0,
      highFindings: 0,
      mediumFindings: 0,
      lowFindings: 0,
      blockedSkills: 0,
      certifiedSkills: 0,
    },
  };
}

// ---------------------------------------------------------------------------
// Command entry point
// ---------------------------------------------------------------------------

export async function runAudit(config: AuditConfig): Promise<number> {
  // Quiet mode: machine-consumable formats skip all interactive chrome
  // (spinners, headings, progress bars, status messages). Only the final
  // report payload is emitted. Without this, stdout would be polluted and
  // callers like `agentsec audit --format json | jq` would fail.
  const isQuiet = config.format === "json" || config.format === "sarif";

  // 1. Discover skills
  const discoverSpinner = isQuiet
    ? noopSpinner
    : createSpinner(`Discovering ${config.platform} skills...`);
  discoverSpinner.start();

  const skills = await discoverSkills(config);

  if (skills.length === 0) {
    discoverSpinner.fail("No agent skills found");
    if (!isQuiet) {
      printNoSkillsHint(config);
      return 0;
    }
    // For quiet modes, emit an empty but valid report so callers can parse stdout.
    if (!config.output) console.log(JSON.stringify(buildEmptyReport(config.platform), null, 2));
    return 0;
  }

  discoverSpinner.succeed(
    `Found ${color.bold(String(skills.length))} skill${skills.length === 1 ? "" : "s"}`,
  );

  // 2. Load policy if specified
  const policyConfig = await loadPolicy(config.policy);
  if (!isQuiet) {
    if (config.policy && policyConfig) {
      success(`Loaded policy: ${color.bold(policyConfig.name)}`);
    } else if (config.policy) {
      warn(`Could not load policy: ${config.policy}`);
    }
  }

  // 3. Scan each skill
  if (!isQuiet) heading("Scanning Skills");

  const results: SkillAuditResult[] = [];
  let blockedCount = 0;

  for (let i = 0; i < skills.length; i++) {
    const skill = skills[i];
    const scanSpinner = isQuiet
      ? noopSpinner
      : createSpinner(`Scanning ${color.bold(skill.name)} (${i + 1}/${skills.length})...`);
    scanSpinner.start();

    // Run scanner
    const findings = await scanSkill(skill);

    // Calculate metrics
    const qualityMetrics = await calculateMetrics(skill);

    // Build score
    const score = buildAuditScore(findings, qualityMetrics, qualityMetrics.maintenanceHealth);

    // Build partial result for policy eval
    const result: SkillAuditResult = {
      skill,
      score,
      securityFindings: findings,
      qualityMetrics,
      policyViolations: [],
      recommendations: [],
    };

    // Evaluate policy
    if (policyConfig) {
      result.policyViolations = await evaluatePolicy(policyConfig, result);
    }

    // Generate recommendations
    result.recommendations = generateRecommendations(findings, qualityMetrics);

    // Check if blocked
    const isBlocked = result.policyViolations.some((v) => v.action === "block");
    if (isBlocked) blockedCount++;

    if (isBlocked) {
      scanSpinner.fail(
        `${skill.name} ${color.dim(`v${skill.version}`)} ` +
          formatGrade(score.grade, score.overall) +
          ` ${color.red("BLOCKED")}`,
      );
    } else {
      scanSpinner.succeed(
        `${skill.name} ${color.dim(`v${skill.version}`)} ` +
          formatGrade(score.grade, score.overall),
      );
    }

    results.push(result);

    // Show progress
    if (skills.length > 1 && !isQuiet) {
      process.stdout.write(`\r${progressBar(i + 1, skills.length)}`);
      if (i < skills.length - 1) process.stdout.write("\n");
    }
  }

  if (skills.length > 1 && !isQuiet) console.log();

  // 4. Build summary
  const summary: AuditSummary = {
    totalSkills: results.length,
    averageScore: Math.round(results.reduce((sum, r) => sum + r.score.overall, 0) / results.length),
    criticalFindings: results.reduce(
      (sum, r) => sum + r.securityFindings.filter((f) => f.severity === "critical").length,
      0,
    ),
    highFindings: results.reduce(
      (sum, r) => sum + r.securityFindings.filter((f) => f.severity === "high").length,
      0,
    ),
    mediumFindings: results.reduce(
      (sum, r) => sum + r.securityFindings.filter((f) => f.severity === "medium").length,
      0,
    ),
    lowFindings: results.reduce(
      (sum, r) => sum + r.securityFindings.filter((f) => f.severity === "low").length,
      0,
    ),
    blockedSkills: blockedCount,
    certifiedSkills: results.filter((r) => r.score.grade === "A" || r.score.grade === "B").length,
  };

  // 5. Build report
  const report: AuditReport = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    platform: config.platform,
    skills: results,
    summary,
  };

  // 6. Print results (text format to stdout)
  if (config.format === "text") {
    if (config.verbose) {
      // Detailed per-skill output (findings, score breakdown, recommendations)
      for (const result of results) {
        printSkillResult(result, true);
      }
      printSummary(summary);
    } else {
      // Compact: skill grades already shown in spinners above
      printCompactSummary(summary);
    }
    console.log();
  } else if (config.format === "json") {
    if (!config.output) {
      console.log(JSON.stringify(report, null, 2));
    }
  } else if (config.format === "sarif" || config.format === "html") {
    // Delegate to reporter package
    if (!config.output) {
      info(`Use --output to save ${config.format.toUpperCase()} reports to a file`);
    }
  }

  // 7. Write report file if requested
  if (config.output) {
    await writeReport(report, config);
  }

  // 8. Final status — part of the text report, skipped entirely in quiet modes
  if (blockedCount > 0) {
    if (!isQuiet) printBlockedStatus(blockedCount, config.verbose);
    return 1;
  }
  if (!isQuiet) printPassOrWarnStatus(summary, config.verbose);

  return 0;
}
