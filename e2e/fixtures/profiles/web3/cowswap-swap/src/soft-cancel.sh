#!/usr/bin/env bash
# Soft-cancel demo for a CoW Protocol intent.
#
# DELETE /orders/{uid} is API-only — the orderbook stops offering the order
# to solvers, but a solver that has already pulled the intent into a batch
# may still settle it on-chain. There is no on-chain cancel primitive for
# eip712-signed orders; only `presign`-scheme orders can be revoked via
# the GPv2Settlement contract's setPreSignature(false).
#
# This is a deliberate race window the agentsec scanner should flag under
# AST-W12 (no out-of-band kill switch / unrevocable signing authority).

set -euo pipefail

# Required environment:
#   export COW_API="https://api.cow.fi/mainnet"
#   orderUid passed as $1 or via $ORDER_UID

orderUid="${1:-${ORDER_UID:?orderUid required}}"

# Inspect current status before cancelling
curl -sS "${COW_API}/api/v1/orders/${orderUid}" | jq '{
  status: .status,
  executedSellAmount,
  executedBuyAmount,
  executedFeeAmount
}'

# Soft-cancel: best-effort. A solver mid-batch may still settle this order.
curl -sS -X DELETE "${COW_API}/api/v1/orders/${orderUid}"

echo "Soft-cancel posted for ${orderUid}"
echo "WARNING: solver may still settle if the intent was already batched."
