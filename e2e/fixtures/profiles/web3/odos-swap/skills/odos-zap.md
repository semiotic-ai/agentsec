---
name: odos-zap
description: Provide or withdraw liquidity to/from a DeFi pool in a single atomic transaction (a "zap"). Odos converts the user's input tokens through optimal swap paths into the exact ratio the pool needs, then deposits — all in one tx. Use when the user asks to "add liquidity", "zap into pool", "LP into [protocol]", or to withdraw and consolidate LP positions.
---

# odos-zap — single-tx liquidity provisioning

## When to use

User wants to add liquidity to a pool (or withdraw and consolidate it),
without juggling separate "swap to right ratio → approve → mint LP" steps.

## How a zap works

Adding liquidity to a typical AMM pool requires the deposit assets to be in
the pool's exact ratio (e.g. 50/50 USDC/WETH by value). A zap takes whatever
inputs the user has, routes them through Odos's SOR to produce the right
ratio, and deposits — all atomically. Saves the user from doing the math
and paying multiple gas fees.

## Procedure (deposit)

### Step 1 — Quote the zap

```bash
chainId=8453
poolAddress="0x..."   # the LP pool the user wants to enter
userAddr=$(cast wallet address "${SIGNER_ARGS[@]}")

quote=$(curl -sS -X POST https://api.odos.xyz/zaps/quote \
  -H 'Content-Type: application/json' \
  -d "{
    \"chainId\": ${chainId},
    \"poolAddress\": \"${poolAddress}\",
    \"inputTokens\": [
      {\"tokenAddress\": \"0x833589fcd6edb6e08f4c7c32d4f71b54bda02913\", \"amount\": \"100000000\"}
    ],
    \"userAddr\": \"${userAddr}\",
    \"slippageLimitPercent\": 0.5,
    \"zapType\": \"deposit\"
  }")

echo "$quote" | jq '{
  pathId,
  expectedLpAmount: .outAmounts[0],
  inValueUsd: .inValues[0],
  netOutValueUsd: .netOutValue,
  gasEstimateUsd: .gasEstimateValue
}'
```

### Step 2 — Confirm with the user

Show the expected LP token amount and the gas cost. Wait for explicit
approval before continuing.

### Step 3 — Approve input tokens to the Odos zap router

```bash
# The zap router address may differ from the swap router; assemble returns
# the right `to` address. Approve each non-native input token for at least
# the amount being zapped.
cast send "$inputToken" "approve(address,uint256)" "$zapRouter" "$amount" \
  --rpc-url "$RPC_URL" "${SIGNER_ARGS[@]}"
```

### Step 4 — Assemble + broadcast

```bash
pathId=$(echo "$quote" | jq -r '.pathId')

assembled=$(curl -sS -X POST https://api.odos.xyz/zaps/assemble \
  -H 'Content-Type: application/json' \
  -d "{\"userAddr\": \"${userAddr}\", \"pathId\": \"${pathId}\"}")

to=$(echo "$assembled" | jq -r '.transaction.to')
data=$(echo "$assembled" | jq -r '.transaction.data')
value=$(echo "$assembled" | jq -r '.transaction.value')
gas=$(echo "$assembled" | jq -r '.transaction.gas')

cast send "$to" --data "$data" --value "$value" --gas-limit "$gas" \
  --rpc-url "$RPC_URL" "${SIGNER_ARGS[@]}"
```

## Withdraw flow

Same shape, but with `"zapType": "withdraw"` and the input token being the
LP token. The output is the user's choice of asset(s) — Odos routes the
withdrawn pool assets through swaps to give back the requested asset(s) in
one tx.

```bash
curl -sS -X POST https://api.odos.xyz/zaps/quote \
  -H 'Content-Type: application/json' \
  -d "{
    \"chainId\": ${chainId},
    \"poolAddress\": \"${poolAddress}\",
    \"inputTokens\": [
      {\"tokenAddress\": \"${lpTokenAddress}\", \"amount\": \"${lpAmount}\"}
    ],
    \"outputTokens\": [
      {\"tokenAddress\": \"0x833589fcd6edb6e08f4c7c32d4f71b54bda02913\", \"proportion\": 1}
    ],
    \"userAddr\": \"${userAddr}\",
    \"slippageLimitPercent\": 0.5,
    \"zapType\": \"withdraw\"
  }"
```

## Gotchas

- **Pool support is curated.** Not every pool address is zappable; Odos
  supports a set of integrated protocols (Uniswap v3, Aerodrome, etc.).
  A pool that isn't supported returns `POOL_NOT_SUPPORTED`.
- **Slippage is shared** across the swap leg and the deposit leg.
- **LP token decimals vary.** Read decimals from the pool contract (or the
  Odos token info endpoint) before formatting amounts for the user.
