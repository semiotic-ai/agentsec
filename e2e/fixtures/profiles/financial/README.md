# Financial agent skills (placeholder)

## Intent

Hosts skills that touch fiat payments, banking APIs, accounting ledgers, KYC / KYB providers, tax engines, and similar money-adjacent surfaces. The audit goal is to surface AST10 risks that cluster around financial workflows (over-privileged skills, weak isolation around transaction signing, supply-chain compromise of payment SDKs, governance gaps).

## Status

Empty scaffold — populate when we expand the fixture suite beyond Web3.

## Suggested initial fixtures

- `stripe-payments` — mock Stripe charge / refund / payout handler.
- `plaid-balances` — mock Plaid Link + balance / transactions reader.
- `tax-calc` — mock sales-tax computation skill (Avalara / TaxJar shape).

When this profile is filled in, follow the structure used by `../web3/` (a per-profile `index.json` plus one fixture directory per skill, with the AST-W → AST10 expected-rule mapping documented in this README).
