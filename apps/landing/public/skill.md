---
name: agentsec
description: >
  Audit AI agent skills for security vulnerabilities. Use when scanning
  installed skills against the OWASP Agentic Skills Top 10, checking skills
  before running them, gating CI/CD on skill safety, or generating audit
  reports (text, JSON, SARIF, HTML) for stakeholders.
version: 0.1.5
homepage: https://agentsec.sh
metadata:
  clawdbot:
    emoji: "🛡️"
    homepage: https://agentsec.sh
    requires:
      anyBins:
        - agentsec
        - npx
        - bunx
    install:
      - kind: node
        package: agentsec
        bins:
          - agentsec
        label: Install agentsec (npm)
---

# agentsec

`agentsec` is a security auditing CLI for AI agent skills. It scans every skill installed in a project against the OWASP Agentic Skills Top 10 and reports vulnerabilities, misconfigurations, and governance gaps.

## When to Use

Use `agentsec` when the user asks to:

- Audit, scan, or check agent skills for security issues
- Verify installed skills are safe before running them
- Check OWASP compliance of an agent setup
- Gate a CI/CD pipeline on skill security
- Generate a security report for stakeholders

## Quick Start

The fastest path to a result — no install, no flags:

```bash
npx agentsec
```

This scans every default skills directory on the machine — grouped by platform — plus any `./skills` folder in the current project (up to two levels deep), and audits each installed skill against the OWASP Agentic Skills Top 10. Always try this first.

### Auto-discovery locations

| Platform               | Paths scanned                                                                                                             |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **Claude Code**        | `~/.claude/skills`, `./.claude/skills`, `~/.claude/plugins/*/skills/*`, `~/.claude/commands`, `./.claude/commands`         |
| **OpenClaw / ClawHub** | `~/.openclaw/workspace/skills`, `~/.openclaw/workspace-*/skills` (profiles via `OPENCLAW_PROFILE`), `~/.openclaw/skills`  |
| **Codex / skills.sh**  | `~/.agents/skills`, `./.agents/skills`, `../.agents/skills`, `/etc/codex/skills`                                          |
| **Other** (generic)    | Any `skills/` directory found within the current project, up to two levels deep                                           |

## Core Commands

Every workflow starts from one of four commands. Run them with `npx agentsec` — no install needed.

```bash
# Full audit (scan + policy evaluation). Default command.
npx agentsec

# Scan only (no policy evaluation)
npx agentsec scan

# Generate a report from a previously saved audit JSON
npx agentsec report audit.json

# Manage and inspect policy presets
npx agentsec policy list
```

## Installation

`npx agentsec` needs no install. For repeated use, install globally:

```bash
# bun (recommended)
bun add -g agentsec

# npm
npm install -g agentsec

# pnpm
pnpm add -g agentsec

# yarn
yarn global add agentsec
```

Then drop the `npx` prefix:

```bash
agentsec
agentsec scan --path ./my-skills
```

## Flags

All flags work with any command.

| Flag         | Short | Values                          | Default    | Purpose                        |
| ------------ | ----- | ------------------------------- | ---------- | ------------------------------ |
| `--format`   | `-f`  | `text`, `json`, `sarif`, `html` | `text`     | Output format                  |
| `--output`   | `-o`  | path                            | stdout     | Write report to file           |
| `--policy`   | `-p`  | preset name or path             | `default`  | Apply a policy preset          |
| `--platform` |       | `openclaw`, `claude`, `codex`   | auto       | Narrow to one agent platform   |
| `--path`     |       | path                            | auto       | Custom skill directory to scan |
| `--verbose`  | `-v`  |                                 | off        | Show detailed findings         |
| `--no-color` |       |                                 | off        | Disable colored output         |
| `--help`     | `-h`  |                                 |            | Show help                      |
| `--version`  | `-V`  |                                 |            | Print version                  |

## Common Recipes

### Show detailed findings and remediation

```bash
npx agentsec --verbose
```

### Scan a specific directory

```bash
npx agentsec scan --path ./my-skills
```

### Target a specific agent platform

```bash
npx agentsec --platform claude
npx agentsec --platform codex
```

### Audit with a strict policy and save JSON

```bash
npx agentsec --policy strict --format json --output audit.json
```

### Generate an HTML report for stakeholders

```bash
npx agentsec --format html --output report.html
```

### Generate a SARIF report for IDE / code-scanning integration

```bash
npx agentsec --format sarif --output report.sarif
```

### List available policy presets

```bash
npx agentsec policy list
```

### Inspect the rules in a preset

```bash
npx agentsec policy show strict
```

### Validate a custom policy config file

```bash
npx agentsec policy validate ./my-policy.json
```

### Replay a previous audit as an HTML report

```bash
npx agentsec report audit.json --format html --output report.html
```

## Policy Presets

| Name                 | Use Case                                                             |
| -------------------- | -------------------------------------------------------------------- |
| `default`            | Balanced policy. Blocks critical findings.                           |
| `strict`             | Enterprise-grade. Blocks high and critical findings, enforces tests. |
| `permissive`         | Lenient. Only blocks critical CVEs. Good for development.            |
| `owasp-agent-top-10` | Built directly from the OWASP Agentic Skills Top 10.                 |

## Configuration File

`agentsec` auto-loads `.agentsecrc`, `.agentsecrc.json`, or `agentsec.config.json` from the current directory (or any parent):

```json
{
  "format": "text",
  "output": null,
  "policy": "strict",
  "verbose": false
}
```

CLI flags always override config file values. Omit `"platform"` and `"path"` to keep the default auto-discovery behavior — agentsec will scan every known platform's default locations.

## OWASP Agentic Skills Top 10

Every audit checks all ten risk categories:

| ID    | Risk                    |
| ----- | ----------------------- |
| AST01 | Malicious Skills        |
| AST02 | Supply Chain Compromise |
| AST03 | Over-Privileged Skills  |
| AST04 | Insecure Metadata       |
| AST05 | Unsafe Deserialization  |
| AST06 | Weak Isolation          |
| AST07 | Update Drift            |
| AST08 | Poor Scanning           |
| AST09 | No Governance           |
| AST10 | Cross-Platform Reuse    |

## Understanding the Output

Default output is compact: each skill shows its grade and score, followed by a one-line finding summary and a PASS/WARN/FAIL status.

```
✔ Found 6 skills

✔ fetch-data     v1.0.0  D (42)
✔ deploy-helper  v2.3.0  C (68)
✔ code-review    v1.1.0  A (95)

6 skills scanned  •  avg score 78  •  4 certified
Findings: 2 critical, 1 high, 2 medium

⚠ WARN  3 high/critical finding(s) detected
```

Use `--verbose` for score breakdowns, rule IDs, file/line locations, and remediation for each finding.

## Exit Codes

- `0` — audit passed the active policy
- `1` — policy violation or fatal error

Use the exit code directly to gate CI pipelines — no special flag required:

```bash
npx agentsec --policy strict || exit 1
```

## Tips

- Start with `npx agentsec` — no install, no flags. Iterate from there.
- Add `--verbose` whenever you need to act on specific findings.
- Pipe `--format json` into `jq` or a custom script for programmatic handling.
- `strict` is the most common preset for production repositories.
- Browse the agent skills ecosystem at [skills.sh](https://skills.sh).
