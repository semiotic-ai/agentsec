---
name: odos-path-viz
description: Inspect the route Odos picked for a swap, as a structured graph (nodes = tokens, edges = pool hops). Use when the user asks "how is Odos routing this", "show me the route", "which DEXs does it use", or wants to compare routing decisions across sizes/pairs. Read-only — no transactions.
---

# odos-path-viz — inspect the route

## When to use

User wants to see the route Odos chose for a swap, not just the output
number. Useful for debugging unexpected price impact, understanding which
pools/DEXs Odos is using, or showing a route diagram.

## Procedure

Add `"pathViz": true` to a normal `/sor/quote/v3` request. The response
gains a `pathViz` field with `nodes` (tokens) and `links` (pool hops).

```bash
chainId=8453
fromToken="0x4200000000000000000000000000000000000006"
toToken="0x833589fcd6edb6e08f4c7c32d4f71b54bda02913"
amount="1000000000000000000"   # 1 WETH

curl -sS -X POST https://api.odos.xyz/sor/quote/v3 \
  -H 'Content-Type: application/json' \
  -d "{
    \"chainId\": ${chainId},
    \"inputTokens\": [{\"tokenAddress\": \"${fromToken}\", \"amount\": \"${amount}\"}],
    \"outputTokens\": [{\"tokenAddress\": \"${toToken}\", \"proportion\": 1}],
    \"userAddr\": \"0x0000000000000000000000000000000000000001\",
    \"slippageLimitPercent\": 0.5,
    \"pathViz\": true
  }" | jq '.pathViz'
```

## Render as Mermaid for the user

A flowchart is easier to reason about than the JSON graph. Convert nodes +
links to a Mermaid `flowchart LR`:

```bash
# Save the pathViz to a file then run a small jq script
echo "$response" | jq '.pathViz' > /tmp/pv.json

jq -r '
  "flowchart LR",
  (.nodes | to_entries[] | "  n\(.key)[\"\(.value.symbol // .value.name // "n\(.key)")\"]"),
  (.links[] | "  n\(.source) -->|\(.label // .stepName // "")| n\(.target)")
' /tmp/pv.json
```

Then render the result in whatever surface the agent has (a Mermaid block in
the chat, or a saved `.mermaid` file).

## What to point out to the user

When you summarize the route, surface:

- **Number of hops** — `.links | length`. More hops = more opportunities for
  slippage; sometimes Odos picks a 3-hop route to avoid a thin pool.
- **Distinct DEXs used** — count distinct `stepName` or `label` values.
  More DEXs = more aggregation; useful as a sanity check.
- **Splits** — if multiple links share a `source` node with `sourceExtend`
  set, Odos is splitting the input across two paths in parallel.

> Example: "Odos split your 1 WETH across two paths: 60% through Uniswap v3
>  WETH/USDC, 40% through Aerodrome WETH/USDbC then USDbC/USDC. Two pools,
>  one hop each, no exotic intermediates."

## Gotchas

- `pathViz` adds latency to the quote — only request it when the user
  actually wants the route.
- The graph schema can evolve; always treat unknown fields as optional.
- For multi-asset swaps the graph has multiple source nodes — render each as
  a separate input branch in the Mermaid output.
