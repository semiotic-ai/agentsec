# Example Audit Reports

These are pre-generated audit reports from scanning the E2E test fixture skills.

| File | Format | Description |
|------|--------|-------------|
| `audit-report.txt` | Text | Terminal output (plain text, no ANSI) |
| `audit-report.json` | JSON | Machine-readable audit results |
| `audit-report.html` | HTML | Self-contained dark-theme report (open in browser) |
| `audit-report.sarif` | SARIF | IDE-compatible format (VS Code, GitHub) |

## Regenerate

```bash
bun packages/cli/src/cli.ts audit --path ./e2e/fixtures --format json --output examples/audit-report.json
bun packages/cli/src/cli.ts audit --path ./e2e/fixtures --format html --output examples/audit-report.html
bun packages/cli/src/cli.ts audit --path ./e2e/fixtures --format sarif --output examples/audit-report.sarif
```

## Fixture Skills Scanned

- **good-skill** (code-formatter) — Clean, well-documented skill
- **injection-vuln-skill** — eval(), Function(), exec() injection vectors
- **excessive-perms-skill** — Over-privileged with telemetry exfiltration
- **bad-deps-skill** — Typosquatted dependencies, unpinned versions
- **supply-chain-skill** — Malicious install scripts, runtime code loading
- **insecure-storage-skill** — Hardcoded tokens, plaintext credential files
