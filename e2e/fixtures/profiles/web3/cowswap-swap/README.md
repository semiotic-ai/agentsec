# cowswap-intent fixture

Constructed mock; no upstream skill exists. Modeled after the CoW Protocol
intent flow at api.cow.fi.

## What this models

CoW Protocol orders are **intents**, not transactions. The user signs an
EIP-712 `Order` off-chain, optionally a Permit2 typed-data permit, and
POSTs both to `https://api.cow.fi/{chain}/api/v1/orders`. A solver picks
up the intent, batches it, and settles it on-chain via the GPv2Settlement
contract at `0x9008D19f58AAbD9eD0D60971565AA8510560ab41`. The Permit2
spender is the GPv2VaultRelayer at
`0xC92E8bdf79f0507f65a392b0ab4667716BFE0110`.

The `SKILL.md` walks through a full six-step flow: quote → user confirm →
sign Permit2 typed-data → sign Order typed-data → POST to `/orders` →
poll status / soft-cancel.

## Risky patterns the scanner should flag

These are present verbatim in `SKILL.md` and `src/*.sh`. They are the
reason this fixture exists — do not "fix" them in the fixture.

| Pattern                                            | Expected rule       |
| -------------------------------------------------- | ------------------- |
| Default `validTo: now + 3600` (no user-set deadline) | AST-W01            |
| `feeAmount` baked into the typed-data the user signs | AST-W04            |
| `partiallyFillable: false` default with no override  | AST-W04            |
| `DELETE /orders/{uid}` soft-cancel race window     | AST-W12             |
| Long-lived recurring-order session key (30d validTo) | AST-W09            |
| `cast wallet sign-typed-data --private-key`        | AST-W11             |
| No `web3` policy block in `skill.json`             | AST04, metadata     |

## Running the audit

From the repo root:

```bash
bun run --filter @agentsec/cli -- audit e2e/fixtures/profiles/web3/cowswap-swap/ --verbose
```

The `[Web3]` tag should appear in the output and at least one AST-W rule
should fire.
