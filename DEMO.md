# agent-audit Demo Guide

> For installation and project overview, see [README.md](README.md).

## Quick Demo

```bash
bun run demo
```

This runs a full security audit against the bundled test fixtures and prints findings to the terminal.

## Running the Audit

### Scan the bundled test fixtures

```bash
bun packages/cli/src/cli.ts audit --path ./e2e/fixtures
```

### Scan a specific skill directory

```bash
bun packages/cli/src/cli.ts audit --path /path/to/your/skills
```

### Scan only (no policy evaluation)

```bash
bun packages/cli/src/cli.ts scan --path ./e2e/fixtures
```

### Verbose output

```bash
bun packages/cli/src/cli.ts audit --path ./e2e/fixtures --verbose
```

## Report Formats

### JSON report

```bash
bun packages/cli/src/cli.ts audit --path ./e2e/fixtures --format json --output audit.json
```

### HTML report

```bash
bun packages/cli/src/cli.ts audit --path ./e2e/fixtures --format html --output report.html
```

### SARIF report (for IDE/CI integration)

```bash
bun packages/cli/src/cli.ts audit --path ./e2e/fixtures --format sarif --output audit.sarif
```

Pre-generated example reports are available in the [`examples/`](examples/) folder.

### Generate a report from saved JSON

```bash
# First, save an audit as JSON
bun packages/cli/src/cli.ts audit --path ./e2e/fixtures --format json --output audit.json

# Then convert to HTML
bun packages/cli/src/cli.ts report audit.json --format html --output report.html
```

## Policy Presets

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

### List available policies

```bash
bun packages/cli/src/cli.ts policy list
```

## Configuration Reference

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

## Test Fixtures

The `e2e/fixtures/` directory contains sample skills for testing:

| Fixture | Description |
|---------|-------------|
| `good-skill` | Clean skill with no findings |
| `injection-vuln-skill` | Contains code injection vulnerabilities |
| `excessive-perms-skill` | Requests more permissions than needed |
| `bad-deps-skill` | Has problematic dependencies |
| `bad-injection-skill` | Another injection pattern variant |
| `supply-chain-skill` | Supply chain risk indicators |
| `bad-permissions-skill` | Overly broad permission declarations |
| `insecure-storage-skill` | Insecure data storage patterns |

## Adding a New Scanner Rule

Scanner rules live in `packages/scanner/src/rules/`. Each file exports rule definitions that match against skill source code. See existing rules for the pattern:

- `injection.ts` -- Code injection detection
- `permissions.ts` -- Permission analysis
- `dependencies.ts` -- Dependency risk checks
- `supply-chain.ts` -- Supply chain indicators
- `storage.ts` -- Insecure storage patterns
- `deserialization.ts` -- Unsafe deserialization
- `dos.ts` -- Denial of service patterns
- `logging.ts` -- Logging hygiene
- `error-handling.ts` -- Error handling checks
- `output-handling.ts` -- Output sanitization

## Creating a Test Fixture

Add a new directory under `e2e/fixtures/` with:

1. A `skill.json` manifest
2. A `src/` directory with TypeScript source files
3. Optionally a `package.json` (for dependency-related rules)

## Lume VM Testing

Lume provides sandboxed macOS VMs for end-to-end testing. This is optional and only needed for full integration tests. Requires Apple Silicon, macOS 13.0+, 16 GB RAM (recommended), and ~60 GB free disk space.

### Setup

```bash
# Install Lume and provision the VM
.lume/setup.sh
```

This creates a macOS VM named `agent-audit-vm` with 4 CPUs, 8 GB RAM, and 50 GB disk.

### Run E2E tests against the VM

```bash
cd e2e && bun test
```

The E2E suite will start the VM, install OpenClaw inside it, deploy the fixture skills, and run `agent-audit` against the VM environment.

### Manual VM management

```bash
# SSH into the VM
lume ssh agent-audit-vm

# Run a command inside the VM
lume ssh agent-audit-vm "sw_vers"

# Stop the VM
lume stop agent-audit-vm

# Delete the VM
lume delete agent-audit-vm --force
```

### Lume API

When Lume's background service is running, a local API is available at `http://localhost:7777` for programmatic VM management. The `e2e/setup.ts` script uses this API.
