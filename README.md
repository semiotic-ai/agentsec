<p align="center">
  <img src="./assets/banner.svg" alt="Agent Audit Banner" width="100%">
</p>

<h1 align="center">Agent Audit</h1>
<p align="center">
  <strong>Audit every skill your AI agents run.</strong>
</p>

<p align="center">
  <a href="https://github.com/semiotic-agentium/agent-audit">
    <img src="https://img.shields.io/github/stars/semiotic-agentium/agent-audit.svg?style=social" alt="GitHub stars">
  </a>
  <a href="https://github.com/semiotic-agentium/agent-audit/blob/main/LICENSE">
    <img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License: MIT">
  </a>
  <a href="https://owasp.org/www-project-agentic-skills-top-10/">
    <img src="https://img.shields.io/badge/OWASP-AST10-orange.svg" alt="OWASP AST10">
  </a>
  <a href="https://skills.sh">
    <img src="https://img.shields.io/badge/skills.sh-ecosystem-purple.svg" alt="skills.sh">
  </a>
</p>

---

Install one skill. Every skill your agent uses gets audited automatically against the [OWASP Agentic Skills Top 10](https://owasp.org/www-project-agentic-skills-top-10/).

Supports **Claude Code**, **OpenClaw**, **Codex**, and more coming soon.

## Quick Start

```bash
npx agentsec
```

That's it. Scans your current directory, finds every installed skill, and reports what it finds.

### Example Output

```
  ✔ Found 6 skills

  ✔ fetch-data     v1.0.0  D (42)
  ✔ deploy-helper  v2.3.0  C (68)
  ✔ code-review    v1.1.0  A (95)
  ✔ summarize-docs v0.9.0  A (91)
  ✔ db-migrate     v1.4.2  B (78)
  ✔ lint-fix       v2.0.0  A (93)

  6 skills scanned  •  avg score 78  •  4 certified
  Findings: 2 critical, 1 high, 2 medium

  ⚠ WARN  3 high/critical finding(s) detected
  Run with --verbose for detailed findings and recommendations.
```

## CLI Commands

```bash
# Scan current directory (auto-detects agent skills)
npx agentsec

# Show detailed findings, score breakdowns, and recommendations
npx agentsec --verbose

# Scan a specific path
npx agentsec scan ./my-project

# Apply a policy preset
npx agentsec scan --policy strict
npx agentsec scan --policy enterprise

# Output formats
npx agentsec scan --format json
npx agentsec scan --format html --output report.html

# CI/CD gate -- exit 1 on policy violation
npx agentsec check --fail-on high
```

See [`examples/`](./examples/) for full report samples in HTML, JSON, SARIF, and text formats.

## OWASP Agentic Skills Top 10

Every scan checks for all 10 risk categories:

| ID        | Risk                    | What We Detect                                          |
| --------- | ----------------------- | ------------------------------------------------------- |
| **AST01** | Malicious Skills        | Dangerous code patterns, known-malicious signatures     |
| **AST02** | Supply Chain Compromise | Dependency provenance, transparency log gaps            |
| **AST03** | Over-Privileged Skills  | Excessive permission grants, least-privilege violations |
| **AST04** | Insecure Metadata       | Schema validation failures, metadata integrity issues   |
| **AST05** | Unsafe Deserialization  | Parser safety gaps, injection vectors                   |
| **AST06** | Weak Isolation          | Missing sandboxing, container misconfigurations         |
| **AST07** | Update Drift            | Unpinned versions, stale dependencies, hash mismatches  |
| **AST08** | Poor Scanning           | Coverage gaps, incomplete scanning pipelines            |
| **AST09** | No Governance           | Missing audit logs, absent policy enforcement           |
| **AST10** | Cross-Platform Reuse    | Platform-specific validation gaps, portability issues   |

## Supported Agents

- **Claude Code** -- scans installed skills and MCP servers
- **OpenClaw** -- full SKILL.md manifest analysis
- **Codex** -- skill and plugin scanning
- More platforms coming soon

Browse the skills ecosystem at [skills.sh](https://skills.sh).

## Configuration

Create `agentsec.config.ts` to customize policies and rules. See [DEMO.md](DEMO.md) for the full configuration reference.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and guidelines.

## License

[MIT](LICENSE)
