---
name: odos-swap
description: Execute a token swap on Odos end-to-end (quote → assemble → simulate → confirm with user → broadcast). State-changing — costs gas. Use when the user explicitly asks to swap, sell, buy, or trade tokens. ALWAYS confirm with the user before broadcasting. Supports the Permit2 path to skip the separate approve() transaction.
---

# odos-swap — execute a swap (state-changing)

## When to use

User has explicitly asked to perform a swap and you've confirmed the inputs
(chain, from-token, to-token, amount). If they only asked for a quote, use
`odos-quote.md` instead.

## Required environment

```bash
export PRIVATE_KEY=0x...        # the signer
export RPC_URL=https://...      # chain RPC
```

The signer's address is what receives the output unless `receiver` is set.

## Procedure

### Step 1 — Quote

```bash
chainId=8453
fromToken="0x4200000000000000000000000000000000000006"   # WETH on Base
toToken="0x833589fcd6edb6e08f4c7c32d4f71b54bda02913"     # USDC on Base
amount="1000000000000000"                                  # 0.001 WETH
slippage="0.5"
userAddr=$(cast wallet address --private-key "$PRIVATE_KEY")

quote=$(curl -sS -X POST https://api.odos.xyz/sor/quote/v3 \
  -H 'Content-Type: application/json' \
  -d "{
    \"chainId\": ${chainId},
    \"inputTokens\": [{\"tokenAddress\": \"${fromToken}\", \"amount\": \"${amount}\"}],
    \"outputTokens\": [{\"tokenAddress\": \"${toToken}\", \"proportion\": 1}],
    \"userAddr\": \"${userAddr}\",
    \"slippageLimitPercent\": ${slippage},
    \"compact\": true
  }")

pathId=$(echo "$quote" | jq -r '.pathId')
permit2Message=$(echo "$quote" | jq -c '.permit2Message')

echo "$quote" | jq '{
  outAmount: .outAmounts[0],
  outValueUsd: .outValues[0],
  netOutValueUsd: .netOutValue,
  gasEstimateUsd: .gasEstimateValue,
  priceImpact,
  permit2Required: (.permit2Message != null)
}'
```

### Step 2 — Confirm with the user

**Always.** Show the summary above and ask "shall I proceed?". Do not
continue until they say yes.

### Step 3 — If non-Permit2 path: approve the Odos router

Skip this step if `permit2Required` is true (Permit2 handles approval inline)
or if `fromToken` is the native gas token.

```bash
router=$(curl -sS "https://api.odos.xyz/info/router/v3/${chainId}" | jq -r '.address')
cast send "$fromToken" "approve(address,uint256)" "$router" "$amount" \
  --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY"
```

You can use `MaxUint256` (`115792089237316195423570985008687907853269984665640564039457584007913129639935`)
if the user prefers a one-time approval over per-swap approvals.

### Step 4 — If Permit2 path: sign the typed data

```bash
# Save the typed-data envelope to a file, then sign with cast
echo "$permit2Message" > /tmp/permit2.json
permit2Signature=$(cast wallet sign-typed-data --private-key "$PRIVATE_KEY" --data-file /tmp/permit2.json)
```

### Step 5 — Assemble (with mandatory simulation)

```bash
assembleBody="{
  \"userAddr\": \"${userAddr}\",
  \"pathId\": \"${pathId}\",
  \"simulate\": true"
if [ -n "$permit2Signature" ] && [ "$permit2Message" != "null" ]; then
  assembleBody="${assembleBody},\"permit2Signature\":\"${permit2Signature}\""
fi
assembleBody="${assembleBody}}"

assembled=$(curl -sS -X POST https://api.odos.xyz/sor/assemble \
  -H 'Content-Type: application/json' \
  -d "$assembleBody")

# Refuse to broadcast if simulation failed
isSuccess=$(echo "$assembled" | jq -r '.simulation.isSuccess')
if [ "$isSuccess" = "false" ]; then
  echo "Simulation failed — NOT broadcasting." >&2
  echo "$assembled" | jq '.simulation'
  exit 1
fi
```

### Step 6 — Broadcast

```bash
to=$(echo "$assembled" | jq -r '.transaction.to')
data=$(echo "$assembled" | jq -r '.transaction.data')
value=$(echo "$assembled" | jq -r '.transaction.value')
gas=$(echo "$assembled" | jq -r '.transaction.gas')

cast send "$to" \
  --data "$data" \
  --value "$value" \
  --gas-limit "$gas" \
  --rpc-url "$RPC_URL" \
  --private-key "$PRIVATE_KEY"
```

## Final report to the user

> "Swap submitted. Tx hash: `0x...`. Expected output: ~X USDC. Wait for one
>  confirmation; I'll fetch the receipt if you want."

If they want the receipt:

```bash
cast receipt "$txHash" --rpc-url "$RPC_URL"
```

## Hard rules

- **Never modify the calldata** returned by `/sor/assemble`. Pass it to
  `cast send` exactly as received.
- **Refuse to broadcast** if `simulation.isSuccess === false`. Surface the
  `simulationError` to the user and ask them to fix the underlying issue
  (insufficient balance, missing approval, slippage too tight).
- **Re-quote** if more than ~30 seconds have passed since the original
  quote. The `pathId` will have expired.
