<p align="center">
  <img src="https://agentsec.sh/assets/agentsec-banner-3247x1700.png" alt="AgentSec banner" width="100%">
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
  <a href="https://github.com/semiotic-ai/agentsec">
    <img src="https://img.shields.io/badge/GitHub-agentsec-181717?logo=github" alt="GitHub">
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
  <a href="https://clawhub.ai/markeljan/agentsec">
    <img src="https://img.shields.io/badge/clawhub-agentsec-FF6B35.svg" alt="ClawHub">
  </a>
</p>

---

Run one command to audit every skill your AI agent uses against the [OWASP Agentic Skills Top 10](https://owasp.org/www-project-agentic-skills-top-10/). Supports **Claude Code**, **OpenClaw / ClawHub**, **Codex / skills.sh**, and generic project-local skill directories.

## Quick Start

```bash
npx agentsec
```

No flags needed. agentsec walks every default skills directory on your machine — grouped by platform — plus any `./skills` folder in the current project (up to two levels deep).

### Use as an Agent Skill

`agentsec` is published as an OpenClaw skill on [ClawHub](https://clawhub.ai/markeljan/agentsec). Agents that support ClawHub can install it directly:

```bash
npx clawhub install markeljan/agentsec
```

Then ask the agent to audit your skills — it'll invoke `npx agentsec` and surface the findings.

### Example Output

```
  ✔ Found 6 skills
  ℹ Scanned 4 locations across Claude Code, OpenClaw, Codex / skills.sh, Other
    Claude Code
      ~/.claude/skills (3 skills)
    OpenClaw
      ~/.openclaw/workspace/skills (1 skill)
    Codex / skills.sh
      ~/.agents/skills (1 skill)
    Other
      ./skills (1 skill)

Scanning Skills
────────────────────────────────────────────────────────────

  Claude Code (3 skills)
  ✔ fetch-data     v1.0.0  D (42)
  ✔ deploy-helper  v2.3.0  C (68)
  ✔ code-review    v1.1.0  A (95)

  OpenClaw (1 skill)
  ✔ summarize-docs v0.9.0  A (91)

  Codex / skills.sh (1 skill)
  ✔ db-migrate     v1.4.2  B (78)

  Other (1 skill)
  ✔ lint-fix       v2.0.0  A (93)

  6 skills scanned  •  avg score 78  •  4 certified
  Findings: 2 critical, 1 high, 2 medium

  ⚠ WARN  3 high/critical finding(s) detected
  Run with --verbose for detailed findings and recommendations.
```

## Auto-discovery

Running `npx agentsec` with no arguments scans every default skills directory for the agent platforms agentsec supports, then walks the current working directory for a generic `skills/` folder:

| Platform            | Paths scanned                                                                                                              |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| **Claude Code**     | `~/.claude/skills`, `./.claude/skills`, `~/.claude/plugins/*/skills/*`, `~/.claude/commands`, `./.claude/commands` (legacy) |
| **OpenClaw / ClawHub** | `~/.openclaw/workspace/skills`, `~/.openclaw/workspace-*/skills` (profiles via `OPENCLAW_PROFILE`), `~/.openclaw/skills` |
| **Codex / skills.sh** | `~/.agents/skills`, `./.agents/skills`, `../.agents/skills`, `/etc/codex/skills`                                         |
| **Other** (generic) | Any `skills/` directory found within the current working directory, up to two levels deep                                   |

Discovered skills are grouped by platform in the output so you can see at a glance where each skill came from. Pass `--path <dir>` to audit a specific directory instead, or `--platform <claude\|openclaw\|codex>` to narrow to one platform.

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

### Web3 Annex (AST-W01–W12)

Skills that touch chain (signing, RPC, EIP-7702 delegation, MCP chain-tools, etc.) are auto-detected and audited against 12 additional rules from the [`@agentsec/web3`](./packages/web3/README.md) annex. Force the rule pack on for cross-team CI consistency:

```bash
npx agentsec --profile web3
```

| ID         | Risk                                       |
| ---------- | ------------------------------------------ |
| **AST-W01** | Unbounded Signing Authority               |
| **AST-W02** | Implicit Permit / Permit2 Signature Capture |
| **AST-W03** | Delegation Hijack via EIP-7702            |
| **AST-W04** | Blind / Opaque Signing                    |
| **AST-W05** | RPC Substitution / Mempool Leakage        |
| **AST-W06** | Unverified Contract Call Targets          |
| **AST-W07** | Cross-Chain / Bridge Action Replay        |
| **AST-W08** | MCP Chain-Tool Drift / Capability Smuggling |
| **AST-W09** | Session-Key Permission-Caveat Erosion     |
| **AST-W10** | Slippage / Oracle Manipulation by Agent Loop |
| **AST-W11** | Key Material in Agent Memory / Logs       |
| **AST-W12** | No On-Chain Action Audit / Kill-Switch    |

Findings carry their canonical OWASP code in every report format (text, JSON, HTML, SARIF) — `rule.id` in SARIF is `AST-W##` with a `helpUri` to the annex doc.

## Supported Agents

- **Claude Code** — scans installed skills and MCP servers
- **OpenClaw** — full SKILL.md manifest analysis
- **Codex** — skill and plugin scanning
- More platforms coming soon

Browse the skills ecosystem at [skills.sh](https://skills.sh) and [clawhub.ai](https://clawhub.ai). The `agentsec` skill itself is published at [clawhub.ai/markeljan/agentsec](https://clawhub.ai/markeljan/agentsec).

## Configuration

Create `agentsec.config.ts` to customize policies and rules. See [DEMO.md](DEMO.md) for the full configuration reference.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and guidelines.

## License

[MIT](LICENSE)
