---
description: Run agent-audit on local test fixture skills
---

Run the agent-audit CLI against the local E2E test fixtures to verify the full audit pipeline works end-to-end.

Steps:
1. Build all packages: `bun run build` (or turbo build)
2. Run the CLI: `bun packages/cli/src/cli.ts audit --path ./e2e/fixtures --verbose`
3. Report the results — highlight any regressions or unexpected findings
4. If there are build errors, fix them before running the audit
