/**
 * Report command -- generates a formatted report from a saved audit JSON file.
 *
 * Usage:
 *   agentsec report <audit.json> [--format html] [--output report.html]
 */

import type { AuditReport } from "@agentsec/shared";

import type { AuditConfig } from "../config";
import { color, createSpinner, error, formatGrade, heading, info, keyValue, success } from "../ui";

// ---------------------------------------------------------------------------
// Command entry point
// ---------------------------------------------------------------------------

export async function runReport(config: AuditConfig, args: string[]): Promise<number> {
  const inputPath = args[0];

  if (!inputPath) {
    error("No input file specified");
    console.log();
    console.log(
      `  ${color.bold("Usage:")} agentsec report <audit.json> [--format html] [--output report.html]`,
    );
    console.log();
    console.log("  Generate a formatted report from a previously saved audit JSON file.");
    console.log();
    console.log(`  ${color.bold("Examples:")}`);
    console.log(`    agentsec report audit-results.json`);
    console.log(`    agentsec report audit-results.json --format html --output report.html`);
    console.log(`    agentsec report audit-results.json --format sarif --output results.sarif`);
    console.log();
    return 1;
  }

  // Load audit JSON
  const spinner = createSpinner(`Loading ${inputPath}...`);
  spinner.start();

  let report: AuditReport;
  try {
    const file = Bun.file(inputPath);
    if (!(await file.exists())) {
      spinner.fail(`File not found: ${inputPath}`);
      return 1;
    }
    const text = await file.text();
    report = JSON.parse(text) as AuditReport;
  } catch (err) {
    spinner.fail(`Failed to parse ${inputPath}`);
    error(err instanceof Error ? err.message : String(err));
    return 1;
  }

  // Validate basic structure
  if (!report.skills || !Array.isArray(report.skills) || !report.summary) {
    spinner.fail("Invalid audit report format");
    error("The file does not appear to be a valid agentsec report.");
    return 1;
  }

  spinner.succeed(
    `Loaded audit report: ${color.bold(String(report.skills.length))} skills, ` +
      `${color.dim(report.timestamp)}`,
  );

  // Generate report in requested format
  if (config.format === "text") {
    // Print summary to stdout
    heading("Audit Report");
    keyValue("Report ID", report.id);
    keyValue("Timestamp", report.timestamp);
    keyValue("Platform", report.platform);
    keyValue("Skills scanned", String(report.summary.totalSkills));
    keyValue("Average score", String(report.summary.averageScore));
    keyValue("Certified skills", color.green(String(report.summary.certifiedSkills)));
    keyValue(
      "Blocked skills",
      report.summary.blockedSkills > 0
        ? color.red(String(report.summary.blockedSkills))
        : color.green("0"),
    );
    keyValue("Critical findings", String(report.summary.criticalFindings));
    keyValue("High findings", String(report.summary.highFindings));

    console.log();
    heading("Skills");

    for (const result of report.skills) {
      console.log(
        `  ${color.bold(result.skill.name)} ${color.dim(`v${result.skill.version}`)}  ` +
          formatGrade(result.score.grade, result.score.overall),
      );
    }
    console.log();
  }

  // Attempt to use reporter package for non-text formats
  if (config.format !== "text" || config.output) {
    try {
      const reporter = await import("@agentsec/reporter");

      // Use ReportGenerator class or standalone format functions
      const ReportGenerator = reporter.ReportGenerator ?? reporter.default?.ReportGenerator;
      if (typeof ReportGenerator === "function") {
        const generator = new ReportGenerator();
        const output = await generator.generate(report, config.format);
        const outputStr = typeof output === "string" ? output : JSON.stringify(output, null, 2);
        if (config.output) {
          await Bun.write(config.output, outputStr);
          success(`Report written to ${color.underline(config.output)}`);
        } else if (config.format !== "text") {
          console.log(outputStr);
        }
        return 0;
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
          success(`Report written to ${color.underline(config.output)}`);
        } else if (config.format !== "text") {
          console.log(output);
        }
        return 0;
      }
    } catch {
      // Reporter not available
    }

    // Fallback: write JSON
    if (config.output) {
      await Bun.write(config.output, JSON.stringify(report, null, 2));
      info(`Report written as JSON to ${color.underline(config.output)}`);
    } else if (config.format === "json") {
      console.log(JSON.stringify(report, null, 2));
    } else {
      info(`${config.format.toUpperCase()} format requires the @agentsec/reporter package`);
    }
  }

  return 0;
}
