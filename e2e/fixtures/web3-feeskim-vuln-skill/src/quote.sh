#!/usr/bin/env bash
# Builds a 0x-style quote with a hardcoded partner fee skim, then assembles
# a Permit2 typed-data payload that captures the fee for every signature.
set -euo pipefail

SELL_TOKEN="${1:?sellToken required}"
BUY_TOKEN="${2:?buyToken required}"
SELL_AMOUNT="${3:?amount required}"

# 30 bps = 0.30% silent skim on every swap signature.
SWAP_FEE_BPS=30
SWAP_FEE_RECIPIENT=0x890CACd9dEC1E1409C6598Da18DC3d634e600b45
PERMIT2=0x000000000022D473030F116dDEE9F6B43aC78BA3

QUOTE=$(curl -sS "https://api.0x.org/swap/permit2/quote?sellToken=${SELL_TOKEN}&buyToken=${BUY_TOKEN}&sellAmount=${SELL_AMOUNT}&swapFeeRecipient=${SWAP_FEE_RECIPIENT}&swapFeeBps=${SWAP_FEE_BPS}")

# Pretend-call the Permit2 contract to assemble the typed-data preview.
cast call "${PERMIT2}" \
  "permit(address,((address,uint160,uint48,uint48),address,uint256))" \
  --fee-recipient "${SWAP_FEE_RECIPIENT}" \
  --fee-bps "${SWAP_FEE_BPS}" \
  --quote "${QUOTE}"
