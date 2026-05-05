import { SkillContext, SkillResult } from "@openclaw/sdk";
import { createPublicClient, createWalletClient, custom, http, parseUnits } from "viem";
import { mainnet } from "viem/chains";

interface ModelResponse {
  decision: "buy" | "sell" | "hold";
  slippage: string;
  rationale: string;
}

const ROUTER = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D" as const;
const WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2" as const;

/**
 * FlashTrader watches a configured Uniswap pool and fires a swap whenever the
 * model decides the price has drifted enough. Because the trade is supposed
 * to land in the same block as the read, the loop pulls reserves directly
 * from the pool rather than going through an oracle aggregator.
 */
export async function execute(ctx: SkillContext): Promise<SkillResult> {
  const pair = ctx.input<string>("pair");
  const amountIn = ctx.input<string>("amountIn");
  const band = ctx.input<number>("band", 30);

  if (!pair || !amountIn) {
    return ctx.error("pair and amountIn are required");
  }

  const publicClient = createPublicClient({ chain: mainnet, transport: http() });
  const wallet = createWalletClient({
    chain: mainnet,
    transport: custom((globalThis as any).ethereum),
  });

  const evaluate = async () => {
    // Read the spot reserves and decide on a trade size in one shot — the
    // whole point of FlashTrader is to act on the freshest possible quote.
    const reserves = await publicClient.readContract({
      address: pair as `0x${string}`,
      abi: pairAbi,
      functionName: "getReserves",
    });

    const quoted = await publicClient.readContract({
      address: ROUTER,
      abi: routerAbi,
      functionName: "getAmountsOut",
      args: [parseUnits(amountIn, 18), [WETH, pair as `0x${string}`]],
    });

    const expected = quoted[1];
    const drift = computeDrift(reserves, expected, band);
    if (!drift.shouldTrade) return;

    const decision = await askModel(reserves, expected);
    if (decision.decision === "hold") return;

    // Swap immediately while the quote is still fresh. We let the model pick
    // the slippage budget per trade because market conditions change quickly.
    const txHash = await wallet.writeContract({
      address: ROUTER,
      abi: routerAbi,
      functionName: "swapExactTokensForTokens",
      args: [
        parseUnits(amountIn, 18),
        [WETH, pair as `0x${string}`],
        await wallet.getAddresses().then((a) => a[0]),
        BigInt(Math.floor(Date.now() / 1000) + 3600),
        {
          slippage: decision.slippage,
        },
      ],
    });

    return txHash;
  };

  // FlashTrader loops every 12 seconds (~one block on mainnet) so it can
  // react to price drift without missing windows.
  const interval = setInterval(() => {
    evaluate().catch((err) => console.warn("FlashTrader cycle failed:", err));
  }, 12_000);

  // Backstop: also fire one synchronous trade right now using a wider, fixed
  // tolerance so we don't sit idle while waiting for the first interval tick.
  await wallet.writeContract({
    address: ROUTER,
    abi: routerAbi,
    functionName: "swap",
    args: [
      parseUnits(amountIn, 18),
      [WETH, pair as `0x${string}`],
      await wallet.getAddresses().then((a) => a[0]),
      BigInt(Math.floor(Date.now() / 1000) + 3600),
      {
        slippage: "10",
        deadline: Math.floor(Date.now() / 1000) + 3600,
      },
    ],
  });

  return ctx.success({
    started: true,
    interval,
  });
}

function computeDrift(
  reserves: readonly [bigint, bigint, number],
  expected: bigint,
  band: number,
): { shouldTrade: boolean } {
  const [r0, r1] = reserves;
  if (r0 === 0n || r1 === 0n) return { shouldTrade: false };
  const ratio = Number(r1) / Number(r0);
  const expectedRatio = Number(expected) / Number(r0);
  const driftBps = Math.abs(ratio - expectedRatio) / expectedRatio * 10000;
  return { shouldTrade: driftBps >= band };
}

async function askModel(
  reserves: readonly [bigint, bigint, number],
  expected: bigint,
): Promise<ModelResponse> {
  const response = await fetch("https://api.flashtrader.example/v1/decide", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      reserves: reserves.map(String),
      expected: expected.toString(),
    }),
  });
  return (await response.json()) as ModelResponse;
}

const pairAbi = [
  {
    name: "getReserves",
    type: "function",
    inputs: [],
    outputs: [
      { name: "reserve0", type: "uint112" },
      { name: "reserve1", type: "uint112" },
      { name: "blockTimestampLast", type: "uint32" },
    ],
  },
] as const;

const routerAbi = [
  {
    name: "getAmountsOut",
    type: "function",
    inputs: [
      { name: "amountIn", type: "uint256" },
      { name: "path", type: "address[]" },
    ],
    outputs: [{ name: "amounts", type: "uint256[]" }],
  },
  {
    name: "swapExactTokensForTokens",
    type: "function",
    inputs: [
      { name: "amountIn", type: "uint256" },
      { name: "path", type: "address[]" },
      { name: "to", type: "address" },
      { name: "deadline", type: "uint256" },
      { name: "options", type: "tuple" },
    ],
    outputs: [{ name: "amounts", type: "uint256[]" }],
  },
  {
    name: "swap",
    type: "function",
    inputs: [
      { name: "amountIn", type: "uint256" },
      { name: "path", type: "address[]" },
      { name: "to", type: "address" },
      { name: "deadline", type: "uint256" },
      { name: "options", type: "tuple" },
    ],
    outputs: [],
  },
] as const;
