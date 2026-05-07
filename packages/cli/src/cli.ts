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
 *   report  Generate a report from saved audit JSON
 *   policy  Manage and inspect policy presets
 *   version Print version
 *   help    Show this help message
 */

import { AUDIT_VERSION } from "@agentsec/shared";
import { runAudit } from "./commands/audit";
import { runPolicy } from "./commands/policy";
import { runReport } from "./commands/report";
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
  console.log(`  ${color.cyan("report")}    Generate a report from saved audit JSON`);
  console.log(`  ${color.cyan("policy")}    Manage and inspect policy presets`);
  console.log(`  ${color.cyan("version")}   Print version`);
  console.log(`  ${color.cyan("help")}      Show this help message`);
  console.log();

  console.log(color.bold("OPTIONS"));
  console.log(
    `  ${color.cyan("-f, --format")}     Output: text, json, sarif, html, md ${color.dim("(default: text)")}`,
  );
  console.log(`  ${color.cyan("-o, --output")}     Write a single report to this file`);
  console.log(`  ${color.cyan("-p, --policy")}     Policy preset name or path to config file`);
  console.log(`  ${color.cyan("    --no-policy")}  Skip policy evaluation`);
  console.log(`  ${color.cyan("    --no-reports")} Skip the auto-written ./agentsec-report bundle`);
  console.log(
    `  ${color.cyan("    --platform")}   Narrow to one platform: openclaw, claude, codex`,
  );
  console.log(`  ${color.cyan("    --path")}       Custom skill directory to scan`);
  console.log(
    `  ${color.cyan("    --profile")}    Override auto-detect: web3 (force annex), strict`,
  );
  console.log(`  ${color.cyan("-v, --verbose")}    Show detailed output`);
  console.log(`  ${color.cyan("    --no-color")}   Disable colored output`);
  console.log(`  ${color.cyan("-h, --help")}       Show help`);
  console.log(`  ${color.cyan("-V, --version")}    Print version`);
  console.log();

  console.log(color.bold("AUTO-DISCOVERY"));
  console.log(`  Run with no flags to scan every default skill location on this machine:`);
  console.log(
    `    ${color.magenta("Claude Code")}   ${color.dim("~/.claude/skills, ./.claude/skills, ~/.claude/plugins/*/skills/*")}`,
  );
  console.log(
    `    ${color.cyan("OpenClaw")}      ${color.dim("~/.openclaw/workspace/skills, ~/.openclaw/skills")}`,
  );
  console.log(
    `    ${color.yellow("Codex")}         ${color.dim("~/.agents/skills, ./.agents/skills, /etc/codex/skills")}`,
  );
  console.log();

  console.log(color.bold("EXAMPLES"));
  console.log(`  ${color.dim("# Default: scan everything, write a full report bundle")}`);
  console.log(`  agentsec`);
  console.log();
  console.log(`  ${color.dim("# Audit a specific skill directory")}`);
  console.log(`  agentsec --path ./my-skills`);
  console.log();
  console.log(`  ${color.dim("# Strict policy with JSON output")}`);
  console.log(`  agentsec --policy strict --format json -o audit.json`);
  console.log();
  console.log(`  ${color.dim("# Generate an HTML report from a previous JSON audit")}`);
  console.log(`  agentsec report audit.json --format html --output report.html`);
  console.log();
  console.log(`  ${color.dim("AST-10 Web3 Annex (12 chain rules) auto-applies to web3 skills.")}`);
  console.log(`  ${color.dim("See https://github.com/markeljan/agentsec for full docs.")}`);
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

  // Backwards-compat: `scan` is now `audit --no-policy`. Warn on stderr and
  // re-route so existing scripts keep working without erroring.
  if (flags.command === "scan") {
    process.stderr.write("agentsec: 'scan' is deprecated; use 'audit --no-policy' instead.\n");
    flags.command = "audit";
    flags.skipPolicy = true;
  }

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
