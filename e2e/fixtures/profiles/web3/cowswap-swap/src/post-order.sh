#!/usr/bin/env bash
# Verbatim extraction of the bash code blocks from ../SKILL.md (steps 1-5).
# Preserves the risky patterns intentionally so the agentsec scanner picks
# them up in raw shell context: ungated `validTo` default of now+3600,
# feeAmount baked into the user-signed typed data, partiallyFillable=false
# default, $PRIVATE_KEY on cast wallet sign-typed-data, /tmp/*.json keyfile
# paths.
#
# Constructed mock; no upstream skill exists. Modeled after the CoW Protocol
# intent flow at api.cow.fi.

set -euo pipefail

# Required environment from SKILL.md "Required environment":
#   export PRIVATE_KEY=0x...
#   export COW_API="https://api.cow.fi/mainnet"

# --- Step 1 — Quote ---------------------------------------------------------

sellToken="0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"   # USDC mainnet
buyToken="0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"    # WETH mainnet
sellAmount="1000000000"                                    # 1000 USDC (6 decimals)
owner=$(cast wallet address --private-key "$PRIVATE_KEY")

quote=$(curl -sS -X POST "${COW_API}/api/v1/quote" \
  -H 'Content-Type: application/json' \
  -d "{
    \"sellToken\": \"${sellToken}\",
    \"buyToken\": \"${buyToken}\",
    \"sellAmountBeforeFee\": \"${sellAmount}\",
    \"from\": \"${owner}\",
    \"kind\": \"sell\",
    \"signingScheme\": \"eip712\"
  }")

buyAmount=$(echo "$quote" | jq -r '.quote.buyAmount')
feeAmount=$(echo "$quote" | jq -r '.quote.feeAmount')
quoteId=$(echo "$quote" | jq -r '.id')

# --- Step 2 — User confirmation (out-of-band) -------------------------------

# --- Step 3 — Sign Permit2 typed-data ---------------------------------------
# The relayer at 0xC92E8bdf79f0507f65a392b0ab4667716BFE0110 is the spender;
# Permit2 PermitTransferFrom lets the solver pull sellToken at settlement.

relayer="0xC92E8bdf79f0507f65a392b0ab4667716BFE0110"

cat > /tmp/permit2.json <<EOF
{
  "types": {
    "EIP712Domain": [
      {"name": "name", "type": "string"},
      {"name": "chainId", "type": "uint256"},
      {"name": "verifyingContract", "type": "address"}
    ],
    "PermitTransferFrom": [
      {"name": "permitted", "type": "TokenPermissions"},
      {"name": "spender", "type": "address"},
      {"name": "nonce", "type": "uint256"},
      {"name": "deadline", "type": "uint256"}
    ],
    "TokenPermissions": [
      {"name": "token", "type": "address"},
      {"name": "amount", "type": "uint256"}
    ]
  },
  "domain": {
    "name": "Permit2",
    "chainId": 1,
    "verifyingContract": "0x000000000022D473030F116dDEE9F6B43aC78BA3"
  },
  "primaryType": "PermitTransferFrom",
  "message": {
    "permitted": {"token": "${sellToken}", "amount": "${sellAmount}"},
    "spender": "${relayer}",
    "nonce": "0",
    "deadline": "$(($(date +%s) + 3600))"
  }
}
EOF

permit2Sig=$(cast wallet sign-typed-data --private-key "$PRIVATE_KEY" --data-file /tmp/permit2.json)

# --- Step 4 — Sign the Order typed-data -------------------------------------
# Default validTo is one hour out so the solver has plenty of time to settle.
# partiallyFillable defaults to false (all-or-nothing).

validTo=$(($(date +%s) + 3600))
appData="0x0000000000000000000000000000000000000000000000000000000000000000"

cat > /tmp/order.json <<EOF
{
  "types": {
    "EIP712Domain": [
      {"name": "name", "type": "string"},
      {"name": "version", "type": "string"},
      {"name": "chainId", "type": "uint256"},
      {"name": "verifyingContract", "type": "address"}
    ],
    "Order": [
      {"name": "sellToken", "type": "address"},
      {"name": "buyToken", "type": "address"},
      {"name": "receiver", "type": "address"},
      {"name": "sellAmount", "type": "uint256"},
      {"name": "buyAmount", "type": "uint256"},
      {"name": "validTo", "type": "uint32"},
      {"name": "appData", "type": "bytes32"},
      {"name": "feeAmount", "type": "uint256"},
      {"name": "kind", "type": "string"},
      {"name": "partiallyFillable", "type": "bool"},
      {"name": "sellTokenBalance", "type": "string"},
      {"name": "buyTokenBalance", "type": "string"}
    ]
  },
  "domain": {
    "name": "Gnosis Protocol",
    "version": "v2",
    "chainId": 1,
    "verifyingContract": "0x9008D19f58AAbD9eD0D60971565AA8510560ab41"
  },
  "primaryType": "Order",
  "message": {
    "sellToken": "${sellToken}",
    "buyToken": "${buyToken}",
    "receiver": "${owner}",
    "sellAmount": "${sellAmount}",
    "buyAmount": "${buyAmount}",
    "validTo": ${validTo},
    "appData": "${appData}",
    "feeAmount": "${feeAmount}",
    "kind": "sell",
    "partiallyFillable": false,
    "sellTokenBalance": "erc20",
    "buyTokenBalance": "erc20"
  }
}
EOF

orderSig=$(cast wallet sign-typed-data --private-key "$PRIVATE_KEY" --data-file /tmp/order.json)

# --- Step 5 — POST the order ------------------------------------------------

postBody=$(jq -n \
  --arg sellToken "$sellToken" \
  --arg buyToken "$buyToken" \
  --arg owner "$owner" \
  --arg sellAmount "$sellAmount" \
  --arg buyAmount "$buyAmount" \
  --arg feeAmount "$feeAmount" \
  --arg appData "$appData" \
  --arg sig "$orderSig" \
  --arg quoteId "$quoteId" \
  --argjson validTo "$validTo" \
  '{
    sellToken: $sellToken,
    buyToken: $buyToken,
    receiver: $owner,
    sellAmount: $sellAmount,
    buyAmount: $buyAmount,
    validTo: $validTo,
    appData: $appData,
    feeAmount: $feeAmount,
    kind: "sell",
    partiallyFillable: false,
    sellTokenBalance: "erc20",
    buyTokenBalance: "erc20",
    signingScheme: "eip712",
    signature: $sig,
    from: $owner,
    quoteId: ($quoteId | tonumber)
  }')

orderUid=$(curl -sS -X POST "${COW_API}/api/v1/orders" \
  -H 'Content-Type: application/json' \
  -d "$postBody" | jq -r '.')

echo "Order UID: ${orderUid}"

# --- Recurring orders (session-key pattern) ---------------------------------
# For DCA / scheduled buys, sign once with a long-lived validTo and replay
# fresh orders without re-prompting the user each cycle. The agent stores
# (sellToken, buyAmount, sessionValidTo) and re-posts every cron tick.

sessionValidTo=$(($(date +%s) + 86400 * 30))   # 30 days — no per-cycle re-consent
echo "Session active until: ${sessionValidTo}"
