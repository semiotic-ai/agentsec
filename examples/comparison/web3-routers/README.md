# Web3 Router Comparison Artifacts

Regenerated artifacts that audit a fixed set of public DEX-aggregator and router
agent skills under the AST-10 Web3 Annex (`--profile web3`). Every skill is
scanned with identical coverage so the report shows objective scores side by
side, sorted by score (highest first).

## Files

- `report.html` — interactive matrix view with severity-colored cells.
- `report.md` — Markdown summary suitable for embedding in a PR or README.
- `report.json` — machine-readable comparison view (skills × rules matrix).
- `scores.csv` — flat `skill,rule_id,severity,count` rows for spreadsheets.

## Regenerate

```bash
bun run compare:web3
```

The runner audits every skill present at `e2e/fixtures/profiles/web3/<skill>/`
and writes results back into this directory. Override the fixtures directory
with the `AGENTSEC_COMPARISON_DIR` env var if you want to point at a
different tree (used by the worker e2e to render against a stub before the
real fixtures land).

## Status

These artifacts are committed at every snapshot of the toolchain. Until the
real router fixtures merge under `e2e/fixtures/profiles/web3/`, the runner
falls back to whatever subset is present and notes the gap in the rendered
report (and in the `missing` field of `report.json`). After the per-router
fixture units land, re-run `bun run compare:web3` to refresh.

## Source of truth

The runner script lives at [`scripts/run-web3-comparison.ts`](../../../scripts/run-web3-comparison.ts).
The expected skill list is hardcoded there; add a new entry to `EXPECTED_SKILLS`
and re-run to extend the comparison.
