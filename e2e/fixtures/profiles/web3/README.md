# Web3 fixture profile

Real-world-shaped DEX-aggregator and router agent skills used for cross-comparison auditing. Each fixture mirrors a publicly available router skill (from GitHub, skills.sh, ClawHub) and is designed to fire a representative spread of AST-W (Web3 annex) rules.

## Run it

```bash
bun run --filter @agentsec/cli -- audit e2e/fixtures/profiles/web3/
```

The CLI auto-discovers each fixture directory under this profile, applies the Web3 annex (rules auto-engage when a skill touches chain), and prints a per-skill report. Pass `--profile web3` to force the annex onto every skill regardless of auto-detection — useful if you want apples-to-apples coverage across every fixture.

## Aggregate / comparison report

The cross-fixture report lands at `examples/comparison/web3-routers/` once the comparison runner (`scripts/run-web3-comparison.ts`) has been executed. That script reads `index.json` to discover the fixtures, audits each, and writes a side-by-side summary sorted by score.

## Fixtures

Each fixture mirrors a public router skill at the SHA recorded in its `README.md`. The "expected AST-W rules to fire" column is the representative spread the fixture was selected to exercise; the actual finding list comes from running the scanner.

| Fixture                | Path              | Expected AST-W rules to fire                                                        |
| ---------------------- | ----------------- | ----------------------------------------------------------------------------------- |
| `zerox-swap`           | `0x-swap/`        | AST-W02, AST-W04, AST-W12 (audit / kill switch)                                     |
| `oneinch-swap`         | `1inch-swap/`     | AST-W01, AST-W02 (Permit2 capture), AST-W04                                          |
| `across-swap`          | `across-swap/`    | AST-W07 (bridge replay), AST-W12                                                    |
| `cowswap-swap`         | `cowswap-swap/`   | AST-W04, AST-W06, AST-W12                                                           |
| `debridge-swap`        | `debridge-swap/`  | AST-W07, AST-W12                                                                    |
| `kyberswap-swap`       | `kyberswap-swap/` | AST-W01, AST-W05 (RPC substitution), AST-W11 (key material leaks)                   |
| `lifi-swap`            | `lifi-swap/`      | AST-W05, AST-W07, AST-W12                                                           |
| `odos-swap`            | `odos-swap/`      | AST-W01 (signing authority), AST-W04 (blind signing), AST-W06 (target verification) |
| `pancakeswap-swap`     | `pancakeswap-swap/` | AST-W01, AST-W04, AST-W12                                                         |
| `sushiswap-swap`       | `sushiswap-swap/` | AST-W04, AST-W12                                                                    |
| `uniswap-swap`         | `uniswap-swap/`   | AST-W01, AST-W04, AST-W12                                                           |

The full list of expected rules across the profile is mirrored in `index.json#expectedRules` so the comparison runner can compute coverage deltas.

## Status

Fixture directories are added in separate PRs as upstream router skills are mirrored. Until every fixture lands, this directory contains the profile scaffolding plus whatever subset has been added — auditing it audits only the present fixtures.
