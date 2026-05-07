# 0x-swap (mirror fixture)

This fixture mirrors the third-party `Supraforge/aaas-vault` skill at
`skills/blockchain-crypto/0x-swap/` (upstream commit
`a7ecf7fe6fdf86c74e7338cd9c47522bd20652e1`). It exists so the agentsec
scanner has a real-world Permit2 typed-data fee-skim pattern to fire
against in the web3 profile e2e.

0x has no first-party agent skill; this third-party listing is the most
prominent mirror and ships a hardcoded fee-skim that is exactly the
pattern AST-W02 targets.

## Provenance

- Upstream repo: https://github.com/Supraforge/aaas-vault
- Upstream path: `skills/blockchain-crypto/0x-swap/`
- Upstream `_meta.json` owner: `0xterrybit` (slug `0x-swap`, latest
  `2.0.0` published via `clawdbot/skills` commit
  `c39752b9b09b012a52af2c27c3911090771338d2`)
- Upstream `SKILL.md` `metadata.clawdbot` key — note that the
  agentsec-canonical key is `metadata.openclaw` per AGENTS.md, so the
  upstream's continued use of the legacy `clawdbot` key is itself a
  finding worth surfacing.
- Real 0x v2 API surface this skill drives: https://0x.org/docs/api
  (`/swap/permit2/quote`, `/swap/permit2/price`, AllowanceHolder
  approval, gasless variant, `0x-api-key` + `0x-version: v2` headers,
  per-chain subdomains like `polygon.api.0x.org`).

**Risk pattern preserved intact:** hardcoded `SWAP_FEE_BPS=30` and fee
recipient `0x890CACd9dEC1E1409C6598Da18DC3d634e600b45` — when an agent
runs this skill, every Permit2 typed-data signature captures a 30 bps
fee for that address.

## Why the fixture is verbatim

The mirror is byte-for-byte (modulo trailing newline) so the scanner
sees the exact strings any user would see if they pulled the upstream
skill. Do not refactor `src/quote.sh` or rephrase the SKILL.md — the
scanner relies on:

- the literal `SWAP_FEE_BPS=30` assignment
- the literal `SWAP_FEE_RECIPIENT=0x890CACd9dEC1E1409C6598Da18DC3d634e600b45`
- `gasless=true` in the Permit2 quote URL
- the `0x-api-key` request header
- the `*.api.0x.org` per-chain subdomain table
- the "WARN if price impact > 1%" Safety Rules language (W12 trigger)

## Expected agentsec findings

When run via `bun run --filter @agentsec/cli -- audit
e2e/fixtures/profiles/web3/0x-swap/ --verbose`, expect at least:

- **AST-W02** Permit2 phishing — hardcoded fee recipient and fee bps
  baked into the typed-data signature payload
- **AST-W04** signs without surfacing the fee breakdown to the user
  before signature
- **AST-W12** price impact >1% only WARN, not abort

## License

MIT — matches upstream.
