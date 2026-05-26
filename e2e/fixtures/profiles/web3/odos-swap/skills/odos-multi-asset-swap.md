---
name: odos-multi-asset-swap
description: Swap N input tokens into 1 (or more) output tokens in a single atomic transaction. This is Odos's signature feature — no other DEX aggregator can do this. Use when the user wants to consolidate dust, sell several tokens at once into a single asset (e.g. "sell all my altcoins into USDC"), or swap a basket of inputs into a single output without N separate transactions.
---

# odos-multi-asset-swap — N tokens → M tokens, one tx

## When to use

The user wants to swap **multiple input tokens** in a single atomic
transaction. Common phrasings:

- "Sell all my ETH and WBTC into USDC."
- "Consolidate my dust into one token."
- "Swap 500 USDC + 0.1 WETH + 200 LINK into DAI in one shot."

If the user only has one input token, use `odos-swap.md` instead.

## Why this is unique to Odos

1inch, 0x, and KyberSwap can only do 1-input swaps per transaction. To swap
N tokens into 1, those aggregators need N separate quote-assemble-broadcast
cycles, with N×gas cost and N×exposure to price drift between txs. Odos's
SOR can route all N inputs through a unified path in one tx.

## Procedure

### Step 1 — Quote

`inputTokens` is now a list of N entries. `outputTokens` can also be a list
with `proportion` values that sum to 1.

```bash
chainId=8453
userAddr=$(cast wallet address "${SIGNER_ARGS[@]}")

# Three inputs, one output (USDC on Base)
quote=$(curl -sS -X POST https://api.odos.xyz/sor/quote/v3 \
  -H 'Content-Type: application/json' \
  -d "{
    \"chainId\": ${chainId},
    \"inputTokens\": [
      {\"tokenAddress\": \"0x4200000000000000000000000000000000000006\", \"amount\": \"1000000000000000\"},
      {\"tokenAddress\": \"0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf\", \"amount\": \"1000000\"},
      {\"tokenAddress\": \"0xc1CBa3fCea344f92D9239c08C0568f6F2F0ee452\", \"amount\": \"500000000000000000\"}
    ],
    \"outputTokens\": [
      {\"tokenAddress\": \"0x833589fcd6edb6e08f4c7c32d4f71b54bda02913\", \"proportion\": 1}
    ],
    \"userAddr\": \"${userAddr}\",
    \"slippageLimitPercent\": 0.5,
    \"compact\": true
  }")

echo "$quote" | jq '{
  pathId,
  outAmount: .outAmounts[0],
  inValuesUsd: .inValues,
  outValueUsd: .outValues[0],
  netOutValueUsd: .netOutValue,
  gasEstimateUsd: .gasEstimateValue,
  priceImpact
}'
```

For multi-output (e.g. "swap WETH into 80% USDC + 20% DAI"), set proportions
that sum to exactly 1.0:

```json
"outputTokens": [
  {"tokenAddress": "0x...usdc", "proportion": 0.8},
  {"tokenAddress": "0x...dai",  "proportion": 0.2}
]
```

### Step 2 — Approve all inputs

Each non-native input token needs an approval to the Odos v3 router. Loop:

```bash
router=$(curl -sS "https://api.odos.xyz/info/router/v3/${chainId}" | jq -r '.address')
inputs=$(echo "$quote" | jq -r '.inTokens[]')
amounts=$(echo "$quote" | jq -r '.inAmounts[]')

paste <(echo "$inputs") <(echo "$amounts") | while IFS=$'\t' read -r tok amt; do
  cast send "$tok" "approve(address,uint256)" "$router" "$amt" \
    --rpc-url "$RPC_URL" "${SIGNER_ARGS[@]}"
done
```

If the user prefers, use Permit2 to batch all approvals into the swap tx —
follow the Permit2 section in `odos-swap.md` (works for multi-asset too;
`permit2Message` will cover all inputs).

### Step 3 — Confirm, assemble, simulate, broadcast

Same flow as `odos-swap.md` from Step 5 onward. The `pathId` works
identically; assemble returns a single transaction that handles all N inputs.

### Step 4 — Report

> "Multi-asset swap submitted. Three inputs valued at ~$X, single output
>  ~Y USDC, all in one tx (saved ~$Z in gas vs three separate swaps).
>  Tx: `0x...`."

## Gotchas

- **Approvals are still per-token** unless using Permit2. Permit2 lets you
  cover all inputs with one signed message.
- **Slippage is shared** — `slippageLimitPercent` applies to the aggregate
  output, not per-input. Set tighter than for single-asset swaps if outputs
  are stable.
- **Output proportions must sum to exactly 1.0** (within float epsilon).
  Odos rejects requests where they don't.
- **Minimum input value.** Very small dust positions can fail with
  `PATH_NOT_FOUND` if there's no liquidity for them at all.
