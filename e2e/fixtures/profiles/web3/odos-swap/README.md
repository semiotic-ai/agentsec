# odos-swap fixture

Test fixture mirroring the upstream Odos `odos-swap` skill so `agentsec` can
audit it. The fixture deliberately preserves the risky patterns we want the
scanner to flag — do not sanitize them away.

## Provenance

- **Source:** https://github.com/odos-xyz/odos-skills
- **Path upstream:** `skills/odos-swap.md`
- **Commit:** `f88b7c89e5f6e7155882f59b295eb695aac0ebc0`
- **Captured:** 2026-05-07

## What is verbatim from upstream

- `SKILL.md` — body and frontmatter copied verbatim from
  `skills/odos-swap.md`. Frontmatter retains `name: odos-swap` and the
  original `description` field.
- `src/quote-flow.sh` — extraction of the bash code blocks from `SKILL.md`
  into a single executable so the scanner picks up the raw shell patterns
  (Permit2 keyfile path, `cast send --private-key "$PRIVATE_KEY"`, the
  `MaxUint256` allowance hint, etc.).

## What we added

- `skill.json` — an openclaw-style manifest mirroring `SKILL.md`. Upstream
  ships only Markdown, but agentsec's scanner expects this manifest to know
  the engine, permissions, and provenance. The manifest deliberately
  omits a `web3` policy block so the AST04 / metadata-completeness rule
  fires (signing authority, allowed contracts, slippage policy, audit sink,
  kill-switch — none of these are declared upstream).
- `LICENSE` — placeholder MIT for downstream test usage. The upstream
  `odos-xyz/odos-skills` repo has no `LICENSE` file at the captured commit,
  so `skill.json` records `license: "UNKNOWN"` to match reality.

## Risky patterns the scanner should flag

These are present verbatim in `SKILL.md` and `src/quote-flow.sh`. They are
the reason this fixture exists — do not "fix" them in the fixture; instead,
file recommendations upstream and improve scanner coverage.

| Pattern                                         | Expected rule          |
| ----------------------------------------------- | ---------------------- |
| `MaxUint256` allowance hint                     | AST-W01, AST-W02       |
| `/tmp/permit2.json` keyfile path                | AST-W11                |
| `$PRIVATE_KEY` env var read by `cast send`      | AST-W11                |
| 0.5% default slippage in bash                   | AST-W10                |
| `RPC_URL` unchecked / no pin                    | AST-W05                |
| Live router fetch from `/info/router/v3/{id}`   | AST-W06                |
| Permit2 mentions without `web3.policy.allowedContracts` | AST-W02      |
| No `web3` policy block in `skill.json`          | AST04, metadata-rule   |

## Running the audit

From the repo root:

```bash
bun packages/cli/dist/cli.js audit --path e2e/fixtures/profiles/web3/odos-swap/ --verbose
```

What fires today (agentsec v0.2.7):

- The `[Web3]` tag and three Web3 signals (Permit2 / EVM prose / ETH address).
- `AST05` critical — two hardcoded-token findings inside `src/quote-flow.sh`
  (the canonical WETH and USDC addresses on Base).
- `AST05` medium — missing `.gitignore`.

Known scanner gaps surfaced by this fixture (none of these AST-W rules fire
today even though the upstream patterns are present):

- AST-W01/W02 — token names like `Permit2` are not picked up by the
  `\bpermit\b` mention regex; addresses inside fenced bash code blocks are
  not yet treated as named-protocol references.
- AST-W04/W11 — bash CLI invocations (`cast wallet sign-typed-data`,
  `cast send --private-key "$PRIVATE_KEY"`) are not in the JS-shaped
  primitive set.
- AST-W05 — env-var indirection (`RPC_URL`) and Odos's `api.odos.xyz` host
  are not in the protected-RPC catalog.
- AST-W10 — `slippage="0.5"` in a bash heredoc is below the 5% threshold
  (the upstream value is conservative); the rule would fire on >5% only.

These gaps are the value of this fixture: they are concrete coverage
backlog entries for the scanner.
