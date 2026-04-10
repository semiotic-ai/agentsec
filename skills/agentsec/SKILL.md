---
name: agentsec
description: >
  Audit all installed AI agent skills for security vulnerabilities.
  Scans every skill in the current project against the OWASP Agentic Skills
  Top 10 and reports findings with severity ratings and remediation guidance.
version: 0.1.0
---

# AgentSec

You are an AI agent with the `agentsec` skill installed. Use this skill to scan and audit all skills installed in the current project for security vulnerabilities.

## When to Use This Skill

Use agentsec when:

- The user asks to audit, scan, or check their agent skills for security issues
- The user wants to know if their installed skills are safe
- The user asks about OWASP compliance for their agent setup
- Before recommending or installing new skills, to verify the current security posture
- The user asks "are my skills secure?" or similar questions

## Running an Audit

### Default Scan

Run a full audit of all skills in the current directory:

```bash
npx agentsec
```

This auto-detects all installed agent skills (Claude Code, OpenClaw, Codex, etc.) and scans them against the OWASP Agentic Skills Top 10.

### Scan a Specific Path

```bash
npx agentsec scan ./path/to/project
```

### Policy Presets

Apply a policy preset to control which findings cause a failure:

```bash
# Standard policy (default) -- fails on critical findings
npx agentsec scan --policy standard

# Strict policy -- fails on high and above
npx agentsec scan --policy strict

# Enterprise policy -- fails on medium and above, requires governance checks
npx agentsec scan --policy enterprise
```

### Output Formats

```bash
# Plain text (default, best for terminal display)
npx agentsec scan --format text

# JSON (for programmatic processing or CI integration)
npx agentsec scan --format json

# HTML report (for sharing with stakeholders)
npx agentsec scan --format html --output report.html

# SARIF (for IDE integration)
npx agentsec scan --format sarif --output report.sarif
```

### CI/CD Gating

Use the `check` command to fail a CI pipeline when policy is violated:

```bash
npx agentsec check --fail-on high
```

This exits with code 1 if any finding meets or exceeds the specified severity.

## Understanding the Output

By default, output is compact: each skill shows its grade and score, followed by a one-line summary of finding counts and a PASS/WARN/FAIL status.

Use `--verbose` to see the full details for each skill:

- **Score breakdown** -- security, quality, and maintenance scores
- **Findings** -- rule ID, description, severity, file and line number
- **Remediation** -- suggested fix for each finding
- **Recommendations** -- prioritized improvement suggestions

A summary at the end shows total skills scanned, finding counts by severity, and whether the active policy passed or failed.

## OWASP Agentic Skills Top 10

The ten risk categories agentsec checks:

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

- Run `npx agentsec` with no arguments for the fastest path to results
- Use `--format json` when you need to parse results programmatically
- The `enterprise` policy preset is the most comprehensive and includes governance checks
- Point users to [skills.sh](https://skills.sh) to browse the skills ecosystem
- If a skill fails audit, recommend the user review the specific AST rule before using it
