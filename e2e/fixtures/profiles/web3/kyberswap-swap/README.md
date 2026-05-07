# KyberSwap swap-execute fixture

E2E fixture mirroring KyberNetwork's official skills repo so the agentsec scanner
can grade the polished safe-vs-fast architecture against other DEX router skills
(Odos, 1inch, 0x, CowSwap).

## Provenance

- **Source repo:** https://github.com/KyberNetwork/kyberswap-skills
- **Upstream commit:** `2790929ffa408b92c9745579a2202be670382a4c`
- **Files mirrored verbatim:**
  - [`SKILL.md`](./SKILL.md) — copied byte-for-byte from
    [`skills/swap-execute/SKILL.md`](https://github.com/KyberNetwork/kyberswap-skills/blob/main/skills/swap-execute/SKILL.md)
    (the **safe** variant; this is the primary skill).
  - [`SKILL.fast.md`](./SKILL.fast.md) — copied byte-for-byte from
    [`skills/swap-execute-fast/SKILL.md`](https://github.com/KyberNetwork/kyberswap-skills/blob/main/skills/swap-execute-fast/SKILL.md)
    (the **dangerous** variant that explicitly skips confirmation).

## Why mirror BOTH safe and fast variants

Mirroring `swap-execute-fast` alongside `swap-execute` is intentional: the whole
point of this fixture is to let agentsec flag the `*-fast` pattern. The fast
variant is what the scanner is supposed to grade harshly; the safe variant is
the contrast. Stripping the fast skill would defeat the comparison.

## Risky patterns that survive verbatim

These appear in the upstream skills and must NOT be sanitized in the fixture —
they are the signal we want the scanner to pick up:

- The `swap-execute-fast` skill name pattern (and the broader `*-fast` family,
  including `limit-order-fast` and `zap-fast` which the upstream repo also ships).
- The "EXTREMELY DANGEROUS" / "skip confirmation" / "no confirmation step"
  language in `SKILL.fast.md`.
- The full RPC list (~18 chains hardcoded in `SKILL.md`'s "Step 2: Determine
  RPC URL" table), all public free endpoints with no integrity pin.
- The DSLOProtocol limit-order contract address (`0x6131B5fae19EA4f9D964eAc0408E4408b66337b5`,
  the KyberSwap meta-aggregator router) and the KSZapRouterPosition pattern.

## File layout

```
kyberswap-swap/
├── SKILL.md          verbatim swap-execute (safe)
├── SKILL.fast.md     verbatim swap-execute-fast (dangerous)
├── skill.json        openclaw manifest (with hardware-wallet permission)
├── README.md         this file
├── LICENSE           Apache-2.0
└── src/
    ├── execute-swap.sh         extracted from SKILL.md (cast send)
    ├── execute-swap-fast.sh    extracted from SKILL.fast.md (no-confirm path)
    └── execute-swap-ethers.js  extracted from SKILL.md (ethers.js fallback)
```

## License

Upstream `KyberNetwork/kyberswap-skills` does not ship a top-level LICENSE file
(checked at the upstream SHA above). The agentsec project tags this fixture as
`Apache-2.0` as a conservative default — match upstream once they publish one.
The mirrored content is reproduced for security-research purposes under fair use.

## Expected scanner findings

Running `agentsec audit e2e/fixtures/profiles/web3/kyberswap-swap/ --verbose`
should surface at least:

- **AST-W12** — audit/kill-switch missing (no audit sink, no kill-switch contract
  in `skill.json`; the `*-fast` skill explicitly broadcasts with no hold).
- **AST-W04** — blind signing / EIP-712 spend authorization without review
  (the fast variant signs and broadcasts in one step).
- **AST-W05** — public free RPCs without integrity pin (~18 hardcoded
  `https://...publicnode.com`, `https://polygon-rpc.com`, etc.).

Other findings (W01 signing authority, W06 contract-target verification, etc.)
may also fire depending on rule versions.
