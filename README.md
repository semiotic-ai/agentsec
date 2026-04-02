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

## Features

- **Scan** -- Detect vulnerabilities across agent skill manifests, metadata, and code
- **Score** -- Quantify security posture with risk scores mapped to OWASP AST10
- **Certify** -- Generate compliance reports for audit trails and governance

## Quick Start

```bash
# No install needed
npx agent-audit

# Or install globally
bun add -g agent-audit
```

## Usage

```bash
# Scan a skill directory
agent-audit scan ./skills

# Scan with a policy preset (standard | strict | enterprise)
agent-audit scan ./skills --policy strict

# Generate an HTML report
agent-audit report ./skills --format html --output report.html

# CI/CD gate -- fail on high-severity findings
agent-audit check ./skills --policy enterprise --fail-on high
```

## Example Output

```
  agent-audit v0.1.0

  Scanning ./skills (8 skills found)

  injection-vuln-skill
    FAIL  AST01  Malicious eval() call in src/index.ts:14       critical
    FAIL  AST05  Unsanitized JSON.parse from user input          high

  excessive-perms-skill
    WARN  AST03  Requests filesystem + network + exec            medium

  good-skill
    PASS  No findings

  Summary
    8 skills scanned, 12 findings (2 critical, 3 high, 5 medium, 2 low)
    Policy: strict -- FAILED
```

## OWASP Agentic Skills Top 10

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

## Configuration

Create an `agent-audit.config.ts` in your project root. See [DEMO.md](DEMO.md) for the full `defineConfig` reference and usage examples.

```bash
# Run the built-in demo against test fixtures
bun run demo
```

## Contributing

We welcome contributions. See [CONTRIBUTING.md](CONTRIBUTING.md) for monorepo structure, development setup, and guidelines.

```bash
git clone https://github.com/agent-audit/agent-audit.git
cd agent-audit
bun install && bun run build && bun run test
```

## License

[MIT](LICENSE)
