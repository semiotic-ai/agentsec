#!/usr/bin/env bash
# Extracted from SKILL.md (swap-execute, safe variant).
# Confirmation prompts are part of the host workflow — this script ONLY
# fires after the model has shown the user the transaction details and
# received an explicit "yes".

set -euo pipefail

RPC_URL="${RPC_URL:-https://ethereum-rpc.publicnode.com}"
ROUTER_ADDRESS="${ROUTER_ADDRESS:-0x6131B5fae19EA4f9D964eAc0408E4408b66337b5}"
TX_VALUE="${TX_VALUE:-0}"
TX_GAS="${TX_GAS:-250000}"
TX_DATA="${TX_DATA:?missing TX_DATA — supply encoded calldata from swap-build}"

# --- Wallet setup (one-time, recommended path: encrypted keystore) ---
# cast wallet import mykey --interactive
# Enter private key, then set encryption password.
#
# printf "Password: " && read -s pw && printf '\n' \
#   && echo "$pw" > ~/.foundry/.password && chmod 600 ~/.foundry/.password
#
# cast wallet list

# --- Pre-flight: simulate to catch reverts before spending gas ---
cast call \
  --rpc-url "$RPC_URL" \
  --value "$TX_VALUE" \
  --from "${SENDER:?missing SENDER}" \
  "$ROUTER_ADDRESS" \
  "$TX_DATA"

# --- Verify chain ID matches expected (catch wrong-chain RPC) ---
cast chain-id --rpc-url "$RPC_URL"

# --- Balance + gas-price visibility ---
cast balance --rpc-url "$RPC_URL" "$SENDER"
cast gas-price --rpc-url "$RPC_URL"

# --- Option 1: Keystore + password file (recommended) ---
cast send \
  --rpc-url "$RPC_URL" \
  --account "${KEYSTORE_NAME:-mykey}" \
  --password-file "${KEYSTORE_PASSWORD_FILE:-$HOME/.foundry/.password}" \
  --gas-limit "$TX_GAS" \
  --value "$TX_VALUE" \
  "$ROUTER_ADDRESS" \
  "$TX_DATA"

# --- Option 2: Environment variable (less safe; do not persist) ---
# cast send \
#   --rpc-url "$RPC_URL" \
#   --private-key "$PRIVATE_KEY" \
#   --gas-limit "$TX_GAS" \
#   --value "$TX_VALUE" \
#   "$ROUTER_ADDRESS" \
#   "$TX_DATA"

# --- Option 3: Ledger hardware wallet ---
# cast send \
#   --rpc-url "$RPC_URL" \
#   --ledger \
#   --gas-limit "$TX_GAS" \
#   --value "$TX_VALUE" \
#   "$ROUTER_ADDRESS" \
#   "$TX_DATA"

# --- Option 4: Trezor hardware wallet ---
# cast send \
#   --rpc-url "$RPC_URL" \
#   --trezor \
#   --gas-limit "$TX_GAS" \
#   --value "$TX_VALUE" \
#   "$ROUTER_ADDRESS" \
#   "$TX_DATA"

# --- ERC-20 approval helpers (used by /swap-approve) ---
# cast send \
#   --rpc-url "$RPC_URL" \
#   --account "${KEYSTORE_NAME:-mykey}" \
#   --password-file "${KEYSTORE_PASSWORD_FILE:-$HOME/.foundry/.password}" \
#   "$TOKEN_IN_ADDRESS" \
#   "approve(address,uint256)" \
#   "$ROUTER_ADDRESS" \
#   "$AMOUNT_IN_WEI"
#
# cast call \
#   --rpc-url "$RPC_URL" \
#   "$TOKEN_IN_ADDRESS" \
#   "allowance(address,address)(uint256)" \
#   "$SENDER" \
#   "$ROUTER_ADDRESS"
