<p align="center">
  <img src="https://raw.githubusercontent.com/semiotic-agentium/agent-audit/main/assets/agentsec-banner.png" alt="AgentSec banner" width="100%">
</p>

<h1 align="center">AgentSec</h1>
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
  <a href="https://github.com/semiotic-agentium/agent-audit">
    <img src="https://img.shields.io/badge/GitHub-agent--audit-181717?logo=github" alt="GitHub">
  </a>
  <a href="./LICENSE">
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

Run one command to audit every skill your AI agent uses against the [OWASP Agentic Skills Top 10](https://owasp.org/www-project-agentic-skills-top-10/). Supports **Claude Code**, **OpenClaw**, **Codex**, and more coming soon.

## Quick Start

```bash
npx agentsec
```

Scans your current directory, finds every installed skill, and reports what it finds.

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

## Auto-discovery

Running `npx agentsec` with no arguments scans every default skills directory for the agent platforms agentsec supports:

| Platform            | Paths scanned                                                                                                              |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Claude Code         | `~/.claude/skills`, `./.claude/skills`, `~/.claude/plugins/*/skills/*`, `~/.claude/commands`, `./.claude/commands` (legacy) |
| OpenClaw / ClawHub  | `~/.openclaw/workspace/skills`, `~/.openclaw/workspace-*/skills` (profiles via `OPENCLAW_PROFILE`), `~/.openclaw/skills`   |
| Codex / skills.sh   | `~/.agents/skills`, `./.agents/skills`, `../.agents/skills`, `/etc/codex/skills`                                           |

Pass `--path <dir>` to audit a specific directory instead, or `--platform <claude|openclaw|codex>` to narrow to one platform.

## CLI Commands

```bash
# Scan current directory (auto-detects agent skills)
npx agentsec

# Show detailed findings, score breakdowns, and recommendations
npx agentsec --verbose

# Scan a specific path
npx agentsec scan --path ./my-project

# Apply a policy preset
npx agentsec audit --policy strict
npx agentsec audit --policy enterprise

# Output formats
npx agentsec --format json --output audit.json
npx agentsec --format sarif --output audit.sarif
npx agentsec --format html --output report.html

# Generate a report from a saved audit
npx agentsec report audit.json --format html --output report.html
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

- **Claude Code** — scans installed skills and MCP servers
- **OpenClaw** — full SKILL.md manifest analysis
- **Codex** — skill and plugin scanning
- More platforms coming soon

Browse the skills ecosystem at [skills.sh](https://skills.sh).

## Configuration

Create `agentsec.config.ts` to customize policies and rules. See [DEMO.md](DEMO.md) for the full configuration reference.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and guidelines.

## License

[MIT](LICENSE)
