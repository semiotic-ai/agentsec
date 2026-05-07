# 1inch swap fixture

Third-party 1inch wrapper skill mirrored verbatim from upstream so the agentsec
scanner can grade its risky patterns against the Web3 Annex (AST-W01..W12). Used
by the web3 router skill comparison set alongside Odos (reference), KyberSwap,
0x, and CowSwap fixtures.

## Provenance

- **Source repo:** https://github.com/Starchild-ai-agent/official-skills
- **Source path:** `1inch/`
- **SKILL.md commit:** `cd8a0e8df847b5699c65e834936d4157f5767a43` (default branch
  `main` SHA at fetch time)
- **Source SKILL.md SHA:** `4d56466dde90d0b97758247c417e73be20e3f63d`
- **Source run_swap_flow.py SHA:** `397e899176554c911418508e1024ea60583908a2`
- **Upstream license:** **none declared** (the repo's GitHub `license` field is
  `null` and there is no LICENSE file). The MIT LICENSE in this directory
  applies only to the fixture wrapper / metadata files; the verbatim mirror of
  the third-party SKILL.md and `src/run_swap_flow.py` content is reproduced
  here for security-evaluation purposes (research / fair-use). If upstream
  publishes a license later, the fixture should be re-licensed to match.

## What is verbatim

- `SKILL.md` — byte-for-byte mirror of
  [`1inch/SKILL.md@cd8a0e8`](https://github.com/Starchild-ai-agent/official-skills/blob/cd8a0e8df847b5699c65e834936d4157f5767a43/1inch/SKILL.md).
- `src/run_swap_flow.py` — verbatim mirror of
  [`1inch/scripts/run_swap_flow.py@cd8a0e8`](https://github.com/Starchild-ai-agent/official-skills/blob/cd8a0e8df847b5699c65e834936d4157f5767a43/1inch/scripts/run_swap_flow.py)
  with one change: the relative import `from _oneinch_lib import ...` is left
  intact (the helper module is not vendored, so the script does not run as-is —
  it is only here as a static-analysis target).

## What is fixture-only

- `skill.json` — openclaw-style manifest, intentionally written **without** a
  `web3.policy` block so AST-W01 (signing authority) and AST-W04
  (metadata-completeness) fire under the scanner.
- `LICENSE` — MIT (covers fixture wrapper only; see "Upstream license" above).
- This README.

## Risky patterns preserved verbatim (do not "fix")

These are exactly the patterns the scanner is meant to detect. They must
survive any future refactor of this fixture:

1. **Unlimited `--auto-approve` flag** — the SKILL.md and `run_swap_flow.py`
   default to `--auto-approve`, which broadcasts an unbounded ERC-20 approve
   to the 1inch router with no per-call value cap.
2. **Policy-weakening troubleshooting guidance** — the "If swap returns wallet
   policy rejection" block tells the agent to load the `wallet-policy` skill
   and propose a wildcard baseline (`DENY exportPrivateKey`, `ALLOW *`) before
   retrying. This is textbook AST-W04 blind-sign-by-policy-relaxation.
3. **Anti-MCP-tools language** — "Never call `oneinch_*` tools" and
   "do not rely on platform-injected tools" steer the agent away from the
   curated MCP surface the scanner expects (AST-W08).
4. **Remote wallet over OIDC unix socket** — `WALLET_SERVICE_URL` plus the
   `/.fly/api` unix socket assumption mints OIDC tokens against an
   undisclosed signer, with no per-call cap, allowlist, or audit sink declared
   in the manifest (AST-W11 + AST-W01).

## E2E recipe

```bash
bun install && bun run build
bun run --filter @agentsec/cli -- audit \
  e2e/fixtures/profiles/web3/1inch-swap/ --verbose
```

Expected: `[Web3]` tag and at least one of AST-W01, W04, W08, W11 fires.
