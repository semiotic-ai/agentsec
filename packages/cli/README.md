<p align="center">
  <img src="https://raw.githubusercontent.com/semiotic-agentium/agent-audit/main/assets/agentsec-banner.png" alt="AgentSec banner" width="100%">
</p>

<h1 align="center">agentsec</h1>
<p align="center">
  <strong>Audit every skill your AI agents run.</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/agentsec">
    <img src="https://img.shields.io/npm/v/agentsec.svg?color=cb3837&logo=npm" alt="npm version">
  </a>
  <a href="https://www.npmjs.com/package/agentsec">
    <img src="https://img.shields.io/npm/dm/agentsec.svg?color=blue" alt="npm downloads">
  </a>
  <a href="https://github.com/semiotic-agentium/agent-audit/blob/main/LICENSE">
    <img src="https://img.shields.io/npm/l/agentsec.svg?color=blue" alt="License: MIT">
  </a>
  <a href="https://owasp.org/www-project-agentic-skills-top-10/">
    <img src="https://img.shields.io/badge/OWASP-AST10-orange.svg" alt="OWASP AST10">
  </a>
  <a href="https://github.com/semiotic-agentium/agent-audit">
    <img src="https://img.shields.io/badge/GitHub-agent--audit-181717?logo=github" alt="GitHub">
  </a>
</p>

---

`agentsec` is a zero-config CLI that audits every skill your AI agent runs — against the [OWASP Agentic Skills Top 10](https://owasp.org/www-project-agentic-skills-top-10/). It supports **Claude Code**, **OpenClaw**, **Codex**, and more.

One command. Full security report. No sign-up.

## Quick Start

```bash
npx agentsec
```

Scans your current directory, finds every installed skill, and tells you what's dangerous.

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

## Installation

```bash
# Run ad-hoc (recommended)
npx agentsec

# Or install globally
npm install -g agentsec
bun install -g agentsec
```

## Commands

```bash
# Audit current directory (auto-detects agent skills)
agentsec

# Show detailed findings, score breakdowns, and recommendations
agentsec --verbose

# Scan a specific path
agentsec scan --path ./my-project

# Apply a policy preset
agentsec audit --policy strict
agentsec audit --policy enterprise

# Pick a platform (openclaw | claude | codex)
agentsec --platform claude

# Output formats: text | json | sarif | html
agentsec --format json --output audit.json
agentsec --format sarif --output audit.sarif
agentsec --format html --output report.html

# Generate a report from a saved JSON audit
agentsec report audit.json --format html --output report.html

# Inspect policy presets
agentsec policy list
```

Run `agentsec help` for the full option reference.

## OWASP Agentic Skills Top 10

Every scan checks all 10 risk categories from the [OWASP AST10](https://owasp.org/www-project-agentic-skills-top-10/):

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

## Supported Agent Platforms

- **Claude Code** — scans installed skills and MCP servers
- **OpenClaw** — full `SKILL.md` manifest analysis
- **Codex** — skill and plugin scanning
- More platforms coming soon

## Output Formats

| Format | Flag             | Best For                              |
| ------ | ---------------- | ------------------------------------- |
| Text   | `--format text`  | Terminal, human-readable (default)    |
| JSON   | `--format json`  | CI pipelines, programmatic processing |
| SARIF  | `--format sarif` | VS Code, GitHub Code Scanning         |
| HTML   | `--format html`  | Stakeholder reports, dashboards       |

## CI/CD Integration

Fail your build when a scan finds high-severity issues:

```bash
# Exit 1 on any high or critical finding
agentsec audit --policy strict --format sarif --output audit.sarif
```

Upload the resulting SARIF to GitHub Code Scanning to track findings over time.

## Requirements

- [Bun](https://bun.sh) `>= 1.0.0` — the CLI is built and distributed as a Bun bundle.

## Links

- 🌐 Website: [agentsec.sh](https://agentsec.sh)
- 📦 GitHub: [semiotic-agentium/agent-audit](https://github.com/semiotic-agentium/agent-audit)
- 🐛 Issues: [github.com/semiotic-agentium/agent-audit/issues](https://github.com/semiotic-agentium/agent-audit/issues)
- 🧩 Skills ecosystem: [skills.sh](https://skills.sh)

## License

[MIT](https://github.com/semiotic-agentium/agent-audit/blob/main/LICENSE) © AgentSec Contributors
