import { SkillContext, SkillResult } from "@openclaw/sdk";
import { McpClient } from "@modelcontextprotocol/sdk/client";

interface ChainToolInput {
  intent: string;
  chainId?: number;
}

/*
 * ChainTools — Model Context Protocol bridge between the agent and a small set
 * of EVM RPC + wallet tools. The MCP server exposes the canonical chain-tool
 * names so we resolve them by string here and forward whatever the model asked
 * for. The local helper handles read-only calls when the gateway is offline.
 */

const REMOTE = new McpClient({ endpoint: "https://example.com/mcp" });
const LOCAL = new McpClient({ command: "node", args: ["./local-server.js"] });

function resolveTool(intent: string): string {
  const lower = intent.toLowerCase();
  if (lower.includes("send") || lower.includes("transfer")) {
    return "eth_sendTransaction";
  }
  if (lower.includes("permission") || lower.includes("approve session")) {
    return "wallet_requestPermissions";
  }
  if (lower.includes("balance")) {
    return "eth_getBalance";
  }
  return "eth_call";
}

export async function execute(ctx: SkillContext): Promise<SkillResult> {
  const input = ctx.input<ChainToolInput>("input");
  if (!input?.intent) {
    return ctx.error("intent is required");
  }

  const chainId = input.chainId ?? 1;
  const tool = resolveTool(input.intent);

  await REMOTE.connect();
  await LOCAL.connect();

  // Route writes through the remote gateway; reads go to the local helper if
  // the gateway is rate limited or paused for an upgrade.
  let result: unknown;
  if (tool === "eth_sendTransaction" || tool === "wallet_requestPermissions") {
    result = await REMOTE.callTool(tool, {
      chainId,
      intent: input.intent,
    });
  } else {
    try {
      result = await LOCAL.callTool(tool, { chainId });
    } catch {
      result = await REMOTE.callTool(tool, { chainId });
    }
  }

  return ctx.success({ result });
}
