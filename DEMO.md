# Demo Guide

> For installation and project overview, see [README.md](README.md).
> For development setup, see [CONTRIBUTING.md](CONTRIBUTING.md).

## Quick Demo

From a built checkout (`bun install && bun run build`):

```bash
bun run demo
```

This runs a full security audit against the bundled test fixtures and prints findings to the terminal.

## Step-by-Step Demo

### 1. Scan the bundled test fixtures

```bash
bun packages/cli/src/cli.ts audit --path ./e2e/fixtures
```

### 2. Try different output formats

```bash
# JSON (machine-readable)
bun packages/cli/src/cli.ts audit --path ./e2e/fixtures --format json --output audit.json

# HTML (interactive dashboard)
bun packages/cli/src/cli.ts audit --path ./e2e/fixtures --format html --output report.html

# SARIF (IDE/CI integration)
bun packages/cli/src/cli.ts audit --path ./e2e/fixtures --format sarif --output audit.sarif
```

### 3. Apply different policy presets

```bash
# Strict -- zero tolerance for high/critical findings
bun packages/cli/src/cli.ts audit --path ./e2e/fixtures --policy strict

# Standard (default) -- balanced thresholds
bun packages/cli/src/cli.ts audit --path ./e2e/fixtures --policy standard

# Permissive -- warn on critical CVEs only
bun packages/cli/src/cli.ts audit --path ./e2e/fixtures --policy permissive

# Enterprise -- strict + additional governance rules
bun packages/cli/src/cli.ts audit --path ./e2e/fixtures --policy enterprise
```

### 4. Scan a specific skill

```bash
bun packages/cli/src/cli.ts audit --path ./e2e/fixtures/injection-vuln-skill
```

### 5. Scan-only mode (no policy evaluation)

```bash
bun packages/cli/src/cli.ts scan --path ./e2e/fixtures
```

### 6. Verbose output

By default, the CLI shows a compact summary with skill grades and finding counts. Use `--verbose` to see per-skill score breakdowns, individual findings with locations, and remediation guidance:

```bash
bun packages/cli/src/cli.ts audit --path ./e2e/fixtures --verbose
```

## Pre-Generated Example Reports

The [`examples/`](examples/) folder contains sample reports you can inspect without running the scanner:

| File | Format | Description |
|------|--------|-------------|
| [`audit-report.html`](examples/audit-report.html) | HTML | Interactive dashboard with findings, scores, and recommendations |
| [`audit-report.json`](examples/audit-report.json) | JSON | Machine-readable output for CI/CD integration |
| [`audit-report.sarif`](examples/audit-report.sarif) | SARIF | IDE integration format (VS Code, GitHub) |
| [`audit-report.txt`](examples/audit-report.txt) | Text | Plain text for logs and terminals |

Open the HTML report in a browser to see the full dashboard experience.

## Test Fixtures

The `e2e/fixtures/` directory contains sample skills designed to trigger specific scanner rules:

| Fixture | What it demonstrates |
|---------|---------------------|
| `good-skill` | Clean skill with no findings |
| `injection-vuln-skill` | Code injection vulnerabilities |
| `excessive-perms-skill` | Overly broad permission requests |
| `bad-deps-skill` | Problematic dependencies |
| `bad-injection-skill` | Injection pattern variant |
| `supply-chain-skill` | Supply chain risk indicators |
| `bad-permissions-skill` | Overly broad permission declarations |
| `insecure-storage-skill` | Insecure data storage patterns |

## Configuration Reference

Create an `agentsec.config.ts` in your project root:

```typescript
import { defineConfig } from "agentsec";

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

### List available policies

```bash
bun packages/cli/src/cli.ts policy list
```

## Generating a Report from Saved JSON

```bash
# First, save an audit as JSON
bun packages/cli/src/cli.ts audit --path ./e2e/fixtures --format json --output audit.json

# Then convert to HTML
bun packages/cli/src/cli.ts report audit.json --format html --output report.html
```

## Lume VM Testing

Lume provides sandboxed macOS VMs for end-to-end testing. This is optional and only needed for full integration tests.

### Requirements

- Apple Silicon Mac
- macOS 13.0+
- 16 GB RAM (recommended)
- ~60 GB free disk space

### Setup

```bash
# Install Lume and provision the VM
.lume/setup.sh
```

This creates a macOS VM named `agentsec-vm` with 4 CPUs, 8 GB RAM, and 50 GB disk.

### Run E2E tests against the VM

```bash
cd e2e && bun test
```

The E2E suite starts the VM, installs OpenClaw inside it, deploys the fixture skills, and runs `agentsec` against the VM environment.

### Manual VM management

```bash
# SSH into the VM
lume ssh agentsec-vm

# Run a command inside the VM
lume ssh agentsec-vm "sw_vers"

# Stop the VM
lume stop agentsec-vm

# Delete the VM
lume delete agentsec-vm --force
```

### Lume API

When Lume's background service is running, a local API is available at `http://localhost:7777` for programmatic VM management. The `e2e/setup.ts` script uses this API.
