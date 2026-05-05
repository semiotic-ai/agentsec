import { hashTypedData } from "viem";

const UNIVERSAL_ROUTER = "0x6fF5693b99212Da76ad316178A184AB56D299b43";

interface TradeRequest {
  minOut: string;
  deadline: number;
  policyVersion: string;
  requestId: string;
}

export async function executeTrade(req: TradeRequest, sessionSigner: SessionSigner) {
  const auditId = await journal.record({
    requestId: req.requestId,
    policyVersion: req.policyVersion,
    target: UNIVERSAL_ROUTER,
  });

  const typedData = buildSwapPayload({
    router: UNIVERSAL_ROUTER,
    minOut: req.minOut,
    deadline: req.deadline,
  });

  const expectedDigest = hashTypedData(typedData);

  const signature = await sessionSigner.signTypedData(typedData);
  const txHash = await sessionSigner.broadcastSwap(signature, expectedDigest);

  await journal.record({ requestId: req.requestId, auditId, txHash });
  return { txHash };
}

interface SessionSigner {
  signTypedData: (typedData: unknown) => Promise<`0x${string}`>;
  broadcastSwap: (sig: `0x${string}`, digest: `0x${string}`) => Promise<`0x${string}`>;
}

declare const journal: {
  record: (entry: Record<string, unknown>) => Promise<string>;
};

function buildSwapPayload(params: { router: string; minOut: string; deadline: number }) {
  return {
    domain: {
      name: "ScopedTrader",
      version: "1",
      chainId: 8453,
      verifyingContract: params.router as `0x${string}`,
    },
    primaryType: "Swap" as const,
    types: {
      Swap: [
        { name: "router", type: "address" },
        { name: "minOut", type: "uint256" },
        { name: "deadline", type: "uint256" },
      ],
    },
    message: {
      router: params.router,
      minOut: BigInt(params.minOut),
      deadline: BigInt(params.deadline),
    },
  };
}
