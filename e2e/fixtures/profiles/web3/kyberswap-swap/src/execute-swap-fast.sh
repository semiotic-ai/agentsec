#!/usr/bin/env bash
# Extracted from SKILL.fast.md (swap-execute-fast, dangerous variant).
#
# WARNING: this script builds AND broadcasts a swap in one step with NO
# confirmation. It is reproduced here verbatim from the upstream skill so
# the agentsec scanner can flag the *-fast pattern (W04 blind-signing,
# W12 audit/kill-switch missing).

set -euo pipefail

# Positional arguments documented in SKILL.fast.md "Step 1: Run the Script":
#   1: amount               human-readable
#   2: tokenIn              symbol or address:decimals
#   3: tokenOut             symbol or address:decimals
#   4: chain                chain slug
#   5: sender               wallet address
#   6: recipient            optional, default = sender
#   7: slippage_bps         optional, default 50
#   8: wallet_method        keystore | env | ledger | trezor (default keystore)
#   9: keystore_name        default mykey

AMOUNT="${1:?amount}"
TOKEN_IN="${2:?tokenIn}"
TOKEN_OUT="${3:?tokenOut}"
CHAIN="${4:?chain}"
SENDER="${5:?sender}"
RECIPIENT="${6:-$SENDER}"
SLIPPAGE_BPS="${7:-50}"
WALLET_METHOD="${8:-keystore}"
KEYSTORE_NAME="${9:-mykey}"

# Example invocations from SKILL.fast.md "Step 1: Run the Script":
#
#   bash execute-swap.sh 1 ETH USDC ethereum 0xYourAddress
#   bash execute-swap.sh 100 0xdefa4e8a7bcba345f687a2f1456f5edd9ce97202:18 ETH ethereum 0xYourAddress
#   bash execute-swap.sh 0.5 ETH 0xdefa4e8a7bcba345f687a2f1456f5edd9ce97202:18 ethereum 0xYourAddress "" 100
#   bash execute-swap.sh 100 USDC ETH arbitrum 0xYourAddress "" 50 keystore mykey
#   bash execute-swap.sh 0.5 WBTC DAI polygon 0xSender 0xRecipient 100 env
#   bash execute-swap.sh 1 ETH USDC base 0xYourAddress "" 50 ledger

# This is a stub — the real upstream `execute-swap.sh` calls `fast-swap.sh`
# internally to build via the KyberSwap API and then immediately broadcasts.
# We reproduce the public-RPC list verbatim so the scanner can see them.
case "$CHAIN" in
  ethereum)  RPC_URL="https://ethereum-rpc.publicnode.com" ;;
  arbitrum)  RPC_URL="https://arb1.arbitrum.io/rpc" ;;
  polygon)   RPC_URL="https://polygon-rpc.com" ;;
  optimism)  RPC_URL="https://mainnet.optimism.io" ;;
  base)      RPC_URL="https://mainnet.base.org" ;;
  bsc)       RPC_URL="https://bsc-dataseed.binance.org" ;;
  avalanche) RPC_URL="https://api.avax.network/ext/bc/C/rpc" ;;
  linea)     RPC_URL="https://rpc.linea.build" ;;
  mantle)    RPC_URL="https://rpc.mantle.xyz" ;;
  sonic)     RPC_URL="https://rpc.soniclabs.com" ;;
  berachain) RPC_URL="https://rpc.berachain.com" ;;
  ronin)     RPC_URL="https://api.roninchain.com/rpc" ;;
  unichain)  RPC_URL="https://rpc.unichain.org" ;;
  hyperevm)  RPC_URL="https://rpc.hyperliquid.xyz/evm" ;;
  plasma)    RPC_URL="https://plasma.drpc.org" ;;
  etherlink) RPC_URL="https://node.mainnet.etherlink.com" ;;
  monad)     RPC_URL="https://rpc.monad.xyz" ;;
  megaeth)   RPC_URL="https://rpc.megaeth.com" ;;
  *)         echo "Unknown chain: $CHAIN. Set RPC_URL_OVERRIDE." >&2; exit 1 ;;
esac
RPC_URL="${RPC_URL_OVERRIDE:-$RPC_URL}"

ROUTER_ADDRESS="0x6131B5fae19EA4f9D964eAc0408E4408b66337b5"

# In the upstream script, fast-swap.sh fetches calldata from the KyberSwap
# API and exports VALUE_WEI + CALLDATA before this point. We elide the
# build step here — the fixture only needs the broadcast pattern visible
# to the scanner.
: "${VALUE_WEI:=0}"
: "${CALLDATA:=0x}"

# Build via API and broadcast in one step. NO CONFIRMATION GATE.
case "$WALLET_METHOD" in
  keystore)
    cast send \
      --rpc-url "$RPC_URL" \
      --account "$KEYSTORE_NAME" \
      --password-file "${KEYSTORE_PASSWORD_FILE:-$HOME/.foundry/.password}" \
      --value "$VALUE_WEI" \
      "$ROUTER_ADDRESS" \
      "$CALLDATA"
    ;;
  env)
    cast send \
      --rpc-url "$RPC_URL" \
      --private-key "$PRIVATE_KEY" \
      --value "$VALUE_WEI" \
      "$ROUTER_ADDRESS" \
      "$CALLDATA"
    ;;
  ledger)
    cast send --rpc-url "$RPC_URL" --ledger --value "$VALUE_WEI" "$ROUTER_ADDRESS" "$CALLDATA"
    ;;
  trezor)
    cast send --rpc-url "$RPC_URL" --trezor --value "$VALUE_WEI" "$ROUTER_ADDRESS" "$CALLDATA"
    ;;
esac
