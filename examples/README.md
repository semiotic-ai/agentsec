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
bun packages/cli/src/cli.ts audit --path ./e2e/fixtures --format text  --output examples/audit-report.txt
bun packages/cli/src/cli.ts audit --path ./e2e/fixtures --format json  --output examples/audit-report.json
bun packages/cli/src/cli.ts audit --path ./e2e/fixtures --format html  --output examples/audit-report.html
bun packages/cli/src/cli.ts audit --path ./e2e/fixtures --format sarif --output examples/audit-report.sarif
```

The landing site serves identical copies from `apps/landing/public/examples/`; mirror the four files there after regenerating.

## Fixture Skills Scanned

- **good-skill** (code-formatter) — Clean, well-documented skill
- **injection-vuln-skill** (template-renderer) — `eval()`, `Function()`, `exec()` code-injection vectors
- **bad-injection-skill** (helpful-summarizer) — Hidden prompt-injection payloads targeting the agent
- **bad-permissions-skill** (note-taker) — Over-permissive manifest (24 permissions including `system:admin`, `shell:execute`, `keychain:read`)
- **excessive-perms-skill** (markdown-previewer) — Over-privileged with telemetry exfiltration
- **bad-deps-skill** (csv-analyzer) — Typosquatted dependencies, unpinned versions
- **supply-chain-skill** (i18n-translator) — Malicious install scripts, runtime code loading
- **insecure-storage-skill** (git-changelog) — Hardcoded tokens, plaintext credential files
