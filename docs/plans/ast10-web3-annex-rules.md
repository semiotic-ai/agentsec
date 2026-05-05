# AST-10 Web3 Annex — Full Rule Draft

**Companion to:** [ast10-web3-annex-strategy.md](docs/plans/ast10-web3-annex-strategy.md)
**Status:** Draft v0.1 · 2026-04-29
**Note:** Generated from a parallel research pass. Each entry needs review before publishing — particularly the detection signals, which determine implementation difficulty.

The annex extends the OWASP Agentic Skills Top 10 (AST10) with risks unique to AI agent skills that interact with blockchains: signing transactions, holding/managing keys, calling RPC, calling smart contracts, executing trades, bridging assets, signing typed data, exposing chain capabilities through MCP. It does **not** restate generic smart-contract auditing concerns. It assumes the reader is familiar with OWASP SCSVS, the SWC registry, and the OWASP Smart Contract Top 10 (2025/2026), and namespaces under those where appropriate.

---

## AST-W01 — Unbounded Signing Authority

**What it is.** The skill is granted a signing key (or session key) with no per-call value cap, no allowlist of callable contracts, no rate limit, and no chain restriction. Once an agent has the key in memory, any prompt-injected instruction or model hallucination can produce a valid, broadcastable transaction draining everything the key controls. Differs from generic key-mgmt risk because the *agent loop* is the attacker's payload delivery vehicle.

**Real example / pattern.** The **Freysa** experiment (Nov 2024) — an autonomous agent guarding ~$47k was talked into calling `approveTransfer` on attempt #482 via a fake "admin terminal / new session" prompt-injection. The signing capability was unconditional; only the model's judgment stood between the attacker and the funds. A more recent variant (April 2026, "LLM Router" incident) saw a malicious router inject tool calls that drained ~$500k from a connected wallet.

**Detection signal.** Manifest fields like `wallet.signer: hot` or `keys.private` without an accompanying `policy.maxValuePerTx`, `policy.allowedContracts[]`, `policy.allowedChains[]`, or `policy.dailyCap`. Regex on tool definitions for `eth_sendTransaction` / `signTransaction` / `personal_sign` exposed without a co-located caveat enforcer or session-key reference. Absence of an ERC-7715 `permissions` block when the skill claims to "trade for the user."

**Maps to AST10 parent.** **AST03 — Over-Privileged Skills** (with secondary AST06 Weak Isolation).

---

## AST-W02 — Implicit Permit / Permit2 Signature Capture

**What it is.** Skills that present users with an EIP-712 message to sign, where the message is actually an ERC-2612 `permit()` or a Uniswap **Permit2** `PermitSingle/PermitBatch` granting unlimited allowance to an attacker-controlled spender. Unlike `approve()` this leaves no on-chain footprint until exploitation, so post-hoc revocation and explorer-based detection both fail. The skill is the social-engineering layer because users trust the agent's framing of what they're signing.

**Real example / pattern.** Permit2 phishing has become the dominant vector behind **Inferno Drainer Reloaded** ($9M+ across 30k wallets, Sept 2024–Mar 2025) and **Vanilla Drainer** (~$5.27M). Drainer kits ship pre-built Permit2 payloads; the affiliate-as-a-service model takes a 20–30% cut. Academic research (ACM IMC 2025) attributes $135M+ in losses to DaaS phishing.

**Detection signal.** Static check for any flow where the skill calls `signTypedData` / `eth_signTypedData_v4` with a domain matching `Permit2` (`0x000000000022D473030F116dDEE9F6B43aC78BA3`) or a `Permit` primary type, and the `spender` / `owner` / `deadline` / `amount` fields are not surfaced as explicit user-confirmation parameters. Flag any unbounded `amount: type(uint256).max` in templates. Cross-reference against a maintained allowlist of legitimate Permit2 spender contracts.

**Maps to AST10 parent.** **AST01 — Malicious Skills** (with secondary AST04 Insecure Metadata when the EIP-712 domain is misrepresented in skill docs).

---

## AST-W03 — Delegation Hijack via EIP-7702

**What it is.** Post-Pectra (May 2025), an EOA can attach smart-contract code to itself via a 7702 authorization. A skill that asks for a signed `Authorization` tuple — disguised as a "wallet upgrade," "AI assistant install," or "gas sponsorship setup" — can install attacker-controlled code that batch-drains tokens, NFTs, and approvals in a single subsequent tx. The agent context makes this worse: agents legitimately request capability upgrades, so users have weaker priors against an upgrade prompt.

