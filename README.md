<p align="center">
  <h1 align="center">Agent Audit</h1>
  <p align="center">
    <strong>Security scanning, scoring, and certification for AI agent skills</strong>
  </p>
  <p align="center">
    <a href="https://github.com/agent-audit/agent-audit/actions/workflows/ci.yml"><img src="https://github.com/agent-audit/agent-audit/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
    <a href="https://www.npmjs.com/package/agent-audit"><img src="https://img.shields.io/npm/v/agent-audit.svg" alt="npm version"></a>
    <a href="https://www.npmjs.com/package/agent-audit"><img src="https://img.shields.io/npm/dm/agent-audit.svg" alt="npm downloads"></a>
    <a href="https://github.com/agent-audit/agent-audit/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License: MIT"></a>
    <a href="https://owasp.org/www-project-agentic-skills-top-10/"><img src="https://img.shields.io/badge/OWASP-AST10-orange.svg" alt="OWASP AST10"></a>
  </p>
</p>

---

Agent Audit scans AI agent skills for security vulnerabilities, scores them against the OWASP Agentic Skills Top 10, and generates actionable compliance reports. Works with OpenClaw, Claude Code, Cursor, Codex, and VS Code skill ecosystems.

## Quick Start

```bash
npx agent-audit
```

That's it. Agent Audit will scan the current directory for agent skills and produce a security report.

## Features

- **Scan** -- Detect vulnerabilities across agent skill manifests, metadata, and code
- **Score** -- Quantify security posture with risk scores mapped to OWASP AST10
- **Certify** -- Generate compliance reports for audit trails and governance

## How It Works

```
1. Connect     Point agent-audit at a skill directory, registry, or manifest
                          |
2. Analyze     Static analysis, metadata validation, dependency auditing,
               permission modeling, and behavioral pattern detection
                          |
3. Report      HTML, JSON, or PDF reports with risk scores, findings,
               and remediation guidance
                          |
4. Enforce     Policy rules that gate CI/CD pipelines, block risky skills,
               and enforce organizational security standards
```

## Installation

```bash
# Global install
bun add -g agent-audit

# Or use npx (no install needed)
npx agent-audit

# Or add to your project
bun add -d agent-audit
```

## Usage

### Scan a directory

```bash
agent-audit scan ./skills
```

### Scan with a specific policy

```bash
agent-audit scan ./skills --policy strict
```

### Generate a report

```bash
agent-audit report ./skills --format html --output report.html
```

### Check against policy (CI/CD gate)

```bash
agent-audit check ./skills --policy enterprise --fail-on high
```

### Score a single skill

```bash
agent-audit score ./skills/my-skill/SKILL.md
```

## Configuration

Create an `agent-audit.config.ts` in your project root:

```typescript
import { defineConfig } from "agent-audit";

export default defineConfig({
  // Directories to scan
  include: ["./skills", "./agents"],

  // Policy preset: "standard" | "strict" | "enterprise"
  policy: "strict",

  // Fail threshold: "critical" | "high" | "medium" | "low"
  failOn: "high",

  // Output format: "html" | "json" | "pdf"
  format: "html",

  // OWASP AST10 categories to check (all enabled by default)
  rules: {
    "ast01-malicious-skills": "error",
    "ast02-supply-chain": "error",
    "ast03-over-privileged": "warn",
    "ast04-insecure-metadata": "warn",
    "ast05-unsafe-deserialization": "error",
    "ast06-weak-isolation": "error",
    "ast07-update-drift": "warn",
    "ast08-poor-scanning": "warn",
    "ast09-no-governance": "warn",
    "ast10-cross-platform": "info",
  },
});
```

## OWASP Agentic Skills Top 10 Coverage

Agent Audit provides full coverage of the [OWASP Agentic Skills Top 10](https://owasp.org/www-project-agentic-skills-top-10/):

| ID | Risk | What Agent Audit Checks |
|----|------|------------------------|
| AST01 | Malicious Skills | Behavioral pattern detection, known-malicious signature matching |
| AST02 | Supply Chain Compromise | Dependency analysis, provenance verification, transparency logs |
| AST03 | Over-Privileged Skills | Permission modeling, least-privilege validation |
| AST04 | Insecure Metadata | Schema validation, metadata integrity, provenance tracking |
| AST05 | Unsafe Deserialization | Parser safety analysis, sandboxed loading verification |
| AST06 | Weak Isolation | Container configuration, process isolation checks |
| AST07 | Update Drift | Version pinning validation, hash verification |
| AST08 | Poor Scanning | Scanning pipeline completeness, semantic analysis coverage |
| AST09 | No Governance | Inventory checks, audit log presence, policy enforcement |
| AST10 | Cross-Platform Reuse | Format compatibility, platform-specific validation |

## Monorepo Structure

```
agent-audit/
  packages/
    shared/       Shared types, constants, and utilities
    scanner/      Skill scanning engine and vulnerability detection
    metrics/      Security scoring and risk calculation
    policy/       Policy rules and compliance checking
    openclaw/     OpenClaw SKILL.md format parsing
    reporter/     Report generation (HTML, JSON, PDF)
    cli/          CLI entry point (published as "agent-audit")
  apps/
    dashboard/    Web-based security dashboard
```

## Contributing

We welcome contributions. See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

```bash
# Clone and set up
git clone https://github.com/agent-audit/agent-audit.git
cd agent-audit
bun install
bun run build
bun run test
```

## License

[MIT](LICENSE)
