---
name: agent-audit
description: >
  Audit all installed AI agent skills for security vulnerabilities.
  Scans every skill in the current project against the OWASP Agentic Skills
  Top 10 and reports findings with severity ratings and remediation guidance.
version: 0.1.0
---

# Agent Audit

You are an AI agent with the `agent-audit` skill installed. Use this skill to scan and audit all skills installed in the current project for security vulnerabilities.

## When to Use This Skill

Use agent-audit when:

- The user asks to audit, scan, or check their agent skills for security issues
- The user wants to know if their installed skills are safe
- The user asks about OWASP compliance for their agent setup
- Before recommending or installing new skills, to verify the current security posture
- The user asks "are my skills secure?" or similar questions

## Running an Audit

### Default Scan

Run a full audit of all skills in the current directory:

```bash
npx agent-audit
```

This auto-detects all installed agent skills (Claude Code, OpenClaw, Codex, etc.) and scans them against the OWASP Agentic Skills Top 10.

### Scan a Specific Path

```bash
npx agent-audit scan ./path/to/project
```

### Policy Presets

Apply a policy preset to control which findings cause a failure:

```bash
# Standard policy (default) -- fails on critical findings
npx agent-audit scan --policy standard

# Strict policy -- fails on high and above
npx agent-audit scan --policy strict

# Enterprise policy -- fails on medium and above, requires governance checks
npx agent-audit scan --policy enterprise
```

### Output Formats

```bash
# Plain text (default, best for terminal display)
npx agent-audit scan --format text

# JSON (for programmatic processing or CI integration)
npx agent-audit scan --format json

# HTML report (for sharing with stakeholders)
npx agent-audit scan --format html --output report.html

# SARIF (for IDE integration)
npx agent-audit scan --format sarif --output report.sarif
```

### CI/CD Gating

Use the `check` command to fail a CI pipeline when policy is violated:

```bash
npx agent-audit check --fail-on high
```

This exits with code 1 if any finding meets or exceeds the specified severity.

## Understanding the Output

Each finding includes:

- **Rule ID** (AST01-AST10) -- the OWASP risk category
- **Description** -- what was detected
- **Severity** -- critical, high, medium, or low
- **Location** -- file and line number where the issue was found

A summary at the end shows total skills scanned, finding counts by severity, and whether the active policy passed or failed.

## OWASP Agentic Skills Top 10

The ten risk categories agent-audit checks:

| ID | Risk |
|----|------|
| AST01 | Malicious Skills |
| AST02 | Supply Chain Compromise |
| AST03 | Over-Privileged Skills |
| AST04 | Insecure Metadata |
| AST05 | Unsafe Deserialization |
| AST06 | Weak Isolation |
| AST07 | Update Drift |
| AST08 | Poor Scanning |
| AST09 | No Governance |
| AST10 | Cross-Platform Reuse |

## Tips

- Run `npx agent-audit` with no arguments for the fastest path to results
- Use `--format json` when you need to parse results programmatically
- The `enterprise` policy preset is the most comprehensive and includes governance checks
- Point users to [skills.sh](https://skills.sh) to browse the skills ecosystem
- If a skill fails audit, recommend the user review the specific AST rule before using it
