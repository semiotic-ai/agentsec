#!/usr/bin/env bash
# Verbatim extraction of the bash code blocks from ../SKILL.md (steps 1-6).
# Preserves the upstream risky patterns intentionally so the agentsec scanner
# picks them up in raw shell context: MaxUint256 allowance, /tmp/permit2.json
# keyfile path, $PRIVATE_KEY on cast send, 0.5% default slippage, unchecked
# RPC_URL, live router fetch.
#
# Source: https://github.com/odos-xyz/odos-skills/blob/main/skills/odos-swap.md
# Commit: f88b7c89e5f6e7155882f59b295eb695aac0ebc0

set -euo pipefail

# Required environment from SKILL.md "Required environment":
#   export PRIVATE_KEY=0x...        # the signer
#   export RPC_URL=https://...      # chain RPC

# --- Step 1 — Quote ---------------------------------------------------------

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

# --- Step 2 — Confirm with the user (out-of-band; not scripted) -------------

# --- Step 3 — If non-Permit2 path: approve the Odos router ------------------
# Skip this step if `permit2Required` is true (Permit2 handles approval
# inline) or if `fromToken` is the native gas token.

router=$(curl -sS "https://api.odos.xyz/info/router/v3/${chainId}" | jq -r '.address')
cast send "$fromToken" "approve(address,uint256)" "$router" "$amount" \
  --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY"

# You can use `MaxUint256`
# (115792089237316195423570985008687907853269984665640564039457584007913129639935)
# if the user prefers a one-time approval over per-swap approvals.

# --- Step 4 — If Permit2 path: sign the typed data --------------------------

# Save the typed-data envelope to a file, then sign with cast
echo "$permit2Message" > /tmp/permit2.json
permit2Signature=$(cast wallet sign-typed-data --private-key "$PRIVATE_KEY" --data-file /tmp/permit2.json)

# --- Step 5 — Assemble (with mandatory simulation) --------------------------

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

# --- Step 6 — Broadcast -----------------------------------------------------

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

# Optional: receipt fetch
# cast receipt "$txHash" --rpc-url "$RPC_URL"
