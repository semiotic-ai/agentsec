#!/usr/bin/env bun

/**
 * agentsec CLI
 *
 * Security auditing for AI agent skills.
 *
 * Usage:
 *   agentsec [command] [options]
 *
 * Commands:
 *   audit   (default) Run a full security audit
 *   scan    Run security scan only (no policy evaluation)
 *   report  Generate a report from saved audit JSON
 *   policy  Manage and inspect policy presets
 *   version Print version
 *   help    Show this help message
 */

import { AUDIT_VERSION } from "@agentsec/shared";
import { runAudit } from "./commands/audit";
import { runPolicy } from "./commands/policy";
import { runReport } from "./commands/report";
import { runScan } from "./commands/scan";
import { parseFlags, resolveConfig } from "./config";
import { color, error, info, printBanner } from "./ui";

// ---------------------------------------------------------------------------
// Help text
// ---------------------------------------------------------------------------

function printHelp(): void {
  printBanner(AUDIT_VERSION);

  console.log(color.bold("USAGE"));
  console.log(`  agentsec [command] [options]`);
  console.log();

  console.log(color.bold("COMMANDS"));
  console.log(`  ${color.cyan("audit")}     Run a full security audit ${color.dim("(default)")}`);
  console.log(`  ${color.cyan("scan")}      Run security scan only (no policy evaluation)`);
  console.log(`  ${color.cyan("report")}    Generate a report from saved audit JSON`);
  console.log(`  ${color.cyan("policy")}    Manage and inspect policy presets`);
  console.log(`  ${color.cyan("version")}   Print version`);
  console.log(`  ${color.cyan("help")}      Show this help message`);
  console.log();

  console.log(color.bold("OPTIONS"));
  console.log(
    `  ${color.cyan("-f, --format")}     Output format: text, json, sarif, html ${color.dim("(default: text)")}`,
  );
  console.log(`  ${color.cyan("-o, --output")}     Write report to file`);
  console.log(`  ${color.cyan("-p, --policy")}     Policy preset name or path to config file`);
  console.log(
    `  ${color.cyan("    --platform")}   Agent platform: openclaw, claude, codex ${color.dim("(default: openclaw)")}`,
  );
  console.log(`  ${color.cyan("    --path")}       Custom skill directory to scan`);
  console.log(`  ${color.cyan("-v, --verbose")}    Show detailed output`);
  console.log(`  ${color.cyan("    --no-color")}   Disable colored output`);
  console.log(`  ${color.cyan("-h, --help")}       Show help`);
  console.log(`  ${color.cyan("-V, --version")}    Print version`);
  console.log();

  console.log(color.bold("EXAMPLES"));
  console.log(`  ${color.dim("# Audit all installed OpenClaw skills")}`);
  console.log(`  agentsec`);
  console.log();
  console.log(`  ${color.dim("# Audit with strict policy, output JSON")}`);
  console.log(`  agentsec --policy strict --format json --output audit.json`);
  console.log();
  console.log(`  ${color.dim("# Scan a specific directory")}`);
  console.log(`  agentsec scan --path ./my-skills`);
  console.log();
  console.log(`  ${color.dim("# Generate HTML report from previous audit")}`);
  console.log(`  agentsec report audit.json --format html --output report.html`);
  console.log();
  console.log(`  ${color.dim("# List available policies")}`);
  console.log(`  agentsec policy list`);
  console.log();
}

function printVersion(): void {
  console.log(`agentsec v${AUDIT_VERSION}`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const flags = parseFlags(Bun.argv);
  const config = await resolveConfig(flags);

  let exitCode = 0;

  switch (flags.command) {
    case "help":
      printHelp();
      break;

    case "version":
      printVersion();
      break;

    case "audit":
      printBanner(AUDIT_VERSION);
      exitCode = await runAudit(config);
      break;

    case "scan":
      printBanner(AUDIT_VERSION);
      exitCode = await runScan(config);
      break;

    case "report":
      printBanner(AUDIT_VERSION);
      exitCode = await runReport(config, flags.args);
      break;

    case "policy":
      printBanner(AUDIT_VERSION);
      exitCode = await runPolicy(config, flags.args);
      break;

    default:
      error(`Unknown command: ${flags.command}`);
      info("Run 'agentsec help' for usage information");
      exitCode = 1;
  }

  process.exit(exitCode);
}

main().catch((err) => {
  error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
