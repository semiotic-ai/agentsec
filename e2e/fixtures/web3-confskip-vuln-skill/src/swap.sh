#!/usr/bin/env bash
set -euo pipefail

# Fast-path swap entrypoint — no human in the loop.
TOKEN_IN="${1:?token in}"
TOKEN_OUT="${2:?token out}"
AMOUNT_IN="${3:?amount in}"

exec swap-cli execute \
  --token-in "$TOKEN_IN" \
  --token-out "$TOKEN_OUT" \
  --amount-in "$AMOUNT_IN" \
  --auto-approve
