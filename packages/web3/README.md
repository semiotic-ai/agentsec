# @agentsec/web3 — AST-10 Web3 Annex

> Web3-specific risk detection for AI agent skills. Extends the base
> [OWASP Agentic Skills Top 10](https://owasp.org/www-project-agentic-skills-top-10/)
> (AST10) with twelve rules unique to skills that hold keys, sign typed
> data, call smart contracts, bridge assets, or expose chain capabilities
> through MCP.

Status: **shipped in agentsec 0.2.0**. Auto-detected per skill — runs
on any skill that declares a `web3` manifest block, imports a Web3
client library, references a Web3 RPC method, or ships a `.sol` file.
Use `--profile web3` to force-apply onto every skill regardless of
detection.

---

## Why an annex

The base AST10 rules cover generic skill risks: prompt injection, over-
privilege, supply chain, unsafe deserialization. They have nothing to say
about a skill that holds a hot wallet, signs an EIP-712 Permit2 payload,
constructs an EIP-7702 `SetCodeAuthorization`, or quotes a Uniswap pool
inline with an LLM-driven trade. Those are exactly the surfaces being
weaponized in 2025–2026 (Inferno Drainer Reloaded, the EIP-7702 phishing
wave, AIXBT, Lobstar Wilde, the Sept 2025 npm `debug`/`chalk` worm,
February 2026 malicious-MCP advisories).

The annex adds twelve targeted detections so a skill that touches chain
gets audited at both the agent layer **and** the Web3 layer.

---

## Quick start

The default profile auto-detects Web3 capability per skill. No flag
required — Web3 skills get tagged `[Web3]` and the annex rules apply
automatically:

```bash
npx agentsec audit --path ./my-mixed-skills
# autotrader v1.2.0   [Web3]  F (30)
# csv-utils  v0.1.0           A (95)
```

Force-apply onto every skill (e.g. CI consistency across a team that
mixes Web3 and non-Web3 work):

```bash
npx agentsec audit --profile web3 --path ./my-skills
```

Programmatic — auto-detect:

```ts
import { Scanner } from "@agentsec/scanner";
import { detectWeb3, WEB3_RULES } from "@agentsec/web3";

const baseScanner = new Scanner();
const web3Scanner = new Scanner({ extraRules: WEB3_RULES });

for (const skill of skills) {
  const det = detectWeb3(skill);
  const scanner = det.isWeb3 ? web3Scanner : baseScanner;
  const findings = await scanner.scan(skill);
  // det.signals is a human-readable list of why detection fired
}
```

Programmatic — force-apply:

```ts
const scanner = new Scanner({ extraRules: WEB3_RULES });
```

---

## The twelve rules

| ID      | Title                                            | Default severity | AST10 parent | Detection style              |
| ------- | ------------------------------------------------ | :--------------: | :----------: | ---------------------------- |
| AST-W01 | Unbounded Signing Authority                      |    critical      |    AST03     | Manifest + signing-call regex |
| AST-W02 | Implicit Permit / Permit2 Signature Capture      |    critical      |    AST01     | EIP-712 domain + spender allowlist |
| AST-W03 | Delegation Hijack via EIP-7702                   |    critical      |    AST03     | Tx-type 0x04 + delegate allowlist |
| AST-W04 | Blind / Opaque Signing Surface                   |     high         |    AST04     | Typed-data parity check |
| AST-W05 | RPC Endpoint Substitution & Mempool Leakage      |     high         |    AST02     | RPC URL pinning + protected-RPC allowlist |
| AST-W06 | Unverified Contract Call Targets                 |     high         |    AST04     | ENS reverse-resolution + bytecode-hash pinning |
| AST-W07 | Cross-Chain / Bridge Action Replay               |     high         |    AST10     | Bridge-endpoint allowlist + idempotency |
| AST-W08 | MCP Chain-Tool Drift / Capability Smuggling      |     high         |    AST02     | MCP server hash pinning + tool-schema diffing |
| AST-W09 | Session-Key / Permission-Caveat Erosion          |     high         |    AST03     | ERC-7715 caveat completeness check |
| AST-W10 | Slippage / Oracle Manipulation by Agent Loop     |     critical     |    AST08     | TWAP/oracle declaration + deadline ceiling |
| AST-W11 | Key Material in Agent Memory / Logs              |     critical     |    AST04     | Hex/mnemonic regex into log/tool sinks |
| AST-W12 | No On-Chain Action Audit / Kill-Switch           |     high         |    AST09     | Manifest fields (`audit.sink`, `killSwitch`) |

Per-rule attack patterns, citations, and the full detection signal set
live in [docs/plans/ast10-web3-annex-rules.md](../../docs/plans/ast10-web3-annex-rules.md).
The strategic case (partnerships, integration shapes, phasing) is in
[docs/plans/ast10-web3-annex-strategy.md](../../docs/plans/ast10-web3-annex-strategy.md).

---

## The `web3` manifest block

Skills opt into structured Web3 metadata so the annex can verify scoping
without flagging well-bounded skills. The block is optional and
backwards-compatible — the existing `[key: string]: unknown` passthrough
on `SkillManifest` means nothing breaks if it's absent.

```jsonc
{
  "name": "scoped-trader",
  "version": "1.4.0",
  "web3": {
    "chains": [8453],
    "signers": ["session"],
    "policy": {
      "maxValuePerTx": "1000000000000000000",
      "allowedContracts": ["0x6fF5693b99212Da76ad316178A184AB56D299b43"],
      "allowedSelectors": ["0x3593564c"],
      "allowedChains": [8453],
      "dailyCap": "5000000000000000000"
    },
    "sessionKey": {
      "expiry": 1745000000,
      "valueLimit": "1000000000000000000",
      "targets": ["0x6fF5693b99212Da76ad316178A184AB56D299b43"],
      "selectors": ["0x3593564c"],
      "chainIds": [8453],
      "caveatEnforcer": "0x63c0c19a282a1B52b07dD5a65b58948A07DAE32B"
    },
    "mcpServers": [
      { "url": "https://mcp.anthropic.com/web3", "pinnedHash": "sha256:…", "pinnedVersion": "1.4.0" }
    ],
    "audit":      { "sink": "https://audit.example/v1/journal" },
    "killSwitch": { "contract": "0x…", "chainId": 8453 },
    "oracle":     { "source": "https://hermes.pyth.network", "type": "pyth" },
    "incident":   { "runbook": "https://example/runbooks/incident-response" },
    "rpcRegistry": "https://rpc-registry.example/pinned.json",
    "signs7702": false
  }
}
```

The full TypeScript shape is `Web3ManifestBlock` in
[`@agentsec/shared`](../shared/src/types.ts).

A clean reference fixture lives at
[`e2e/fixtures/web3/good-web3-skill/`](../../e2e/fixtures/web3/good-web3-skill/) —
it ships with all required fields populated and surfaces zero blocking
findings.

---

## Pinned data files

The annex ships with five JSON allowlists in [`src/data/`](src/data/).
They're security-critical — tampering with them is itself an attack — so
treat them like a CVE feed.

| File                   | Used by | Purpose |
| ---------------------- | ------- | ------- |
| `permit2-spenders.json` | AST-W02 | Legitimate Permit2 spender contracts (UniversalRouter, 0x Settler, …) |
| `delegate-targets.json` | AST-W03 | Vendor-verified EIP-7702 delegate implementations (MetaMask, Safe, Biconomy, ZeroDev) |
| `protected-rpcs.json`   | AST-W05 | Sandwich-resistant RPC endpoints (Flashbots Protect, MEV Blocker, bloXroute, Eden) |
| `bridge-endpoints.json` | AST-W07 | Canonical cross-chain bus contracts (LayerZero, CCIP, Wormhole, Hyperlane, Axelar) |
| `known-contracts.json`  | AST-W06 | Pinned protocol addresses (Permit2, Multicall3, WETH9, USDC, USDT) |

Every entry is a JSON object with `name` + `address` (and `chainId` /
`vendor` / `provider` where relevant) so the lists are easy to extend.
Versioned by date string — bump `version` when adding entries.

---

## What `--profile web3` actually does

1. Loads `WEB3_RULES` (12 rule definitions) from `@agentsec/web3`.
2. Passes them to `Scanner` via the new `extraRules` option (see
   [packages/scanner/src/scanner.ts:7](../scanner/src/scanner.ts:7)).
3. The merged rule set runs alongside the base AST10 rules — same SARIF
   shape, same JSON shape, same HTML report. The reporter walks finding
   `category` / `rule` strings dynamically, so the new categories
   (`web3-signing-authority`, `web3-permit-capture`, …) render without
   any reporter changes.

The CLI is the integration point; the scanner core has no compile-time
dependency on the annex. That keeps `@agentsec/scanner` lean and lets
external consumers swap the annex out, layer additional packs on top,
or run the base profile in CI by default with the annex gated to
Web3-touching projects.

---

## Tests

| Suite                                  | Count            | Where |
| -------------------------------------- | ---------------- | ----- |
| Per-rule unit tests                    | **208 pass**     | [`packages/web3/src/__tests__/`](src/__tests__/) (12 files) |
| End-to-end pipeline tests              | **17 pass**      | [`e2e/web3.test.ts`](../../e2e/web3.test.ts) |
| Vuln fixture skills                    | 12               | [`e2e/fixtures/web3/w*/`](../../e2e/fixtures/web3/) |
| Clean reference fixture                | 1                | [`e2e/fixtures/web3/good-web3-skill/`](../../e2e/fixtures/web3/good-web3-skill/) |

Run locally:

```bash
bun run --filter @agentsec/web3 test
bun test e2e/web3.test.ts
```

---

## Frameworks the annex aligns with

- **OWASP SCSVS** — particularly SCSVS-AUTH and SCSVS-ARCH, mapped onto AST-W01 / W09
- **OWASP Smart Contract Top 10 (2025/2026)** — referenced for any AST-W rule that inherits a contract-side vulnerability
- **SWC Registry** — finding metadata can carry an `inheritsFrom: SWC-XXX` hint
- **EIP-7715 / EIP-7710** — canonical session-key / delegation pattern AST-W09 enforces
- **EIP-7702** — capability whose misuse is AST-W03
- **Flashbots Protect / MEV Blocker / bloXroute** — RPC allowlist for AST-W05

---

## Limitations of v0.2.0

- Static-analysis only. No runtime sidecar yet — agent-loop dynamic risks
  (W08 capability smuggling, W10 polling-cadence side-channels) are
  detected by their static fingerprints, not by live observation.
- EVM-flavored. No Solana / Move / Cosmos rules in this release.
- No bytecode parsing. Contract-target detection (W06) compares against
  pinned addresses and ENS reverse-resolution, not on-chain bytecode hashes.
- The annex audits **the agent**, not **the contracts it talks to**.
  Use a smart-contract auditor (CertiK, Hacken, Cantina, Cyfrin, Trail of
  Bits, OpenZeppelin) for the contract layer; agentsec for the agent
  layer.

---

## License

MIT, same as the rest of the workspace.
