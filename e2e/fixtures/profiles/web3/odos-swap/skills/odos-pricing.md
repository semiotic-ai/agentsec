---
name: odos-pricing
description: Look up real-time or historical USD price of any ERC-20 token on an Odos-supported chain. Use when the user asks "what's the price of token X" or needs a USD reference for converting between tokens, or wants a block-pinned historical price for backtesting.
---

# odos-pricing — token pricing lookup

Odos derives prices directly from the liquidity pools it tracks (1,150+
sources). Works for any token with onchain liquidity — including long-tail
tokens that no centralized price oracle covers — using only the contract
address.

## Single token, current block

```bash
chainId=8453
token="0x833589fcd6edb6e08f4c7c32d4f71b54bda02913"   # USDC on Base

curl -sS "https://api.odos.xyz/pricing/token/${chainId}/${token}?currency=USD" | jq
```

Response shape:

```json
{ "currencyId": "USD", "price": 1.000049 }
```

## Historical / block-pinned price

Pass `&block=<blockNumber>` to get the price as of a specific block. Useful
for backtesting, audit trails, and reproducible analyses.

```bash
curl -sS "https://api.odos.xyz/pricing/token/${chainId}/${token}?currency=USD&block=23619524" | jq
```

## Bulk: all priced tokens on a chain

```bash
curl -sS "https://api.odos.xyz/pricing/token/${chainId}?currency=USD" | jq '.tokenPrices | to_entries[:10]'
```

Returns a map of `tokenAddress -> price`. Useful for valuing a portfolio in
one round trip.

## How to convert "100 USDC" or "0.5 WETH" to base units

```bash
# Get decimals from the token list (cached by Odos)
decimals=$(curl -sS "https://api.odos.xyz/info/tokens/${chainId}" | \
           jq -r ".tokenMap[\"${token}\"].decimals")

# Multiply: amount * 10^decimals as an integer string
python3 -c "import sys; amt=float(sys.argv[1]); d=int(sys.argv[2]); print(int(amt * 10**d))" 100 "$decimals"
# => 100000000   (for USDC with 6 decimals)
```

(Why not bash arithmetic? Bash can't handle large integers like 18-decimal
WETH amounts without overflow. Use `python3` or `bc`.)

## Errors

- `404` — token isn't in any Odos-tracked pool on that chain. The token
  exists onchain but nobody trades it, so Odos can't price it. Try a
  different chain or wait for liquidity.
- `400` — bad chainId or malformed token address.
