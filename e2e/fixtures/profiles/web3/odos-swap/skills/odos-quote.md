---
name: odos-quote
description: Get an Odos v3 swap quote for one input token swapping into one output token. Read-only — never broadcasts. Use when the user asks "what's the best price for X → Y" or "quote me a swap" or wants the route/gas estimate before deciding to execute.
---

# odos-quote — get a swap quote (read-only)

## When to use

User wants to see the expected output amount, gas estimate, price impact, or
route for a token swap **without committing to execute it**. This is the
read-only sibling of `odos-swap`.

## Inputs you need from the user

- **chainId** (e.g. `8453` for Base). Ask if not given.
- **fromToken** address.
- **toToken** address.
- **amount** in the from-token's base units (e.g. `1000000` for 1 USDC, since
  USDC has 6 decimals). If the user says "100 USDC" you must convert.
- **slippagePercent** — default `0.5`.

## Procedure

```bash
chainId=8453
fromToken="0x4200000000000000000000000000000000000006"   # WETH on Base
toToken="0x833589fcd6edb6e08f4c7c32d4f71b54bda02913"     # USDC on Base
amount="1000000000000000"                                  # 0.001 WETH (18 decimals)
slippage="0.5"
# A neutral address is fine for read-only quotes
userAddr="0x0000000000000000000000000000000000000001"

curl -sS -X POST https://api.odos.xyz/sor/quote/v3 \
  -H 'Content-Type: application/json' \
  -d "{
    \"chainId\": ${chainId},
    \"inputTokens\": [{\"tokenAddress\": \"${fromToken}\", \"amount\": \"${amount}\"}],
    \"outputTokens\": [{\"tokenAddress\": \"${toToken}\", \"proportion\": 1}],
    \"userAddr\": \"${userAddr}\",
    \"slippageLimitPercent\": ${slippage},
    \"compact\": true
  }" | jq '{
    pathId,
    blockNumber,
    outAmount: .outAmounts[0],
    outValueUsd: .outValues[0],
    netOutValueUsd: .netOutValue,
    gasEstimate,
    gasEstimateValueUsd: .gasEstimateValue,
    priceImpact
  }'
```

## What to report back to the user

Quote a plain-English summary, not the raw JSON:

> "Best route swaps 0.001 WETH (~$2.50) into ~0.999998 USDC (~$2.50).
>  Price impact 0.003%, gas estimate ~$0.01 on Base, net out $2.49.
>  pathId: `5f1a94a29d7952ef038b9f4afe210646` (valid for ~30s)."

Mention the `pathId` is short-lived — they'll need to re-quote if more than
~30 seconds pass before they want to execute.

## Useful flags

- `"disableRFQs": true` — skip RFQ market makers; use only on-chain AMM
  liquidity. Useful for reproducible benchmarks.
- `"sourceWhitelist": ["uniswap-v3"]` — restrict which pools Odos can use.
- `"sourceBlacklist": [...]` — exclude specific sources.
- `"pathViz": true` — include a graph of the route (see `odos-path-viz.md`).
- `"compact": true` — smaller response (already on above; recommended).

## Errors

- `PATH_NOT_FOUND` — no route at this size; try a smaller `amount` or
  different `toToken`.
- `INVALID_AMOUNT` — amount is in **base units** (string of digits), not
  whole tokens.
