# Web3 fixture profile

Real-world-shaped DEX-aggregator agent skills used for cross-comparison auditing. The fixtures here are mocks modelled on five public routers — Odos as the reference implementation, plus 1inch, KyberSwap, 0x, and CowSwap as competitors — designed to fire a representative spread of AST-W (Web3 annex) rules.

## Run it

```bash
bun run --filter @agentsec/cli -- audit e2e/fixtures/profiles/web3/
```

The CLI auto-discovers each fixture directory under this profile, applies the Web3 annex (rules auto-engage when a skill touches chain), and prints a per-skill report. Pass `--profile web3` to force the annex onto every skill regardless of auto-detection — useful if you want apples-to-apples coverage across all five.

## Aggregate / comparison report

The cross-fixture report lands at `examples/comparison/web3-routers/` once the comparison runner (`scripts/run-web3-comparison.ts`) has been executed. That script reads `index.json` to discover the fixtures, audits each, and writes a side-by-side summary.

## Fixtures

| Fixture                | Role        | Path             | Expected AST-W rules to fire                                            |
| ---------------------- | ----------- | ---------------- | ----------------------------------------------------------------------- |
| `odos-swap`            | reference   | `odos-swap/`     | AST-W01 (signing authority), AST-W04 (blind signing), AST-W06 (target verification) |
| `oneinch-swap`         | competitor  | `1inch-swap/`    | AST-W01, AST-W02 (Permit2 capture), AST-W04                              |
| `kyberswap-swap`       | competitor  | `kyberswap-swap/` | AST-W01, AST-W05 (RPC substitution), AST-W11 (key material leaks)        |
| `zerox-swap`           | competitor  | `0x-swap/`       | AST-W02, AST-W04, AST-W12 (audit / kill switch)                          |
| `cowswap-swap`         | competitor  | `cowswap-swap/`  | AST-W04, AST-W06, AST-W12                                                |

The full list of expected rules across the profile is mirrored in `index.json#expectedRules` so the comparison runner can compute coverage deltas.

## Status

Fixture directories are added by Units 1-5 of the parallel scaffolding work (separate PRs). Until those land, this directory only contains the profile scaffolding — auditing it is a no-op (the CLI exits cleanly with "No skills found").
