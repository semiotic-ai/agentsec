/**
 * Scan command -- runs security scanning without policy evaluation.
 *
 * Outputs findings per skill, useful for CI pipelines or quick checks
 * where you just want the raw scan data.
 */

import type {
  AgentSkill,
  QualityMetrics,
  SecurityFinding,
  Web3DetectionResult,
} from "@agentsec/shared";
import { buildAuditScore, compareSeverity } from "@agentsec/shared";

import type { AuditConfig } from "../config";
import {
  color,
  createSpinner,
  divider,
  formatGrade,
  heading,
  info,
  keyValue,
  severityBadge,
} from "../ui";

// ---------------------------------------------------------------------------
// Helpers (mirror audit.ts but skip policy)
// ---------------------------------------------------------------------------

async function discoverSkills(config: AuditConfig): Promise<AgentSkill[]> {
  try {
    const openclaw = await import("@agentsec/openclaw");
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
    // Package not yet built
  }
  return [];
}

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
      // Annex unavailable.
    }

    return { scanner, web3Scanner, detectFn };
  } catch {
    return { scanner: null, web3Scanner: null, detectFn: null };
  }
}

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

async function calculateMetrics(skill: AgentSkill): Promise<QualityMetrics> {
  try {
    const metrics = await import("@agentsec/metrics");
    const MetricsAnalyzer = metrics.MetricsAnalyzer ?? metrics.default?.MetricsAnalyzer;
    if (typeof MetricsAnalyzer === "function") {
      const analyzer = new MetricsAnalyzer();
      return await analyzer.analyze(skill);
    }
  } catch {
    // Package not yet built
  }
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
// Output
// ---------------------------------------------------------------------------

interface ScanResult {
  skill: AgentSkill;
  findings: SecurityFinding[];
  metrics: QualityMetrics;
  web3?: Web3DetectionResult;
}

function printScanResult(result: ScanResult, verbose: boolean): void {
  const { skill, findings, metrics } = result;
  const score = buildAuditScore(findings, metrics, metrics.maintenanceHealth);

  console.log();
  const web3Tag = result.web3?.detected ? ` ${color.cyan(color.bold("[Web3]"))}` : "";
  console.log(
    `  ${color.bold(skill.name)} ${color.dim(`v${skill.version}`)}${web3Tag}  ` +
      formatGrade(score.grade, score.overall),
  );
  console.log(`  ${color.dim(skill.path)}`);

  if (verbose && result.web3?.detected && result.web3.signals.length > 0) {
    console.log(`    ${color.cyan("Web3 signals:")} ${color.dim(result.web3.signals.join("; "))}`);
  }

  if (findings.length === 0) {
    info("  No security findings");
    return;
  }

  const sorted = [...findings].sort((a, b) => compareSeverity(a.severity, b.severity));
  const toShow = verbose ? sorted : sorted.slice(0, 10);

  for (const finding of toShow) {
    const owaspTag = finding.owaspId ? ` ${color.dim(`[${finding.owaspId}]`)}` : "";
    console.log(`    ${severityBadge(finding.severity)} ${finding.title}${owaspTag}`);
    if (verbose) {
      if (finding.description) {
        console.log(`      ${color.dim(finding.description)}`);
      }
      if (finding.file) {
        const loc = finding.line ? `${finding.file}:${finding.line}` : finding.file;
        console.log(`      ${color.dim(loc)}`);
      }
      if (finding.remediation) {
        console.log(`      ${color.cyan("Fix:")} ${color.dim(finding.remediation)}`);
      }
    }
  }

  if (!verbose && sorted.length > 10) {
    console.log(color.dim(`    ... and ${sorted.length - 10} more (use --verbose to see all)`));
  }
}

// ---------------------------------------------------------------------------
// Command entry point
// ---------------------------------------------------------------------------

export async function runScan(config: AuditConfig): Promise<number> {
  const spinner = createSpinner(`Discovering ${config.platform} skills...`);
  spinner.start();

  const skills = await discoverSkills(config);

  if (skills.length === 0) {
    spinner.fail("No agent skills found");
    console.log();
    info(
      `Looked for ${color.bold(config.platform)} skills${config.path ? ` in ${config.path}` : ""}`,
    );
    info("Use --platform to target a different agent platform");
    info("Use --path to specify a custom skill directory");
    console.log();
    return 0;
  }

  spinner.succeed(
    `Found ${color.bold(String(skills.length))} skill${skills.length === 1 ? "" : "s"}`,
  );

  heading("Security Scan");

  const results: ScanResult[] = [];
  let totalFindings = 0;
  const ctx = await buildScanContext();

  for (let i = 0; i < skills.length; i++) {
    const skill = skills[i];
    const scanSpinner = createSpinner(
      `Scanning ${color.bold(skill.name)} (${i + 1}/${skills.length})...`,
    );
    scanSpinner.start();

    const { findings, web3 } = await scanSkillWithDetection(skill, ctx, config.profile);
    const metrics = await calculateMetrics(skill);
    totalFindings += findings.length;

    const critHigh = findings.filter(
      (f) => f.severity === "critical" || f.severity === "high",
    ).length;

    const web3Tag = web3?.detected ? ` ${color.cyan(color.bold("[Web3]"))}` : "";
    if (critHigh > 0) {
      scanSpinner.fail(
        `${skill.name}${web3Tag} -- ${findings.length} finding(s), ${color.red(`${critHigh} critical/high`)}`,
      );
    } else if (findings.length > 0) {
      scanSpinner.succeed(
        `${skill.name}${web3Tag} -- ${color.yellow(`${findings.length} finding(s)`)}`,
      );
    } else {
      scanSpinner.succeed(`${skill.name}${web3Tag} -- ${color.green("clean")}`);
    }

    results.push({ skill, findings, metrics, web3 });
  }

  // Print results (text format)
  if (config.format === "text") {
    if (config.verbose) {
      // Detailed per-skill output
      for (const result of results) {
        printScanResult(result, true);
      }
    }
    console.log();
    console.log(divider());
    keyValue("Total skills scanned", String(results.length));
    keyValue("Total findings", String(totalFindings));
    if (!config.verbose && totalFindings > 0) {
      console.log(color.dim("  Run with --verbose for detailed findings."));
    }
    console.log();
  } else if (config.format === "json") {
    const output = results.map((r) => ({
      skill: { id: r.skill.id, name: r.skill.name, version: r.skill.version, path: r.skill.path },
      findings: r.findings,
    }));
    if (!config.output) {
      console.log(JSON.stringify(output, null, 2));
    } else {
      await Bun.write(config.output, JSON.stringify(output, null, 2));
      info(`Scan results written to ${color.underline(config.output)}`);
    }
  }

  return 0;
}
