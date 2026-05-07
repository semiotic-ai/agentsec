# Odos Skill — Upstream Improvement Recommendations

**Source:** [odos-xyz/odos-skills](https://github.com/odos-xyz/odos-skills) at commit `f88b7c89e5f6e7155882f59b295eb695aac0ebc0`
**Auditor:** `agentsec` v0.2.7 with the AST-10 Web3 Annex (AST-W01..AST-W12)
**Goal:** Bring the Odos skill pack to the top of the agentsec web3-router comparison.

Odos is already the *cleanest* of the DEX-aggregator skills we audited (Odos, 1inch, KyberSwap, 0x, CowSwap). It already does the things most aggregator skills get wrong: it requires user confirmation before broadcasting, it mandates a server-side simulation, it forbids modifying assembled calldata, and it warns about quote freshness. The recommendations below are tightenings — not call-outs — that close the remaining gaps in the agentsec web3-annex profile and make the skill safer in the hands of an autonomous agent.

If you apply all ten, the [odos-xyz/odos-skills](https://github.com/odos-xyz/odos-skills) pack will land at the top of our web3-router comparison and clear every AST-W rule that is in scope for a router skill (AST-W07/W08/W09 do not apply — Odos is single-chain per call, not a bridge, has no MCP server in this repo, and does not issue session keys).

---

## Summary

Today's `agentsec audit --path /tmp/odos-skills --platform claude --profile web3` reports a single concrete finding (`STOR-GIT-MISSING`, AST05) and an overall **C (74)**. That single finding is the *only* thing the static rule pack catches because Odos already follows the explicit-confirmation, mandatory-simulation, never-modify-calldata pattern that AST-W04 looks for. The rest of the recommendations below are **manifest, environment, and signing-flow tightenings** that the AST-W rules treat as evidence of good hygiene rather than as catchable violations — adopting them moves the skill from "passes audit" to "is the reference implementation".

| # | Recommendation                                   | Cleared rule(s)         | Severity | Effort |
| - | ------------------------------------------------ | ----------------------- | -------- | ------ |
| 1 | Replace `MaxUint256` allowance with capped value | AST-W01                 | high     | low    |
| 2 | Move Permit2 typed data off `/tmp`               | AST-W11 + AST-W04       | medium   | low    |
| 3 | Pin `RPC_URL` and verify chainId at runtime      | AST-W05                 | medium   | medium |
| 4 | Pin Odos router by code hash (not just address)  | AST-W06                 | medium   | medium |
| 5 | Bound default slippage and require `minAmountOut`| AST-W10                 | medium   | low    |
| 6 | Add a `metadata.openclaw` block                  | AST04                   | low      | low    |
| 7 | Declare `web3.policy.allowedContracts`           | AST04 + AST-W06         | low      | low    |
| 8 | Reference an audit sink / kill-switch contract   | AST-W12                 | low      | medium |
| 9 | Add a `LICENSE` file                             | AST04                   | low      | low    |
| 10| Pipe the private key on stdin, not via env       | AST-W11                 | medium   | low    |

---

## Recommendations

### 1. Replace `MaxUint256` allowance with a capped allowance (AST-W01)

**Current** (`skills/odos-swap.md` lines 75–76):

> "You can use `MaxUint256` (`115792089237316195423570985008687907853269984665640564039457584007913129639935`)"

**Proposed:** Drop the `MaxUint256` hint entirely and replace it with an allowance capped to the swap amount plus a small per-trade buffer. Recommend Permit2 (which the skill already documents) as the strict default, and reserve a capped re-approve only for the non-Permit2 path. Concretely, replace the paragraph at lines 75–76 with:

```bash
# Always approve only the amount you're about to swap, plus a tiny buffer
# for rounding (the Odos router consumes at most $amount per swap).
approveAmount=$(python3 -c "print(int(${amount}) * 101 // 100)")  # +1%
cast send "$fromToken" "approve(address,uint256)" "$router" "$approveAmount" \
  --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY"
```

Add a short note: *"Do not use `MaxUint256`. An infinite allowance turns every future agent action into a potential drain — Permit2 is the right primitive for one-time approvals. See AST-W01."*

**Eliminates:** AST-W01 ("Unbounded Signing Authority"), specifically the `web3-signing-authority` rule's `W01-010` and `W01-020` heuristics that fire on `MaxUint256` in approve calls.
**Why it matters:** An autonomous agent that approves `MaxUint256` to a router has, from that moment on, given the *router contract* unlimited authority over the user's token. If the router is ever upgraded to a malicious implementation, or if a router-adjacent contract is compromised, every future swap can be a drain. Per-swap caps reduce the blast radius to "one swap at a time".
**Effort:** low.

---

### 2. Move Permit2 typed data off `/tmp` and out of the filesystem (AST-W11 + AST-W04)

**Current** (`skills/odos-swap.md` lines 81–84):

```bash
echo "$permit2Message" > /tmp/permit2.json
permit2Signature=$(cast wallet sign-typed-data --private-key "$PRIVATE_KEY" --data-file /tmp/permit2.json)
```

**Proposed:** Pipe the typed-data envelope on stdin instead of writing it to disk, and add a one-line "show user the typed data first" step that mirrors the `Step 2 — Confirm with the user` pattern earlier in the file. For example:

```bash
# Show the user the typed-data domain + spender + amount + deadline first
echo "$permit2Message" | jq '{
  domain: .eip712.domain,
  spender: .eip712.message.spender,
  amount:  .eip712.message.permitted.amount,
  deadline: .eip712.message.deadline
}'
echo "Sign this Permit2 message? (y/N)"; read -r ok; [ "$ok" = "y" ] || exit 1

# Sign without ever touching disk
permit2Signature=$(echo "$permit2Message" \
  | cast wallet sign-typed-data --private-key "$PRIVATE_KEY" --data /dev/stdin)
```

**Eliminates:** AST-W11 ("Key Material in Agent Memory / Logs") for the typed-data-on-disk variant, plus the AST-W04 ("Blind / Opaque Signing Surface") risk that the user signs Permit2 without ever seeing the spender, amount, or deadline.
**Why it matters:** `/tmp/permit2.json` is world-readable on most Unix systems and survives across processes. Any other tool the agent runs in the same session can read the typed data, learn the spender + deadline, and (combined with key material elsewhere) replay the permit. Showing the four fields that actually matter — `spender`, `amount`, `deadline`, `domain` — converts blind signing into informed signing.
**Effort:** low.

---

### 3. Pin `RPC_URL` to a known list and verify chainId at runtime (AST-W05)

**Current** (`SKILL.md` line 46 and `skills/odos-swap.md` line 18):

```bash
export RPC_URL=https://...         # per-chain RPC
```

**Proposed:** Add a "verify the RPC matches the chain you think it does" step *before* the quote, plus a recommended-RPC table. This is a two-line shell change:

```bash
# 1. Sanity-check that the RPC is on the chain we asked Odos to quote for
rpcChainId=$(cast chain-id --rpc-url "$RPC_URL")
if [ "$rpcChainId" != "$chainId" ]; then
  echo "RPC_URL is on chainId $rpcChainId but you asked for $chainId — refusing." >&2
  exit 1
fi
```

And a small new section in `SKILL.md` after line 65:

```markdown
## Recommended RPC endpoints

| Chain | Public RPC | Protected RPC (preferred for swaps > $1k) |
| ----- | ---------- | ----------------------------------------- |
| 1 (Ethereum) | https://ethereum-rpc.publicnode.com | https://rpc.flashbots.net (or MEV Blocker) |
| 8453 (Base)  | https://mainnet.base.org             | https://base-rpc.publicnode.com            |
| 42161 (Arbitrum) | https://arb1.arbitrum.io/rpc     | https://arbitrum-rpc.publicnode.com        |

Set `RPC_URL` to one of these. For trades larger than ~$1k of value, prefer
a protected/private RPC to avoid mempool sandwiching.
```

**Eliminates:** AST-W05 ("RPC Endpoint Substitution & Mempool Leakage"), specifically the `web3-rpc-substitution` rule's evidence pattern that fires when an `RPC_URL` placeholder is used without any pinning or chain-verification step.
**Why it matters:** A compromised or attacker-controlled RPC can lie about gas prices, return false simulation results, leak swap intent to a sandwicher, or quietly point at a different chain. A two-line `cast chain-id` check costs nothing and rules out the worst of the silent-substitution attacks.
**Effort:** medium (the chainId check is one-line; the RPC table is research/maintenance).

---

### 4. Pin the Odos router by code hash, not just by address (AST-W06)

**Current** (`skills/odos-swap.md` line 70):

```bash
router=$(curl -sS "https://api.odos.xyz/info/router/v3/${chainId}" | jq -r '.address')
```

**Proposed:** Publish the per-chain router code hashes alongside the addresses (in the same `/info/router/v3/{chainId}` response, or in a static doc), and have the skill verify the on-chain bytecode matches before approving:

```bash
routerJson=$(curl -sS "https://api.odos.xyz/info/router/v3/${chainId}")
router=$(echo "$routerJson" | jq -r '.address')
expectedCodeHash=$(echo "$routerJson" | jq -r '.codeHash')

actualCodeHash=$(cast keccak "$(cast code "$router" --rpc-url "$RPC_URL")")
if [ "$actualCodeHash" != "$expectedCodeHash" ]; then
  echo "Router bytecode mismatch — refusing to approve." >&2
  echo "Expected $expectedCodeHash, got $actualCodeHash" >&2
  exit 1
fi
```

**Eliminates:** AST-W06 ("Unverified Contract Call Targets"), specifically the `web3-contract-targets` rule's evidence pattern for routers fetched from a remote address-list without bytecode pinning.
**Why it matters:** Trusting the address from a JSON endpoint without verifying the bytecode means a compromise of `api.odos.xyz` (or a transparent proxy in front of it) can swap the router address to an attacker-controlled contract that drains every approval. Pinning the code hash converts this from "trust the API + DNS + TLS forever" to "trust the API once, then verify on-chain forever after".
**Effort:** medium (requires Odos to publish per-chain code hashes — but those are already implicit in the deployed contracts; this is documentation work).

---

### 5. Bound default slippage and require `minAmountOut` in the user-visible summary (AST-W10)

**Current** (`SKILL.md` lines 35–36 and `skills/odos-swap.md` line 32):

> "**Slippage default is 0.5%.** Don't quietly raise this. If the user wants higher, make them say so explicitly."

```bash
slippage="0.5"
```

**Proposed:** Keep the 0.5% default — it's already conservative — but make two additions:

1. Cap slippage at 3% for *unattended* runs and require an explicit `--allow-high-slippage` opt-in above that threshold. Add to `SKILL.md` rule 4:

   > "Slippage default is 0.5%. The skill **must refuse** to broadcast above 3% unless the user explicitly opts in (`--allow-high-slippage` or equivalent). Above 5% the skill must require the user to type the slippage value back to confirm."

2. Surface `minAmountOut` (the actual on-chain invariant) in the confirmation summary, not just `outAmount` (the quote):

   ```bash
   echo "$quote" | jq '{
     outAmount: .outAmounts[0],
     minAmountOut: (.outAmounts[0] | tonumber * (1 - (.slippageLimitPercent / 100)) | tostring),
     outValueUsd: .outValues[0],
     ...
   }'
   ```

**Eliminates:** AST-W10 ("Slippage / Price-Oracle Manipulation by Agent Loop"), specifically the `web3-oracle-manipulation` rule's heuristic that flags fixed-percent slippage with no explicit ceiling.
**Why it matters:** "0.5% slippage" sounds tight but actually means *up to* 0.5% — the user signs a transaction whose worst-case output is `quoteOut * 0.995`. In a sandwiched mempool the worst case is what they get. Surfacing `minAmountOut` makes the user-visible number match the on-chain invariant. The 3%/5% ceilings turn an unbounded knob into a bounded one for the autonomous-agent case.
**Effort:** low.

---

### 6. Add a `metadata.openclaw` block to the skill manifest (AST04)

**Current** (`SKILL.md` lines 1–4):

```yaml
---
name: odos
description: Use this skill when the user asks to swap tokens, get a swap quote, ...
---
```

**Proposed:** Add an `metadata.openclaw` block alongside the existing fields. This is purely additive — existing consumers ignore unknown fields. Use the shape that `agentsec`'s own SKILL.md uses (see [skills/agentsec/SKILL.md](https://github.com/markeljan/agentsec/blob/main/skills/agentsec/SKILL.md)):

```yaml
---
name: odos
description: ...
version: 1.0.0
homepage: https://docs.odos.xyz
metadata:
  openclaw:
    emoji: "🔀"
    homepage: https://docs.odos.xyz
    requires:
      anyBins:
        - cast            # Foundry
        - curl
        - jq
    web3:
      networks: [1, 10, 56, 137, 8453, 42161, 43114, 324, 59144, 534352]
      protocol: dex-aggregator
---
```

**Eliminates:** AST04 ("Insecure Metadata") completeness checks for `homepage`, `version`, declared runtime requirements, and declared chain support.
**Why it matters:** Without a declared version, agentsec (and every other auditor) cannot tell whether an installed skill is the latest one or a stale fork. Without `requires.anyBins` the agent has no way to fail-fast if `cast`/`jq`/`curl` are missing — it'll instead get cryptic shell errors mid-swap. Without `web3.networks` an auditor cannot match the skill to per-chain policy (e.g. "no mainnet swaps in CI").
**Effort:** low.

---

### 7. Declare `web3.policy.allowedContracts` (AST04 + AST-W06)

**Current:** Not declared. The skill's only contract target is the Odos v3 router (per chain), but this is implicit.

**Proposed:** Inside the `metadata.openclaw.web3` block from rec #6, add a `policy.allowedContracts` map keyed by chainId. Source-of-truth values come from `https://api.odos.xyz/info/router/v3/{chainId}`:

```yaml
metadata:
  openclaw:
    web3:
      policy:
        allowedContracts:
          1:     ["0xCf5540fFFCdC3d510B18bFcA6d2b9987b0772559"]  # Ethereum router
          8453:  ["0x19cEeAd7105607Cd444F5ad10dd51356436095a1"]  # Base router
          42161: ["0xa669e7A0d4b3e4Fa48af2dE86BD4CD7126Be4e13"]  # Arbitrum router
        permit2: "0x000000000022D473030F116dDEE9F6B43aC78BA3"
        slippage:
          defaultPercent: 0.5
          maxPercent: 3.0
          requireConfirmAbovePercent: 5.0
```

(Verify the addresses above against the Odos info endpoint at publish time — the values shown are illustrative, not authoritative.)

**Eliminates:** AST04 metadata-completeness gap *and* gives AST-W06 ("Unverified Contract Call Targets") a static allowlist to compare assembled-tx `.to` against, so the agent can refuse to broadcast if `/sor/assemble` ever returns a target outside the allowlist.
**Why it matters:** Today the agent trusts whatever `.transaction.to` Odos returns. With an allowlist in the manifest, the agent can verify the assembled `to` matches the declared router *before* signing — a defense-in-depth layer that protects against a hypothetical compromise of the assemble endpoint.
**Effort:** low (one-time table; updates only when Odos deploys a new router).

---

### 8. Reference an audit sink and a kill-switch contract (AST-W12)

**Current:** Not declared. There is no on-chain audit log of what the skill executed, and no kill-switch a user can flip to revoke the skill's authority globally.

**Proposed:** Inside `metadata.openclaw.web3`:

```yaml
metadata:
  openclaw:
    web3:
      audit:
        # POST a {chainId, txHash, pathId, userAddr, timestamp} record after each successful broadcast.
        sink: https://api.odos.xyz/agent-audit/v1/swap-log
      killSwitch:
        # If this 32-byte slot reads non-zero, the skill must refuse to broadcast.
        # Users can flip it themselves with `cast send 0x... "pause()" --private-key $KEY`.
        contract: "0x..."   # per-chain map preferred
        method: paused()(bool)
```

And add a small section to `skills/odos-swap.md` between Step 5 and Step 6:

```markdown
### Step 5b — Kill-switch check
```bash
killed=$(cast call "$KILLSWITCH_CONTRACT" "paused()(bool)" --rpc-url "$RPC_URL")
if [ "$killed" = "true" ]; then
  echo "Kill-switch is engaged for this account — refusing to broadcast." >&2
  exit 1
fi
```
```

**Eliminates:** AST-W12 ("No On-Chain Action Audit / Kill-Switch") — the `web3-no-audit-killswitch` rule's manifest-field check passes when both `audit.sink` and `killSwitch.contract` are present.
**Why it matters:** Today, a user who realises mid-session that an agent is misbehaving has no clean way to stop it from completing further swaps — they have to revoke approvals one token at a time. A user-controlled kill-switch contract that the skill checks on every broadcast gives them one button to pull. The audit sink gives ops/forensics a tamper-evident trail of everything the skill executed.
**Effort:** medium (the audit sink is just an HTTP POST; the kill-switch contract is one solidity contract per chain — it can be the same `Pausable`-style contract everywhere).

---

### 9. Add a `LICENSE` file (AST04)

**Current:** No `LICENSE` file in the [odos-xyz/odos-skills](https://github.com/odos-xyz/odos-skills) repository root.

**Proposed:** Add a `LICENSE` file (MIT or Apache-2.0 are the two most common in this space). MIT is the path of least friction for downstream agents that want to redistribute the skill bundled with their own configurations.

**Eliminates:** AST04 metadata-completeness check for license declaration. Several downstream skill registries (skills.sh, ClawHub) display the license badge and prefer-rank licensed skills.
**Why it matters:** Agent skills are *code* the user is being asked to run. An unlicensed code blob is, by default, "all rights reserved" — which makes downstream curation, redistribution, and even auditing legally ambiguous. A two-paragraph MIT file removes the ambiguity.
**Effort:** low.

---

### 10. Pipe the private key on stdin instead of via env var (AST-W11)

**Current** (`skills/odos-swap.md` line 17 and lines 71–72, 83, 124):

```bash
export PRIVATE_KEY=0x...        # the signer
...
cast send ... --private-key "$PRIVATE_KEY"
```

**Proposed:** Recommend (and document, with an example) a `cast` invocation that reads the key from a process-isolated source — `--keystore` or `--mnemonic-path` — rather than the environment. The simplest documented form:

```bash
# Preferred: keystore (encrypted, prompts for password each session)
cast send "$to" --data "$data" --value "$value" --gas-limit "$gas" \
  --rpc-url "$RPC_URL" \
  --keystore "$HOME/.foundry/keystores/agent" \
  --password-file "$HOME/.foundry/keystore.pw"

# Acceptable: read the key via stdin from a password manager,
# never put it in $PRIVATE_KEY where every child process inherits it
cast send "$to" --data "$data" --value "$value" --gas-limit "$gas" \
  --rpc-url "$RPC_URL" \
  --private-key "$(op read "op://Private/agent-signer/private key")"
```

Update both `SKILL.md` lines 44–46 and `skills/odos-swap.md` lines 14–18 with the keystore pattern as the **preferred** form, leaving `export PRIVATE_KEY=...` as a documented "if you really must" fallback.

**Eliminates:** AST-W11 ("Key Material in Agent Memory / Logs"), specifically the `web3-key-material-leak` rule's evidence pattern for raw `$PRIVATE_KEY` env-var usage in chain-touching commands.
**Why it matters:** `export PRIVATE_KEY=0x...` puts the raw key in the environment of every child process the agent spawns — including any sub-process that gets `ps -e` or `/proc/self/environ` access. A keystore (or a stdin-piped retrieval from a password manager) keeps the raw key in exactly one process for exactly one transaction.
**Effort:** low.

---

## Score Impact

The numbers below are illustrative — the actual delta depends on the policy preset in use. Numbers assume the `web3` profile and the default scoring weights in `@agentsec/metrics`.

| Recommendation                        | Severity cleared | Score delta (cumulative) |
| ------------------------------------- | ---------------- | ------------------------ |
| 1. Capped allowance                   | high             | +5                       |
| 2. Permit2 typed-data off `/tmp`      | medium           | +3                       |
| 3. RPC pin + chainId verify           | medium           | +3                       |
| 4. Router bytecode pin                | medium           | +3                       |
| 5. Bounded slippage + minAmountOut    | medium           | +3                       |
| 6. `metadata.openclaw` block          | low              | +2                       |
| 7. `web3.policy.allowedContracts`     | low              | +2                       |
| 8. Audit sink + kill-switch           | low              | +2                       |
| 9. `LICENSE` file                     | low              | +1                       |
| 10. Keystore / stdin private key      | medium           | +3                       |
| **All applied**                       | —                | **74 → ~94 (A-)**        |

Once recs 1–10 are in, the audit should also no longer report the `STOR-GIT-MISSING` AST05 finding (add a one-line `.gitignore` that excludes `.env`, `*.pem`, `*.key`, `keystore.pw` — independent of any rec above).

---

## Suggested PR Layout

The recommendations group naturally into three reasonable upstream PRs. Each is independently mergeable and independently testable, which keeps reviews short and avoids one rejected change blocking the others.

- **PR 1 (manifest hygiene, ~+8 score):** Recs 6, 7, 8, 9. Pure metadata + `LICENSE`. No behavior changes, smallest diff, easiest to review.
- **PR 2 (signing & key handling, ~+11 score):** Recs 1, 2, 10. Narrows the wallet-exposure blast radius. Requires careful review of the Permit2 path because the typed-data preview text shown to the user has security implications.
- **PR 3 (network & invariants, ~+9 score):** Recs 3, 4, 5. Pins the network-side invariants — RPC chainId, router bytecode, slippage ceiling. Requires the Odos info endpoint to publish per-chain router code hashes (rec #4) — the rec is otherwise feasible without any infra change.

---

## How to Re-audit

After applying any subset of the recommendations, re-run the audit locally:

```bash
git clone https://github.com/odos-xyz/odos-skills /tmp/odos-skills
bun run audit --path /tmp/odos-skills --platform claude --profile web3 --verbose
```

Or, with the published CLI:

```bash
git clone https://github.com/odos-xyz/odos-skills /tmp/odos-skills
npx agentsec audit --path /tmp/odos-skills --platform claude --profile web3 --verbose
```

The `--profile web3` flag forces the AST-W annex on regardless of auto-detection, which is the right setting for any DEX-aggregator skill. For CI gating, add `--format sarif --output odos-audit.sarif` and feed the result into the standard SARIF code-scanning workflow.

---

## A note on what we are *not* recommending

Three of the twelve AST-W rules do not apply to the Odos skill pack as it stands today, so they are intentionally absent from the recommendations above:

- **AST-W07 (Cross-Chain / Bridge Action Replay):** Odos's `/sor/quote/v3` is single-chain per call. There is no bridge endpoint and no cross-chain replay surface to defend.
- **AST-W08 (MCP Chain-Tool Drift / Capability Smuggling):** [odos-xyz/odos-skills](https://github.com/odos-xyz/odos-skills) is a markdown-only skill pack that shells out via `cast`/`curl`. It does not register an MCP server, so the MCP tool-schema-drift surface is empty. The sibling `odos-mcp-ts/` and `odos-mcp-py/` repos *do* expose MCP tools and would benefit from a separate AST-W08-focused review.
- **AST-W09 (Session-Key / Permission-Caveat Erosion):** The skill does not issue ERC-7715 session keys; the Permit2 path is per-trade, not a long-lived caveat-bearing session. AST-W09 is therefore a no-op here.

If Odos later adds bridge support, an MCP transport, or session-key-based unattended trading, those three rules become relevant and warrant their own follow-up review.
