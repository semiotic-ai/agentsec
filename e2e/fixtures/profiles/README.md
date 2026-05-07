# Fixture Profiles

A **fixture profile** is a curated collection of mock agent skills grouped by domain. Each profile lives in a subdirectory under `e2e/fixtures/profiles/` and represents a slice of the real-world agent ecosystem (DEX aggregators, payments processors, document tools, etc.) that we can audit cross-sectionally to compare how skills in the same space stack up on AST10 / AST-W rules.

Profiles complement the existing single-issue fixtures (`w01-...`, `w02-...`, `bad-permissions-skill`, etc. directly under `e2e/fixtures/`) — those remain the unit-test-style fixtures pinned to one rule each, while profiles are the multi-skill suites used for comparison reports.

## What profiles are NOT

Profiles here are **fixture collections**, not the CLI's `--profile {default,web3,strict}` flag. That flag controls *rule selection* during a scan (which AST-W rules to apply, how strict to be). A fixture profile is just a directory of mock skills; you can audit any fixture profile under any scan profile.

## Current profiles

| Path           | Status              | Description                                                                                  |
| -------------- | ------------------- | -------------------------------------------------------------------------------------------- |
| `web3/`        | Populated           | Real-world DEX-aggregator agent skills (Odos as reference, plus 1inch / KyberSwap / 0x / CowSwap competitors). |
| `financial/`   | Empty scaffold      | Reserved for fiat payments, banking, accounting, KYC.                                        |
| `document/`    | Empty scaffold      | Reserved for PDF / DOCX / contract / legal-text skills.                                      |
| `standard/`    | Empty scaffold      | Reserved for general-purpose utility skills that don't fit a domain.                         |

The empty scaffolds are placeholders to claim the directory shape now and avoid a churn of mass renames once we decide to expand beyond Web3.

## Adding a new profile

1. `mkdir e2e/fixtures/profiles/<name>/`
2. Add a `README.md` describing the domain, the run command, and the expected risk taxonomy.
3. Add an `index.json` listing the fixtures (`{ profile, description, skills: [{name, path, role}], expectedRules }`).
4. Add the actual fixture directories (each with its own `skill.json` or `SKILL.md`) under the profile.

## Comparison runner

The `web3/` profile feeds `scripts/run-web3-comparison.ts` (added by Unit 12), which audits every fixture in the profile, builds a side-by-side report, and writes the aggregate to `examples/comparison/web3-routers/`. Other profiles will get parallel runners as they're populated.

## Relationship to existing fixtures

The single-issue fixtures (`w01-signing-vuln-skill/`, `bad-injection-skill/`, etc.) live alongside `profiles/` directly under `e2e/fixtures/` and are unchanged. They remain the canonical pin-one-rule fixtures used by `e2e/web3.test.ts` and friends. Profiles are an additional dimension — multi-skill, real-world-shaped, comparison-oriented — not a replacement.