**Real example / pattern.** A May 2025 phishing scam drained **$1.54M** via a malicious 7702 delegation; SlowMist tracked the **1,988 QNT theft** from a token reserve pool tied to a misconfigured 7702 delegate; aggregate phishing-via-7702 has been measured at **$12M across 15k+ wallets**. SlowMist and ThreeSigma report **>90% of observed 7702 delegations on-chain are linked to malicious "sweeper" contracts**.

**Detection signal.** Manifest declares `signs7702: true` or the code path constructs a `SetCodeAuthorization` (tx type `0x04`). Regex for `delegationDesignator` / `0xef0100` prefix construction. Detector flags if the target `address` in the authorization is not in a project-maintained `delegationAllowlist` (e.g. MetaMask Smart Account, Safe7702, Biconomy verified implementations) and if the chain ID is `0` (cross-chain replayable). Warn on any skill that builds 7702 auths without a `revokeAfter` UX flow.

**Maps to AST10 parent.** **AST03 — Over-Privileged Skills** (with strong secondary AST07 Update Drift, since 7702 delegations are the on-chain analog of unsigned auto-updates).

---

## AST-W04 — Blind / Opaque Signing Surface

**What it is.** The skill funnels an EIP-712 (or raw `eth_sign`) payload to the user without rendering the typed fields, or with a mis-rendered preview that doesn't match the bytes actually signed. Even valid EIP-712 doesn't help if the agent's tool-call summary diverges from the wallet's signature panel, or if the payload exploits known wallet-side EIP-712 injection bugs (whitespace tail, chainId omission, nested struct hiding).

**Real example / pattern.** Coinspect disclosed an **EIP-712 text-injection bug affecting 40+ wallet vendors** where attackers placed malicious primary fields beneath whitespace padding so they were invisible in the preview but binding in the signature. The Coinspect chainId-omission flaw let cross-chain replay against intended `chainId` = different from displayed.

**Detection signal.** Skill renders signing messages from string templates using `JSON.stringify` or model-generated text rather than the structured `EIP712Domain` types. No call to a normalizer like `viem`'s `hashTypedData` for parity with what the wallet will hash. Absence of a `chainId` and `verifyingContract` field in declared domain. Lint: any `personal_sign` exposed as a tool when `signTypedData_v4` would suffice (downgrade attack surface).

**Maps to AST10 parent.** **AST04 — Insecure Metadata** (with AST08 Poor Scanning as secondary — preview ≠ payload is a scanning failure mode).

---

## AST-W05 — RPC Endpoint Substitution & Mempool Leakage

**What it is.** The skill hardcodes or accepts an RPC URL that an attacker can substitute (typo-squatted domain, env-var injection, malicious MCP config), or it broadcasts to a public mempool when a private/protected RPC was warranted. Substituted RPCs can lie about chain state (fake balances, forged `eth_call` results that bait the agent into bad trades) and harvest the agent's pending tx for sandwiching. Public-mempool broadcast lets MEV bots front-run the agent deterministically.

**Real example / pattern.** 2025 Ethereum MEV totaled ~**$561.9M** with sandwich attacks at **51.56% (~$289.8M)**; Flashbots Protect / MEV Blocker / bloXroute exist precisely because public-mempool submission is exploitable. RPC-swap variants of clipper malware (e.g. Meeten/Realst campaign) modify wallet config to reroute calls. "AI-powered" sandwich bots emerged in 2025 specifically targeting predictable agent traders.

**Detection signal.** Manifest's `rpcUrl` is a hardcoded string rather than a resolver against a pinned, hash-verified registry. No `chainId` cross-check after each `eth_chainId` response. The skill calls `eth_sendRawTransaction` against a non-protected RPC when transacting >$X (configurable threshold) on Ethereum mainnet / L2s with public mempools. Lint: presence of `tenderly` / `infura` URLs without an ENV indirection, OR ENV indirection without integrity verification on resolve.

