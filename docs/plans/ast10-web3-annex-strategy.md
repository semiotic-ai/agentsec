# AST-10 Web3 Annex — Strategy Plan

**Status:** Draft v0.1 · 2026-04-29
**Owner:** @Markeljan
**Scope:** ship a Web3-specific extension to the OWASP Agentic Skills Top 10 (AST10) inside [agentsec](https://github.com/semiotic-ai/agentsec), and use it as the wedge to land partnerships with [Virtuals Protocol](https://virtuals.io), the Coinbase / [Agentic.market](https://agentic.market) / Base ecosystem, and to power [deckard.network](https://deckard.network).

---

## 1. Strategic thesis

The base AST10 rules in [packages/scanner/src/rules/index.ts:40](packages/scanner/src/rules/index.ts:40) cover *generic* skill risks: prompt injection, over-privilege, unsafe deserialization, supply chain, etc. They have nothing to say about a skill that holds a hot wallet, signs Permit2, builds 7702 authorizations, or quotes a Uniswap pool inline with an LLM-driven trade — which is the actual surface where agent skills are being weaponized in 2025–2026 (Inferno Drainer Reloaded, EIP-7702 phishing waves, AIXBT compromise, Lobstar Wilde, Trust Wallet extension, the Sept 2025 npm `debug`/`chalk` worm).

That's the gap. **agentsec is the first scanner positioned to be the AI-agent-skill auditor** — none of the smart-contract auditors (CertiK, Hacken, Cantina, Cyfrin, Trail of Bits) operate at the prompt/skill/MCP layer, and none of the AI-security incumbents (HiddenLayer, Lasso, CalypsoAI) operate on tokenized on-chain agents. The Web3 Annex turns that white space into a productizable rule pack, a partnership story, and a public reputation primitive that Deckard / Virtuals / Coinbase can all consume.

Three deliverables, in priority order:

1. **AST-W01..W12** — a Web3 annex rule pack shipped as `@agentsec/web3` and gated behind `agentsec audit --profile web3`.
2. **Partnership tracks** — Virtuals (Unicorn Launchpad gate + ACP service-provider badge), Coinbase Agentic.market (EAS attestation schema on Base), ElizaOS (plugin registry badge — fast follow).
3. **Deckard integration** — agentsec becomes a first-class reputation source on the [ERC-8004](https://eips.ethereum.org/EIPS/eip-8004) Reputation Registry and powers Deckard Scout's static analysis.

---

## 2. AST-10 Web3 Annex — proposed rule pack

Twelve categories. Each has a one-line title; the brainstorm appendix below has full descriptions, attack-pattern citations, detection signals, and AST10 parent mapping. Severities are placeholders pending real fixture testing.

| ID       | Title                                              | Parent  | Detection primitive                                                |
| -------- | -------------------------------------------------- | ------- | ------------------------------------------------------------------ |
| AST-W01  | Unbounded Signing Authority                        | AST03   | manifest fields + missing policy caps                              |
| AST-W02  | Implicit Permit / Permit2 Signature Capture        | AST01   | EIP-712 domain matching, Permit2 spender allowlist                 |
| AST-W03  | Delegation Hijack via EIP-7702                     | AST03   | tx-type 0x04 construction, delegate allowlist                      |
| AST-W04  | Blind / Opaque Signing Surface                     | AST04   | typed-data parity check (`viem.hashTypedData` vs preview)          |
| AST-W05  | RPC Endpoint Substitution & Mempool Leakage        | AST02   | RPC URL pinning, protected-RPC requirement above threshold         |
| AST-W06  | Unverified Contract Call Targets ("Calldata Conf") | AST04   | bytecode-hash pinning, ENS reverse-resolution checks               |
| AST-W07  | Cross-Chain / Bridge Action Replay                 | AST10   | bridge endpoint allowlist + idempotency-key enforcement            |
| AST-W08  | MCP Chain-Tool Drift / Capability Smuggling        | AST02   | MCP server hash pinning, tool-schema diffing                       |
| AST-W09  | Session-Key / Permission-Caveat Erosion            | AST03   | ERC-7715 caveat completeness check (expiry + valueLimit + targets) |
| AST-W10  | Slippage / Oracle Manipulation by Agent Loop       | AST08   | TWAP/oracle declaration check, deadline ceiling                    |
| AST-W11  | Key Material in Agent Memory / Logs                | AST04   | hex/mnemonic regex flowing into log/tool sinks                     |
| AST-W12  | No On-Chain Action Audit / Kill-Switch             | AST09   | manifest field check (`audit.sink`, `killSwitch.contract`)         |

The annex namespaces under and cross-references **OWASP SCSVS**, the **OWASP Smart Contract Top 10 (2025/2026)**, the **SWC Registry**, and EIPs **7702 / 7715 / 7710** rather than reinventing terminology.

The full draft of all twelve categories — title, attack pattern, real incident citation, detection signal, AST10 parent — lives in **Appendix A** of this document and was generated from a parallel research pass; review and edit before publishing.

---

## 3. Implementation plan inside the agentsec repo

The repo is intentionally Web3-agnostic today (a grep across the codebase produced exactly zero hits for `ethers`, `viem`, `solidity`, `0x[a-fA-F0-9]{40}`, etc. — only one `keychain:read` permission string and a comment about "trusted signers"). Clean slate.

### 3.1 Where the new rules live

Create a new workspace package at **`packages/web3/`** (`@agentsec/web3`). Mirrors the existing `metrics` / `policy` / `openclaw` shape. Internal dep on `@agentsec/shared` only, consumed by `@agentsec/cli`.

```
packages/web3/
  src/
    index.ts                # exports WEB3_RULES: RuleDefinition[]
    rules/
      signing-authority.ts  # AST-W01
      permit2.ts            # AST-W02
      eip7702.ts            # AST-W03
      typed-data.ts         # AST-W04
      rpc.ts                # AST-W05
      contract-targets.ts   # AST-W06
      bridge.ts             # AST-W07
      mcp-chain-tools.ts    # AST-W08
      session-keys.ts       # AST-W09
      oracle-slippage.ts    # AST-W10
      key-material.ts       # AST-W11
      audit-sink.ts         # AST-W12
    primitives/
      eth-regex.ts          # shared regex constants (0x..., hex-32, mnemonic)
      eip712.ts              # typed-data parity helpers
      mcp-introspect.ts      # MCP tool-schema diff utilities
      allowlists/
        permit2-spenders.json
        delegate-targets.json
        bridge-endpoints.json
        protected-rpcs.json
  package.json
  tsconfig.json
  README.md
```

Allowlists are versioned JSON files updated like a CVE feed. Treat the Permit2-spender list as security-critical: tampering with it is itself an attack — it gets pinned by hash in `skills-lock.json` and verified at scanner startup.

### 3.2 Wiring into the scanner

The `RuleDefinition` interface at [packages/scanner/src/rules/index.ts:26](packages/scanner/src/rules/index.ts:26) is sufficient as-is. Two integration paths exist; do **(A) first**, leave **(B)** as the long-term seam:

- **(A) Static merge.** `@agentsec/scanner` imports `WEB3_RULES` from `@agentsec/web3` behind a profile flag. Concretely: in [packages/scanner/src/scanner.ts](packages/scanner/src/scanner.ts), add `profile: "default" | "web3" | "strict"` to the constructor and conditionally extend `ALL_RULES`. Zero behaviour change for existing users.
- **(B) Plugin path.** `ScannerPlugin` already exists at [packages/shared/src/types.ts:168](packages/shared/src/types.ts:168) and accepts async scanners. Future: ship `@agentsec/web3` as a plugin loadable via `agentsec.config.json` so external rule packs follow the same pattern. Don't gate the annex on this — implement after the rule pack is stable.

### 3.3 Type extensions

Two surgical edits in `@agentsec/shared`:

1. **Extend `OWASPCategory`** at [packages/shared/src/types.ts:91](packages/shared/src/types.ts:91) with the twelve new Web3 string literals (`"web3-signing-authority"`, `"web3-permit-capture"`, …). Reporters render these unchanged — verified by reading [packages/reporter/src/formats/sarif.ts](packages/reporter/src/formats/sarif.ts), which produces dynamic SARIF rule IDs from the `rule` field.
2. **Optional `web3` block on `SkillManifest`** at [packages/shared/src/types.ts:25](packages/shared/src/types.ts:25). The current manifest interface already has `[key: string]: unknown` passthrough, so this is non-breaking. Proposed shape:

   ```ts
   web3?: {
     chains?: number[];                // declared chainIds
     signers?: ("hot" | "session" | "tee" | "external")[];
     policy?: {
       maxValuePerTx?: string;         // bigint as string (wei)
       allowedContracts?: string[];
       allowedSelectors?: string[];
       dailyCap?: string;
       expiry?: number;                // unix seconds
     };
     mcpServers?: { url: string; pinnedHash?: string }[];
     audit?: { sink?: string };
     killSwitch?: { contract?: string; chainId?: number };
   }
   ```

   The annex rules read this block; absence of expected fields is itself a finding (e.g. AST-W01 fires if `signers` includes `"hot"` and `policy.maxValuePerTx` is missing).

### 3.4 CLI surface

In [packages/cli/src/config.ts](packages/cli/src/config.ts) and [packages/cli/src/cli.ts](packages/cli/src/cli.ts):

- `--profile <name>` flag — values `default | web3 | strict`. `strict` = base + web3 with severities raised one tier.
- Config-file equivalent: `"profile": "web3"` in `.agentsecrc` / `agentsec.config.json`.
- `--web3-chains 8453,1,42161` to scope rules per declared chain.
- Help text: ship a worked example showing `agentsec audit --profile web3 ./skills/my-trader-agent`.

### 3.5 Fixtures, tests, examples

- Add an end-to-end fixture under [e2e/fixtures/web3/](e2e/fixtures/) per rule — one positive, one negative — mirroring the convention used by the existing fixtures.
- Update [examples/audit-report.{txt,json,html,sarif}](examples/) by re-running the bump script (`bun run bump --skip-versions`) — see [AGENTS.md](AGENTS.md) for the version-stamps gotcha.
- New CI job: `bun run --filter @agentsec/web3 test` in the matrix.

### 3.6 SKILL.md / ClawHub mirror

Update [skills/agentsec/SKILL.md](skills/agentsec/SKILL.md) frontmatter with a Web3 capability advertisement so the ClawHub publish (auto-mirrored on tag per the release flow described in [AGENTS.md](AGENTS.md)) shows the annex. Also update [apps/landing/components/Hero.tsx](apps/landing/components/Hero.tsx) to surface the `--profile web3` story alongside the existing AST10 messaging.

### 3.7 Versioning

Annex ships as a minor bump — propose **agentsec 0.2.0** (current is 0.1.6). Don't add an annex behind a feature flag in a 0.1.x patch; the rule surface is too big and the partnership conversations want a clean version to point at.

---

## 4. Partnership track A — Virtuals Protocol

**Why first:** Virtuals has 11k+ tokenized agents, audits its *own contracts* with PeckShield/Cantina but **has nobody auditing the agents themselves** — and they took a public hit in Dec 2024 (the Jinu / AgentToken bug ignored on Discord, plus a moderator-key compromise on Jan 8, 2025). Their security posture has visible institutional appetite, and the recently-launched Virtuals Revenue Network pays up to $1M/month to ACP-active agents — meaning agent quality directly drives protocol revenue, which means audit is a first-order concern, not a nice-to-have.

### 4.1 Three concrete pitches, ordered by leverage

1. **Pre-graduation gate on the Unicorn Launchpad.** Bonding-curve graduation at the 42k VIRTUAL threshold becomes the natural enforcement point. Proposal: `agentsec audit --profile web3` must produce no AST-W01/02/03/09/12 critical or high findings before an agent can list. Implementation co-owned: agentsec ships a webhook + signed report; Virtuals runtime checks the signature and gates LP creation. Public win for both parties — Virtuals gets a story to tell after the Jinu incident, agentsec gets distribution into 11k agents.

2. **ACP service-provider badge.** The Agent Commerce Protocol's four-phase escrow flow needs counterparty trust. Proposal: ACP service definitions can be tagged with an `agentsec_grade` (A/B/C/D/F, mirroring the existing [packages/shared/src/types.ts:72](packages/shared/src/types.ts:72) grade). The badge surfaces in counterparty negotiation as a public reputation signal and as a pre-condition for routing through the Revenue Network's $1M/month distribution.

3. **Skynet-style score in the marketplace UI.** Direct lift of CertiK's playbook (six-category score, 17,000+ projects, public leaderboard) but for agents, not contracts. agentsec produces a four-axis score (Code, Permissions, Supply-Chain, Web3) per agent, displayed next to each Virtuals listing. The Cantina relationship Virtuals already has provides the institutional template — they're already paying for security signal.

### 4.2 BD path

- **Strongest:** governance proposal on [gov.virtuals.io](https://gov.virtuals.io). ≥0.10% veVIRTUAL gets a wallet a proposal slot. A passed proposal mandating audit thresholds is the most defensible co-sign and forces a structural answer rather than a single BD conversation.
- **Fastest:** DM to founders on X (@everythingempt0, @luaa_xyz) with a link to a working `agentsec audit --profile web3 <virtuals-agent>` run on a real graduated agent. Show, don't tell.
- **Cleanest:** through their existing security vendor relationship — Cantina has a "managed bounty + audit + multisig" portfolio with Virtuals; agentsec slots in as the agent-layer extension to that bundle.

### 4.3 Commercial shape

Closest analogues:

- **CertiK Skynet** — per-audit + public score + badge-in-marketplace. Tiered KYC / Verified-Contract bundle.
- **Hacken Retainer** — fixed monthly fee with ≤5 monitored deployments included. Maps to AST07 (Update Drift) + AST02 (Supply Chain) recurring scans.
- **Cantina/Cyfrin co-hosted competitions** — automated baseline + community review.
- **Quantstamp / OpenZeppelin tiered** — free auto-scan at submission, paid manual review unlocks.

Pitch shape: free `agentsec audit --profile web3` on every Launchpad submission (drives funnel and brand), paid manual review for graduated agents above a TVL threshold (revenue), recurring drift scan retainer for graduated agents (stickiness). Structure the badge as an EAS attestation on Base so it composes with both the Virtuals registry and Coinbase Verifications — same primitive serves both partnerships.

---

## 5. Partnership track B — Coinbase Agentic.market / AgentKit / Base

**Why second (but not lower priority):** Coinbase's [Agentic.market](https://agentic.market) launched in April 2026 and is an order of magnitude larger than Virtuals on transactions: 165M+ tx, 480k+ agents, $50M+ volume across inference / data / media / search / social / infra / trading. Trust stack is **AgentKit + Agentic Wallets + EAS attestations** — they have the on-chain attestation rails *already in production* via [github.com/coinbase/verifications](https://github.com/coinbase/verifications). agentsec doesn't need to build trust infrastructure, just publish into theirs.

### 5.1 Concrete shape

- **Define an EAS schema** `agentsec.audit.v1` on Base (the natural canonical chain since Virtuals + Coinbase + Deckard all live there). Schema fields: `skillCID`, `agentsecVersion`, `profile`, `grade`, `astFindings` (RLE), `web3Findings` (RLE), `auditedAt`, `auditorAddress`. Sign attestations from `agentsec.eth`.
- **Action Provider audit gate.** AgentKit's Action Providers are the equivalent of skills. Pitch a "verified Action Provider" badge surfaced in Agentic.market's directory, gated by a clean EAS attestation.
- **Coinbase Verifications integration.** The attestation registry already extends to agent identity. Proposal: extend the registry's *agent-trust* tier with `agentsec_audited` as a first-class verification alongside Verified Country / KYC / Hackathon.

### 5.2 BD path

[coinbase.com/developer-platform](https://www.coinbase.com/developer-platform) BD; Jesse Pollak (@jessepollak) on X; hackathons in the Base ecosystem are a high-leverage discovery surface.

---

## 6. Partnership track C — ElizaOS (fast follow)

ElizaOS / ai16z runs a **plugin registry at [github.com/elizaos-plugins/registry](https://github.com/elizaos-plugins/registry)** which is JSON-mapped GitHub repos with **no formal audit gate**. There's already a published prompt-injection memory-poisoning vulnerability in ElizaOS itself. Deploy `agentsec audit --profile web3` against the registry as a one-off scan, publish the leaderboard, file PRs that fix any AST-W critical findings, and use the resulting visibility to negotiate an audit gate as a registry merge requirement.

This is a low-cost / high-PR-value play; one engineer-week with the annex shipped.

---

## 7. Deckard.network integration

The strongest single play in this plan, for a specific reason: **Deckard is a reputation agent for ERC-8004 / x402 — i.e. it's literally a customer for "structured, signed verdicts about agents." That's exactly what agentsec produces.** And from on-chain inspection, Deckard is itself a Virtuals-launched agent (token contract `0x6ec2FD5636c71b624b3f3B03248aa7F9FD5e98de` on Base, deployed via Virtuals' AgentTokenV2 by `deckardnetwork.eth` ~171 days ago, currently a prototype). So **Deckard is a Virtuals-ecosystem proof-of-concept for the Virtuals partnership pitch.**

> **Open question for Mark:** the research agent flagged that the relationship between you and deckard.network needs explicit confirmation — contract creator is `deckardnetwork.eth`, but the framing "we also have the deckard.network project" leaves it ambiguous whether you own / operate / partner-with it. The integration design only really diverges on point 7.5 below; the rest works either way.

### 7.1 Integration shapes (ranked by leverage)

1. **Reputation Registry attestations.** Run agentsec, hash the report, CID it on IPFS, write the AST10 grade + CID into the **ERC-8004 Reputation Registry** as a feedback signal from `agentsec.eth`. Deckard's UI already surfaces feedback signals. **agentsec becomes a first-class reputation source the network can read out of the box.** This is the same EAS-on-Base primitive used in the Coinbase track — one attestation, two consumers.
2. **Deckard Scout audit module.** Scout already "scans the ERC-8004 ecosystem and reports trust signals." Embed the agentsec scanner as Scout's static-analysis brain — Scout discovers an ERC-8004 agent, fetches its declared SKILL.md / endpoint, runs `agentsec audit --profile web3`, posts the result as a Validation Registry entry.
3. **Investigation-as-a-service skill.** Publish `agentsec` itself as a Deckard agent (claimed under `agentsec.eth`) that accepts x402-paid investigation requests. User pays, agentsec audits, verdict + report CID lands on-chain. Direct revenue, no integration debt.
4. **ClawHub ↔ Deckard bridge.** Every skill on ClawHub gets an agentsec scan automatically (already happening on tag); the badge appears on both ClawHub and Deckard. Skills that fail are flagged on both surfaces. Cross-platform-reuse play — directly addresses AST10.
5. **ERC-8004-specific rule sub-pack.** AST-W rules currently target generic Web3 surfaces; an ERC-8004 sub-pack (`AST-W08004-*` namespace) would cover registry impersonation, stale validation proofs, x402 receipt tampering, signer-key rotation. Smaller scope, ship after main annex.

### 7.2 What Deckard appears to lack today (the wedge)

From the research pass: no published rubric for what an "investigation" inspects, no code-level / skill-content scanning, no mapping to a recognized risk taxonomy, no standardized score format. agentsec brings all four. Deckard brings the consumer.

### 7.3 Open questions / verification needed before locking the plan

- Confirm Deckard's relationship to the user (own / operate / partner).
- Confirm whether the Deckard codebase is open or closed (no public GitHub org found).
- Confirm $DECKARD utility (payment, governance, validator-stake, all three?).
- Confirm whether Scout already invokes any external scanners.

---

## 8. Phasing and acceptance gates

| Phase | Weeks | Deliverable                                                                                  | Gate to next                                                       |
| ----- | ----- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| 0     | 1     | Annex spec finalized (Appendix A reviewed + edited)                                          | Sign-off on the 12 AST-W categories                                |
| 1     | 2–3   | `@agentsec/web3` package skeleton + first 4 rules (W01, W02, W05, W11)                       | All 4 rules pass fixture tests, SARIF output verified              |
| 2     | 4–5   | Remaining 8 rules + `--profile web3` CLI flag + manifest `web3` block                        | `agentsec audit --profile web3` clean on a known-good Virtuals agent |
| 3     | 6     | EAS schema `agentsec.audit.v1` deployed on Base; `agentsec.eth` attestation pipeline running | One real attestation visible on-chain                              |
| 4     | 6–7   | Deckard Reputation Registry integration (track C, shape 1)                                   | Deckard UI surfaces an agentsec badge for at least one agent       |
| 5     | 7–8   | Virtuals BD outreach (governance proposal draft + founder DM with working demo)              | First conversation booked                                          |
| 6     | 8–10  | ElizaOS plugin-registry leaderboard scan + PR campaign                                       | Public leaderboard published                                       |
| 7     | 10–12 | Coinbase / Agentic.market BD                                                                 | Verifications schema conversation booked                           |
| 8     | 12+   | agentsec 0.2.0 GA tagged + ClawHub mirror + landing-page refresh                             | Released                                                           |

Each phase gate is a real artifact, not a slide.

---

## 9. Risks & decision points

1. **Allowlist maintenance burden.** Permit2 spenders, EIP-7702 delegate targets, bridge endpoints all evolve. Need a CI job that re-fetches and re-signs the lists. Decision: who hosts the canonical source?
2. **OWASP namespace.** "AST-W##" assumes OWASP doesn't already plan a Web3 annex for AST10. If they do, align rather than fork. Decision: file an issue on the OWASP project before publishing the annex publicly.
3. **False-positive rate.** Static rules on prompt-driven systems are inherently noisy. The annex needs a `--severity-floor` config and a per-skill `.agentsec-allow.yaml` to suppress acknowledged findings — otherwise it gets disabled by frustrated agent authors and the partnership story dies. Build the suppression UX in phase 2, not later.
4. **Deckard ambiguity.** Resolve before phase 4 — see §7.3.
5. **Agent-loop dynamic risks (W08, W10).** These are harder to detect statically than the others; they may need a runtime sidecar component down the road. Don't promise it in v0.2.0.

---

## 10. What we are *not* doing in v0.2.0

- No runtime monitor / sidecar (deferred to v0.3.0).
- No EVM bytecode parsing — only declared-contract allowlist matching.
- No Solana / Move / Cosmos rules. Twelve EVM-flavored rules first; multi-VM in v0.3.0.
- No reinventing OWASP SCSVS / SC Top 10 — cross-reference, don't duplicate.
- No replacement for traditional smart-contract auditors. The annex audits *the agent*, not *the contract it talks to*.

---

## Appendix A — AST-W## full draft

The full text of the twelve rules — title, what it is, real example, detection signal, AST10 parent — was generated in the parallel research pass and is staged separately. Move it under [docs/plans/ast10-web3-annex-rules.md](docs/plans/ast10-web3-annex-rules.md) (TODO: write that file from the parallel-agent output once Mark has signed off on the category list above).

## Appendix B — Sources

Inferno Drainer Reloaded (Check Point); EIP-7702 phishing analyses (Three Sigma, Nethermind, arXiv:2512.12174); Permit2 phishing (Revoke.cash, ImmuneBytes); Freysa writeup (Simon Willison); Sandwich attacks 2025 (CoinGecko); Anthropic Red AI agents on smart contracts; Virtuals Whitepaper + governance + Cantina portfolio; Coinbase Agentic.market launch + AgentKit + Verifications; CertiK Skynet; Hacken Retainer; Cyfrin co-hosted audits; Trail of Bits AI-native blog + Skills; ERC-8004 EIP; Virtuals AgentTokenV2 BaseScan; OECD.AI incident database; OWASP SCSVS; OWASP SC Top 10 2026; SWC Registry. Full URL list available in the parallel-research output if needed.
