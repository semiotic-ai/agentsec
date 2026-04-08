/**
 * Scan command -- runs security scanning without policy evaluation.
 *
 * Outputs findings per skill, useful for CI pipelines or quick checks
 * where you just want the raw scan data.
 */

import type { AgentSkill, QualityMetrics, SecurityFinding } from "@agentsec/shared";
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
        return await discovery.scanDirectory(config.path);
      }
      return await discovery.discover(config.platform);
    }
  } catch {
    // Package not yet built
  }
  return [];
}

async function scanSkill(skill: AgentSkill): Promise<SecurityFinding[]> {
  try {
    const scanner = await import("@agentsec/scanner");
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
}

function printScanResult(result: ScanResult, verbose: boolean): void {
  const { skill, findings, metrics } = result;
  const score = buildAuditScore(findings, metrics, metrics.maintenanceHealth);

  console.log();
  console.log(
    `  ${color.bold(skill.name)} ${color.dim(`v${skill.version}`)}  ` +
      formatGrade(score.grade, score.overall),
  );
  console.log(`  ${color.dim(skill.path)}`);

  if (findings.length === 0) {
    info("  No security findings");
    return;
  }

  const sorted = [...findings].sort((a, b) => compareSeverity(a.severity, b.severity));
  const toShow = verbose ? sorted : sorted.slice(0, 10);

  for (const finding of toShow) {
    console.log(`    ${severityBadge(finding.severity)} ${finding.title}`);
    if (verbose) {
      if (finding.description) {
        console.log(`      ${color.dim(finding.description)}`);
      }
      if (finding.file) {
        const loc = finding.line ? `${finding.file}:${finding.line}` : finding.file;
        console.log(`      ${color.dim(loc)}`);
      }
      if (finding.remediation) {
        console.log(`      ${color.cyan("Fix:")} ${finding.remediation}`);
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

  for (let i = 0; i < skills.length; i++) {
    const skill = skills[i];
    const scanSpinner = createSpinner(
      `Scanning ${color.bold(skill.name)} (${i + 1}/${skills.length})...`,
    );
    scanSpinner.start();

    const findings = await scanSkill(skill);
    const metrics = await calculateMetrics(skill);
    totalFindings += findings.length;

    const critHigh = findings.filter(
      (f) => f.severity === "critical" || f.severity === "high",
    ).length;

    if (critHigh > 0) {
      scanSpinner.fail(
        `${skill.name} -- ${findings.length} finding(s), ${color.red(`${critHigh} critical/high`)}`,
      );
    } else if (findings.length > 0) {
      scanSpinner.succeed(`${skill.name} -- ${color.yellow(`${findings.length} finding(s)`)}`);
    } else {
      scanSpinner.succeed(`${skill.name} -- ${color.green("clean")}`);
    }

    results.push({ skill, findings, metrics });
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