**Maps to AST10 parent.** **AST02 — Supply Chain Compromise** (RPC is part of the agent's runtime supply chain; secondary AST06 Weak Isolation since a poisoned RPC breaches the trust boundary).

---

## AST-W06 — Unverified Contract Call Targets ("Calldata Confusion")

**What it is.** The skill receives or constructs `to + calldata` from model output, an MCP tool result, or untrusted user input, without validating the destination is the contract it claims to be. The agent might intend `swap()` on Uniswap and instead call a lookalike router or a malicious proxy that re-encodes the same selector. Address-poisoning is the same family: the agent picks a recently-seen address from history without verifying full bytes.

**Real example / pattern.** Address-poisoning losses since Jan 2025 average **160k+ poisoned txs/day** per Blockaid; one **Dec 2025 USDT trade lost ~$50M** to a single character-prefix-matched address. Lookalike router contracts on multiple chains regularly farm 4byte-collision selectors.

**Detection signal.** Skill resolves `address` strings from model output without an allowlist or ENS-with-reverse-resolution check. No bytecode-hash pinning for known protocol addresses (`UniversalRouter`, `Permit2`, `Multicall3`, etc.). Lint: address comparison via `.toLowerCase() ===` rather than `getAddress()` (checksum-aware). Detector flags decoding that trusts function-selector match without ABI verification on the actual destination.

**Maps to AST10 parent.** **AST04 — Insecure Metadata** (target address *is* metadata; secondary AST01 Malicious Skills if intentionally swapped).

---

## AST-W07 — Cross-Chain / Bridge Action Replay

**What it is.** Skills that bridge assets either (a) submit auth signatures lacking `chainId` or `nonce` discipline, allowing replay across chains; (b) trust bridge oracles or relayer endpoints they don't pin; or (c) rely on a partial bridge confirmation as proof of finality and compose follow-on actions atomically across chains. An agent loop makes (c) particularly dangerous because the agent will retry on partial failure and double-bridge.

**Real example / pattern.** **Ronin Bridge** re-exploited May 2025 ($600M+ historical, $12M in newer May 2025 incident). **Multichain** validator-takeover ($126M) and **Wormhole**-connected protocol exploits ($94M+) over 2024–2025. Bridge-related losses in the 2024–2025 window crossed **$320M+**.

**Detection signal.** Skill code constructs cross-chain messages (LayerZero, CCIP, Wormhole, Hyperlane) without a `dstChainId` validator that maps to an allowlisted bridge endpoint. No `verifyingContract`-style domain separation in EIP-712 messages destined for bridges. Lint: agent retry-on-failure logic wraps a bridge call without idempotency-key enforcement (nonce or `messageId` tracking). Skill-declared `chains[]` list includes >2 chains without a `bridgeProvider` declaration.

**Maps to AST10 parent.** **AST10 — Cross-Platform Reuse** (the namesake category, now applied across chains rather than across agent platforms; secondary AST07 Update Drift since bridges receive frequent operator-key rotation).

---

## AST-W08 — MCP Chain-Tool Drift / Capability Smuggling

**What it is.** A skill depends on an MCP server exposing chain tools (`eth_sendTransaction`, `getBalance`, `swap`). The MCP server can be silently updated to add new tools, expand parameter schemas, return prompt-injection content in tool results, or rebind the same tool name to a different RPC/contract. Because MCP capabilities are negotiated at runtime, the static manifest doesn't capture what the agent actually has on day N+1.

**Real example / pattern.** A Feb 2026 advisory documented a **malicious MCP server registering "harmless" tools that read `~/.ssh`, `~/.aws`, and `.npmrc`** while embedding prompt injections targeting Claude Code, Cursor, Windsurf, and VS Code. The Sept 2025 **npm `debug`/`chalk` worm** (Shai-Hulud) injected a wallet-drainer payload that silently rebound `window.ethereum` calls — an MCP-equivalent surface in the browser-extension/agent context. Trust Wallet Chrome extension Dec 2025 backdoor ($7M loss) used PostHog as the exfil channel.

**Detection signal.** Skill declares `mcpServers[]` without `pinnedHash` or `pinnedVersion` per server. No tool-schema diffing on session start vs. last-audited schema. Detector verifies that any tool prefixed `eth_*`, `wallet_*`, `chain_*` resolves to a server whose origin (URL or stdio command) is in a project-maintained MCP allowlist. Flag MCP servers whose `toolList()` response includes tools not declared in the skill manifest's `requires.tools[]`.

**Maps to AST10 parent.** **AST02 — Supply Chain Compromise** (with strong secondary AST07 Update Drift — this *is* update drift for chain tools).

---

## AST-W09 — Session-Key / Permission-Caveat Erosion

**What it is.** Skills using ERC-7715 / ERC-7710 (or vendor session-key systems like Privy, Biconomy, ZeroDev) request session permissions that are too broad, lack expiry, or are renewed automatically without user re-consent. Caveat enforcers (the on-chain validators) may be misconfigured (no value cap, no contract allowlist, no time bound). The agent loop happily exploits this whenever it interprets ambiguous user intent.

**Real example / pattern.** MetaMask Delegation Toolkit (ERC-7715) makes scoped session keys easy, but multiple vendor implementations have shipped with caveat-enforcer bugs that allow the session account to call outside the granted scope. The April 2026 CoinDesk piece ("AI agents are set to power crypto payments but a hidden flaw could expose wallets") flagged exactly this gap as the under-audited surface for agent-driven payments.

**Detection signal.** Skill declares `sessionKey` / `permissions` blocks without all of: `expiry` (absolute timestamp), `valueLimit` (wei cap), `targets[]` (contract allowlist), `selectors[]` (function allowlist), `chainIds[]`. Detector verifies caveat-enforcer addresses are from a known-good registry. Lint: any code path that calls `requestPermissions()` with `expiry: undefined` or `expiry > 7 days` without a maintainer override comment.

**Maps to AST10 parent.** **AST03 — Over-Privileged Skills** (canonical case; secondary AST09 No Governance because session-key revocation often lacks an operator runbook).

---

## AST-W10 — Slippage / Price-Oracle Manipulation by Agent Loop

**What it is.** The skill executes trades or liquidations using on-chain prices it queries itself (via `getReserves`, `slot0`, oracle reads) without TWAP or off-chain corroboration. An attacker can pre-position to manipulate the spot price between the agent's read and the agent's swap, with the agent's own retry/refresh loop making the manipulation cheaper. Distinct from generic oracle manipulation: the *agent's polling cadence* is exploitable side-channel.

**Real example / pattern.** "Lobstar Wilde" (Feb 2026) sent **$441,780 in tokens for a $310 request** because its price-conversion read was spot-priced and trivially gameable; the AIXBT dashboard breach (Feb 2026) used queued malicious replies that triggered ~55 ETH of bad trades from the connected wallet. Sandwich-by-design against agent traders is now a documented MEV strategy ($289.8M ETH-mainnet sandwich volume in 2025).

**Detection signal.** Skill calls `getAmountsOut` / `quoteExactInputSingle` and then `swapExactTokens...` without a `minAmountOut` derived from a TWAP or external oracle (Pyth, Chainlink, RedStone). Lint: `slippage` parameter is a string literal `"0.5"` or model-supplied without a hard ceiling. No `block.number` deadline or a deadline >5 minutes in the future. Manifest lacks `oracle.source` declaration when `actions[]` contains any swap/trade verb.

**Maps to AST10 parent.** **AST08 — Poor Scanning** (price-read sanity is something a scanner *can* verify; secondary AST06 Weak Isolation — the agent should not be quoting + executing in one trust domain).

---

## AST-W11 — Key Material in Agent Memory / Logs

**What it is.** Private keys, mnemonics, or session-key signers loaded into the agent process's address space, written to chain-of-thought traces, included in tool-call arguments that get logged to LLM-provider servers, or persisted in conversation history. Distinct from generic secret-leakage: agents *introspect their own state* and tooling commonly logs full prompts and tool I/O.

**Real example / pattern.** The 2025 **`react-native-scrollpageviewtest`** package exfiltrates mnemonics via Google Analytics. Sept 2025 npm packages **impersonating Flashbots** stole signing keys. Feb 2026 packages "**harvest crypto keys, CI secrets, and API tokens**" through AI-coding-assistant tooling. Apr 2026 npm worm targeted MetaMask, Exodus, Atomic via injected agent-tooling code. A skill that does `console.log({tx, signer})` for "debugging" is the same vulnerability class.

**Detection signal.** AST grep for any string matching `^(0x)?[a-fA-F0-9]{64}$` flowing into `console.*`, `logger.*`, or as plaintext into `tools[].arguments`. Mnemonic-pattern regex (`(\w+\s){11,23}\w+` checked against BIP-39 wordlist) anywhere in skill source or sample fixtures. Manifest declares `secrets[]` without each entry having `redactInTrace: true`. Detector flags `process.env.PRIVATE_KEY` / `MNEMONIC` reads in any code path also reachable from a tool that returns content to the LLM.

**Maps to AST10 parent.** **AST04 — Insecure Metadata** (keys are the most sensitive metadata; secondary AST06 Weak Isolation between agent runtime and key storage).

---

## AST-W12 — No On-Chain Action Audit / Kill-Switch

**What it is.** Skills lacking a tamper-evident on-chain or off-chain audit trail of actions taken (which key, which tx hash, which authorization, on which behalf, gated by which policy version), and lacking an out-of-band kill switch (a way to pause the agent's signing capability without coordinating with the agent itself, since the agent could be the compromised component). Without these, post-incident forensics is impossible and a compromised agent keeps operating.

**Real example / pattern.** The Feb 2026 **AIXBT dashboard breach** illustrates this: by the time operators detected the queued malicious replies, the trades had executed; no policy-versioned signing path existed. Several DaaS post-mortems (Inferno Drainer Reloaded, Vanilla Drainer) note that victim-side detection is invariably reactive because there's no signing-side log a third party can subscribe to.

**Detection signal.** Skill manifest lacks an `audit.sink` (e.g. signed log endpoint, on-chain event emitter, Merkle-anchored journal). No declared `killSwitch.contract` or equivalent (a Safe module, a GuardModule, a 7715 revoke endpoint) reachable without the agent being a signatory. Lint: signing functions don't emit a `domain-separated` audit record before broadcast. Manifest lacks an `incident.runbook` field linking to a revoke / pause procedure.

**Maps to AST10 parent.** **AST09 — No Governance** (canonical case; secondary AST07 Update Drift, since policy versioning belongs in the same audit substrate).

---

## Landscape notes

**Most-cited Web3 agent-relevant incidents, 2024–2026:**

- **Freysa** (Nov 2024) — first clean PoC of prompt-injection-vs-signing-agent, $47k loss.
- **Inferno Drainer Reloaded** (Sept 2024–Mar 2025) — DaaS resurgence, $9M+ across 30k wallets, single-use contract + on-chain encrypted config to evade scanners.
- **Sept 2025 npm `debug` / `chalk` "Shai-Hulud" worm** — Web3 drainer payload across hundreds of packages; a foundational supply-chain attack on the agent toolchain itself.
- **EIP-7702 phishing wave** (May 2025–) — $1.54M single-victim, 1,988 QNT pool drain, $12M aggregate; >90% of observed 7702 delegations malicious.
- **Trust Wallet Chrome extension backdoor** (Dec 2025) — $7M, exfil via PostHog.
- **AIXBT / Lobstar Wilde** (Feb 2026) — first widely-reported autonomous-agent wallet compromises.
- **LLM Router incident** (Apr 2026) — 26 routers injecting tool calls, ~$500k drained.
- **Address poisoning** — sustained 160k+ poisoned txs/day (Blockaid), Dec 2025 single-victim ~$50M USDT loss.
- **Malicious-MCP advisories** (Feb 2026) — first formal documentation of MCP servers smuggling chain capabilities and exfiltrating `~/.ssh` etc. against Claude Code, Cursor, Windsurf, VS Code.

**Frameworks to align with / namespace under:**

- **OWASP SCSVS** (Smart Contract Security Verification Standard) — particularly SCSVS-AUTH and SCSVS-ARCH map cleanly onto AST-W01 / W09.
- **OWASP Smart Contract Top 10 (2025/2026)** — cite for any AST-W rule that inherits a contract-side vulnerability rather than an agent-side one.
- **SWC Registry** — useful for citing CWE parents on the contract side; agentsec rule IDs can carry an `inheritsFrom: SWC-XXX` field.
- **ERC-7715 / ERC-7710** — the canonical session-key/delegation model; AST-W09 should reference these as the *good* pattern, not a risk.
- **EIP-7702** — annex must cite, but as a *capability* whose misuse is AST-W03.
- **Flashbots Protect / MEV Blocker / bloXroute** — reference RPC allowlist for AST-W05.

---

## Sources

Inferno Drainer Reloaded — Check Point · Decrypt · Three Sigma. EIP-7702 — Cryptopolitan, Crypto Times, Nethermind, arXiv:2512.12174. Permit2 — Gate Learn, Revoke.cash, ImmuneBytes. Freysa — Cointelegraph, Simon Willison. Anthropic Red on smart contracts. AIXBT / Lobstar — Crypto Times. CoinDesk on AI-agent crypto payments flaw. Sandwich attacks — CoinGecko, Binance Square. ERC-7715 / ERC-7710 / EIP-712 — MetaMask, eips.ethereum.org, Coinspect. Address poisoning — Blockaid, Yahoo Finance, arXiv:2501.16681. Trust Wallet — Hacker News, CoinDesk. npm worms — Wiz, Sygnia, Hacker News. OWASP SCSVS / SC Top 10 — scs.owasp.org. SWC Registry — swcregistry.io. Bridge exploits — Protos, Crypto Briefing. DaaS economy — ACM IMC 2025, BlockSec. AI Agents in Cryptoland — arXiv:2503.16248. OECD.AI incident database.

Full URLs in the parallel-research session output.
