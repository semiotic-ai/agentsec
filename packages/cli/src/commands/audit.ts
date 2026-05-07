/**
 * Main audit command.
 *
 * Discovers installed agent skills, scans each for security issues,
 * calculates quality metrics, evaluates policy rules, and generates
 * a full audit report.
 */

import type {
  AgentPlatform,
  AgentSkill,
  AuditReport,
  AuditSummary,
  PolicyConfig,
  PolicyViolation,
  QualityMetrics,
  Recommendation,
  SecurityFinding,
  SkillAuditResult,
  Web3DetectionResult,
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
  platformColor,
  platformLabel,
  prettyPath,
  severityBadge,
  success,
  warn,
} from "../ui";

// ---------------------------------------------------------------------------
// Skill discovery
// ---------------------------------------------------------------------------

/**
 * Zero-arg mode: no `--path` and no explicit `--platform`. In this mode the
 * CLI scans every known default location (Claude, OpenClaw, Codex, skills.sh)
 * rather than just one platform's defaults.
 */
function isAutoDiscoverMode(config: AuditConfig): boolean {
  return !config.path && !config.platformExplicit;
}

async function discoverSkills(config: AuditConfig): Promise<AgentSkill[]> {
  try {
    const openclaw = await import("@agentsec/openclaw");

    if (isAutoDiscoverMode(config)) {
      const discoverAll = openclaw.discoverAll ?? openclaw.default?.discoverAll;
      if (typeof discoverAll === "function") {
        return await discoverAll();
      }
      // Unit 7 hasn't landed yet -- fall through to single-platform discovery.
    }

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

/**
 * Pre-built scanner pair used to dispatch per-skill rule selection. The
 * `web3` scanner is null when the annex package can't be loaded (e.g.
 * during a development build before everything is installed). The CLI
 * always loads the annex if available — the audit is "Web3-aware by
 * default", and `--profile web3` only forces application onto every
 * skill regardless of detection.
 */
interface ScanContext {
  scanner: unknown;
  web3Scanner: unknown | null;
  detectFn: ((skill: AgentSkill) => Web3DetectionResult) | null;
}

async function buildScanContext(): Promise<ScanContext> {
  try {
    const scannerMod = await import("@agentsec/scanner");
    if (typeof scannerMod.Scanner !== "function") {
      return { scanner: null, web3Scanner: null, detectFn: null };
    }
    const scanner = new scannerMod.Scanner();

    let web3Scanner: unknown | null = null;
    let detectFn: ((skill: AgentSkill) => Web3DetectionResult) | null = null;
    try {
      const web3Mod = await import("@agentsec/web3");
      const rules = web3Mod.WEB3_RULES ?? web3Mod.default?.WEB3_RULES;
      const detect = web3Mod.detectWeb3 ?? web3Mod.default?.detectWeb3;
      if (rules && typeof detect === "function") {
        web3Scanner = new scannerMod.Scanner({ extraRules: rules as never });
        detectFn = detect as typeof detectFn;
      }
    } catch {
      // Annex not available — fall back to base scanner only.
    }

    return { scanner, web3Scanner, detectFn };
  } catch {
    return { scanner: null, web3Scanner: null, detectFn: null };
  }
}

/**
 * Run the security scanner against one skill, auto-detecting Web3 capability
 * and applying the AST-10 Web3 Annex rules when the skill is detected
 * (or when `--profile web3` forces application).
 */
async function scanSkillWithDetection(
  skill: AgentSkill,
  ctx: ScanContext,
  profile: AuditConfig["profile"],
): Promise<{ findings: SecurityFinding[]; web3?: Web3DetectionResult }> {
  let web3: Web3DetectionResult | undefined;
  let useWeb3Scanner = false;

  if (ctx.detectFn) {
    if (profile === "web3") {
      web3 = {
        detected: true,
        confidence: "definite",
        signals: ["forced by --profile web3"],
      };
      useWeb3Scanner = ctx.web3Scanner !== null;
    } else {
      const det = ctx.detectFn(skill);
      web3 = { detected: det.isWeb3, confidence: det.confidence, signals: det.signals };
      useWeb3Scanner = det.isWeb3 && ctx.web3Scanner !== null;
    }
  }

  const target = useWeb3Scanner ? ctx.web3Scanner : ctx.scanner;
  if (!target || typeof (target as { scan: unknown }).scan !== "function") {
    return { findings: [], web3 };
  }
  const findings = await (target as { scan: (s: AgentSkill) => Promise<SecurityFinding[]> }).scan(
    skill,
  );
  return { findings, web3 };
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
      md:
        report.skills.length >= 2 && reporter.formatComparisonMd
          ? reporter.formatComparisonMd
          : reporter.formatMd,
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

function printCompactSummary(
  summary: AuditSummary,
  web3Count = 0,
  results: SkillAuditResult[] = [],
): void {
  console.log();

  // One-line stats
  const parts = [
    `${summary.totalSkills} skill${summary.totalSkills === 1 ? "" : "s"} scanned`,
    `avg score ${color.bold(String(summary.averageScore))}`,
    `${color.green(String(summary.certifiedSkills))} certified`,
  ];
  if (web3Count > 0) {
    parts.push(`${color.cyan(String(web3Count))} ${color.cyan("Web3")}`);
  }
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

  // When critical findings exist, surface the worst-offender skills so the
  // reader has a concrete next step without having to run `--verbose`. We
  // show up to 3 \u2014 beyond that the value drops and the line wraps badly.
  if (summary.criticalFindings > 0 && results.length > 0) {
    const ranked = results
      .map((r) => ({
        skill: r.skill.name,
        critical: r.securityFindings.filter((f) => f.severity === "critical").length,
        topRule: (
          r.securityFindings.find((f) => f.severity === "critical")?.owaspId ?? ""
        ).toString(),
      }))
      .filter((r) => r.critical > 0)
      .sort((a, b) => b.critical - a.critical)
      .slice(0, 3);

    if (ranked.length > 0) {
      const summaries = ranked.map((r) => {
        const tag = r.topRule ? color.dim(` [${r.topRule}]`) : "";
        return `${color.bold(r.skill)}${tag} ${color.red(`${r.critical} critical`)}`;
      });
      console.log(`  ${color.dim("Worst:")} ${summaries.join(color.dim(", "))}`);
    }
  }
}

function printSkillResult(result: SkillAuditResult, verbose: boolean): void {
  console.log();
  const web3Tag = result.web3?.detected ? ` ${color.cyan(color.bold("[Web3]"))}` : "";
  console.log(
    `  ${color.bold(result.skill.name)} ${color.dim(`v${result.skill.version}`)}${web3Tag}  ` +
      formatGrade(result.score.grade, result.score.overall),
  );
  const platform = (result.skill.discoveredAs ?? null) as AgentPlatform | null;
  const prefix = platform
    ? `${platformColor(platform)(platformLabel(platform))} ${color.dim("·")} `
    : "";
  console.log(`  ${prefix}${color.dim(prettyPath(result.skill.path))}`);

  // Score breakdown
  keyValue("  Security", `${result.score.security}/100`);
  keyValue("  Quality", `${result.score.quality}/100`);
  keyValue("  Maintenance", `${result.score.maintenance}/100`);

  if (verbose && result.web3?.detected && result.web3.signals.length > 0) {
    console.log(`    ${color.cyan("Web3 signals:")} ${color.dim(result.web3.signals.join("; "))}`);
  }

  // Findings
  if (result.securityFindings.length > 0) {
    console.log();
    const sorted = [...result.securityFindings].sort((a, b) =>
      compareSeverity(a.severity, b.severity),
    );
    const toShow = verbose ? sorted : sorted.slice(0, 5);

    for (const finding of toShow) {
      const owaspTag = finding.owaspId ? ` ${color.dim(`[${finding.owaspId}]`)}` : "";
      console.log(`    ${severityBadge(finding.severity)} ${finding.title}${owaspTag}`);
      if (verbose && finding.description) {
        console.log(`      ${color.dim(finding.description)}`);
      }
      if (finding.file) {
        const loc = finding.line ? `${finding.file}:${finding.line}` : finding.file;
        console.log(`      ${color.dim(loc)}`);
      }
      if (verbose && finding.remediation) {
        console.log(`      ${color.cyan("Fix:")} ${color.dim(finding.remediation)}`);
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
  if (isAutoDiscoverMode(config)) {
    info("Searched default locations for Claude, OpenClaw, and Codex skills");
    info("Pass --path <dir> to scan a custom location");
  } else {
    info(
      `Looked for ${color.bold(config.platform)} skills${config.path ? ` in ${config.path}` : ""}`,
    );
    info("Use --platform to target a different agent platform");
    info("Use --path to specify a custom skill directory");
  }
  console.log();
}

/** Order platforms appear in output. `null` ("Other") comes last. */
const PLATFORM_ORDER: (AgentPlatform | null)[] = ["claude", "openclaw", "codex", null];

/**
 * Bucket skills by their `discoveredAs` platform. Unknown/missing
 * platforms land in the `null` bucket ("Other"). Buckets are returned
 * in a consistent order (claude, openclaw, codex, other).
 */
function groupByPlatform(skills: AgentSkill[]): Map<AgentPlatform | null, AgentSkill[]> {
  const buckets = new Map<AgentPlatform | null, AgentSkill[]>();
  for (const key of PLATFORM_ORDER) buckets.set(key, []);
  for (const skill of skills) {
    const key = (skill.discoveredAs ?? null) as AgentPlatform | null;
    const bucket = buckets.get(key) ?? [];
    bucket.push(skill);
    buckets.set(key, bucket);
  }
  for (const [key, bucket] of buckets) {
    if (bucket.length === 0) buckets.delete(key);
  }
  return buckets;
}

/**
 * Print a platform-grouped summary of where skills were found, with
 * per-root counts. Shown in zero-arg auto-discover mode. When no skill
 * carries a `sourceRoot` (legacy fallback), prints nothing.
 */
function printDiscoveryRoots(skills: AgentSkill[]): void {
  const roots = new Map<string, { platform: AgentPlatform | null; count: number }>();
  for (const skill of skills) {
    if (!skill.sourceRoot) continue;
    const existing = roots.get(skill.sourceRoot);
    if (existing) {
      existing.count += 1;
    } else {
      roots.set(skill.sourceRoot, {
        platform: (skill.discoveredAs ?? null) as AgentPlatform | null,
        count: 1,
      });
    }
  }
  if (roots.size === 0) return;

  const byPlatform = new Map<AgentPlatform | null, { root: string; count: number }[]>();
  for (const [root, { platform, count }] of roots) {
    const list = byPlatform.get(platform) ?? [];
    list.push({ root, count });
    byPlatform.set(platform, list);
  }

  const platformsOrdered = PLATFORM_ORDER.filter((p) => byPlatform.has(p));
  const platformNames = platformsOrdered.map((p) => platformLabel(p));
  info(
    `Scanned ${color.bold(String(roots.size))} location${roots.size === 1 ? "" : "s"} across ${platformNames.join(", ")}`,
  );
  for (const platform of platformsOrdered) {
    const entries = byPlatform.get(platform) ?? [];
    const badge = platformColor(platform)(platformLabel(platform));
    console.log(`    ${badge}`);
    for (const { root, count } of entries) {
      console.log(
        `      ${color.dim(prettyPath(root))} ${color.dim(`(${count} skill${count === 1 ? "" : "s"})`)}`,
      );
    }
  }
}

/**
 * Run step 1 of the audit: discover skills and print the "found N skills"
 * preamble. Returns `null` when zero skills were found (caller should exit
 * with the appropriate empty-report behavior).
 */
async function runDiscoveryStep(
  config: AuditConfig,
  isQuiet: boolean,
): Promise<AgentSkill[] | null> {
  const autoDiscover = isAutoDiscoverMode(config);
  const label = autoDiscover
    ? "Auto-discovering skills across all agent platforms..."
    : `Discovering ${config.platform} skills...`;
  const spinner = isQuiet ? noopSpinner : createSpinner(label);
  spinner.start();

  const skills = await discoverSkills(config);

  if (skills.length === 0) {
    spinner.fail("No agent skills found");
    return null;
  }

  spinner.succeed(
    `Found ${color.bold(String(skills.length))} skill${skills.length === 1 ? "" : "s"}`,
  );

  if (autoDiscover && !isQuiet) {
    printDiscoveryRoots(skills);
  }

  return skills;
}

/**
 * Scan a single skill: run the security scanner, compute metrics, build score,
 * evaluate policy, and generate recommendations. Returns the full audit result.
 */
async function auditOneSkill(
  skill: AgentSkill,
  policyConfig: PolicyConfig | null,
  config: AuditConfig,
  ctx: ScanContext,
): Promise<SkillAuditResult> {
  const { findings, web3 } = await scanSkillWithDetection(skill, ctx, config.profile);
  const qualityMetrics = await calculateMetrics(skill);
  const score = buildAuditScore(findings, qualityMetrics, qualityMetrics.maintenanceHealth);
  const result: SkillAuditResult = {
    skill,
    score,
    securityFindings: findings,
    qualityMetrics,
    policyViolations: [],
    recommendations: [],
    web3,
  };
  if (policyConfig) {
    result.policyViolations = await evaluatePolicy(policyConfig, result);
  }
  result.recommendations = generateRecommendations(findings, qualityMetrics);
  return result;
}

/**
 * Scan all skills with appropriate per-skill spinners, progress bar, and
 * platform-grouped subheadings in zero-arg auto-discover mode.
 */
async function runScanStep(
  skills: AgentSkill[],
  config: AuditConfig,
  policyConfig: PolicyConfig | null,
  isQuiet: boolean,
): Promise<{ results: SkillAuditResult[]; blockedCount: number }> {
  const results: SkillAuditResult[] = [];
  let blockedCount = 0;
  const autoDiscover = isAutoDiscoverMode(config);
  const groups = autoDiscover
    ? groupByPlatform(skills)
    : new Map<AgentPlatform | null, AgentSkill[]>([[null, skills]]);
  const showPlatformHeaders = autoDiscover && groups.size > 1;
  let scanned = 0;
  const ctx = await buildScanContext();

  for (const [platform, platformSkills] of groups) {
    if (showPlatformHeaders && !isQuiet) {
      const label = platformColor(platform)(platformLabel(platform));
      console.log();
      console.log(
        `  ${label} ${color.dim(`(${platformSkills.length} skill${platformSkills.length === 1 ? "" : "s"})`)}`,
      );
    }

    for (const skill of platformSkills) {
      scanned += 1;
      const scanSpinner = isQuiet
        ? noopSpinner
        : createSpinner(`Scanning ${color.bold(skill.name)} (${scanned}/${skills.length})...`);
      scanSpinner.start();

      const result = await auditOneSkill(skill, policyConfig, config, ctx);
      const isBlocked = result.policyViolations.some((v) => v.action === "block");
      if (isBlocked) blockedCount++;

      const web3Tag = result.web3?.detected ? ` ${color.cyan(color.bold("[Web3]"))}` : "";
      const line = `${skill.name} ${color.dim(`v${skill.version}`)}${web3Tag} ${formatGrade(result.score.grade, result.score.overall)}`;
      if (isBlocked) {
        scanSpinner.fail(`${line} ${color.red("BLOCKED")}`);
      } else {
        scanSpinner.succeed(line);
      }

      results.push(result);
    }
  }

  return { results, blockedCount };
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
  const skills = await runDiscoveryStep(config, isQuiet);
  if (skills === null) {
    if (!isQuiet) {
      printNoSkillsHint(config);
      return 0;
    }
    // For quiet modes, emit an empty but valid report so callers can parse stdout.
    if (!config.output) {
      const empty = buildEmptyReport(config.platform);
      try {
        const reporter = await import("@agentsec/reporter");
        const fmt = reporter.formatJson ?? reporter.default?.formatJson;
        console.log(typeof fmt === "function" ? fmt(empty) : JSON.stringify(empty, null, 2));
      } catch {
        console.log(JSON.stringify(empty, null, 2));
      }
    }
    return 0;
  }

  // 2. Load policy if specified
  const policyConfig = await loadPolicy(config.policy);
  if (!isQuiet) {
    if (config.policy && policyConfig) {
      success(`Loaded policy: ${color.bold(policyConfig.name)}`);
    } else if (config.policy) {
      warn(`Could not load policy: ${config.policy}`);
    }
  }

  // 3. Scan each skill, grouped by platform in zero-arg auto-discover mode
  if (!isQuiet) heading("Scanning Skills");

  const { results, blockedCount } = await runScanStep(skills, config, policyConfig, isQuiet);

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
  const web3Count = results.filter((r) => r.web3?.detected).length;
  if (config.format === "text") {
    if (config.verbose) {
      // Detailed per-skill output (findings, score breakdown, recommendations)
      for (const result of results) {
        printSkillResult(result, true);
      }
      printSummary(summary);
    } else {
      // Compact: skill grades already shown in spinners above
      printCompactSummary(summary, web3Count, results);
    }
    console.log();
  } else if (config.format === "json") {
    if (!config.output) {
      // Route stdout JSON through the reporter so the same redaction pass
      // (AST-W11 key-shaped substrings stripped from raw file contents)
      // applies whether the user pipes to a tool or writes to a file.
      try {
        const reporter = await import("@agentsec/reporter");
        const fmt = reporter.formatJson ?? reporter.default?.formatJson;
        console.log(typeof fmt === "function" ? fmt(report) : JSON.stringify(report, null, 2));
      } catch {
        console.log(JSON.stringify(report, null, 2));
      }
    }
  } else if (config.format === "sarif" || config.format === "html" || config.format === "md") {
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
