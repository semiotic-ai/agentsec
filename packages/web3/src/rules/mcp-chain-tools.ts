import type { AgentSkill, SecurityFinding, SkillFile } from "@agentsec/shared";
import { getEvidenceLine, getLineNumber, isInComment, shouldScanFile } from "../primitives/eth";

/**
 * Rule: AST-W08 — MCP Chain-Tool Drift / Capability Smuggling
 *
 * A skill depends on an MCP server exposing chain tools (`eth_sendTransaction`,
 * `getBalance`, `swap`, etc.). The MCP server can be silently updated to add
 * new tools, expand parameter schemas, return prompt-injection content in tool
 * results, or rebind the same tool name to a different RPC / contract.
 *
 * Detection here is manifest-centric — `manifest.web3.mcpServers` is the
 * primary signal source — and is paired with code-side detection of chain-tool
 * names that should be declared in that block.
 */

/** Match well-known chain-namespaced MCP tool names. */
const CHAIN_TOOL_RE =
  /\beth_(?:sendTransaction|sign|signTypedData|sendRawTransaction|call|getBalance|chainId)\b|\bwallet_(?:requestPermissions|switchEthereumChain|addEthereumChain)\b|\bchain_\w+/g;

/** stdio MCP transports the scanner recognises. */
const STDIO_TRANSPORT_RE = /^(?:node|python|deno|bun|npx|uvx)\b/i;

/** MCP-related prose in a chain context. */
const MCP_PROSE_RE = /\b(?:Model\s+Context\s+Protocol|MCP\s+(?:server|tool))\b/i;
const CHAIN_PROSE_RE =
  /(?:\beth(?:_\w+)?\b|\bwallet(?:_\w+)?\b|\bchain(?:_\w+)?\b|\b(?:rpc|onchain|on-chain|evm|web3|blockchain|swap|signer|wagmi|viem|ethers)\b)/i;

/**
 * Hosts the project recognises as established MCP origins. Wildcards use a
 * leading `*.`. The list is intentionally broad — its job is to suppress the
 * most aggressive false positive (every Smithery-hosted MCP getting flagged)
 * while still flagging unfamiliar typo-squat domains. A vendor not on this
 * list isn't necessarily malicious; the rule emits a low-severity hint.
 */
const RECOMMENDED_HOSTS: readonly string[] = [
  // Local
  "localhost",
  "127.0.0.1",
  "::1",
  // Anthropic
  "mcp.anthropic.com",
  // Cloud / wallet / chain vendors with first-party MCP surfaces
  "*.coinbase.com",
  "*.metamask.io",
  "*.modelcontextprotocol.io",
  // Established MCP registries / relays
  "smithery.ai",
  "*.smithery.ai",
  "gitmcp.io",
  "*.gitmcp.io",
  "pulse.so",
  "*.pulse.so",
  "hyper-mcp.com",
  "*.hyper-mcp.com",
];

interface McpServerEntry {
  url?: unknown;
  pinnedHash?: unknown;
  pinnedVersion?: unknown;
}

/** Iterate all matches of a global regex over a string body. */
function findAllMatches(content: string, regex: RegExp): RegExpExecArray[] {
  const matches: RegExpExecArray[] = [];
  const flags = regex.flags.includes("g") ? regex.flags : `${regex.flags}g`;
  const re = new RegExp(regex.source, flags);
  let match: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: idiomatic regex iteration
  while ((match = re.exec(content)) !== null) {
    matches.push(match);
    if (match.index === re.lastIndex) re.lastIndex++;
  }
  return matches;
}

/** Pull `web3.mcpServers` off a skill manifest with defensive typing. */
function getMcpServers(skill: AgentSkill): McpServerEntry[] {
  const servers = skill.manifest.web3?.mcpServers;
  return Array.isArray(servers) ? (servers as McpServerEntry[]) : [];
}

/** True when the manifest declares a `web3.mcpServers` array (even if empty). */
function manifestHasMcpServersBlock(skill: AgentSkill): boolean {
  return Array.isArray(skill.manifest.web3?.mcpServers);
}

/** Collect declared tool names from the manifest. */
function getDeclaredToolNames(skill: AgentSkill): Set<string> {
  const names = new Set<string>();
  const requires = skill.manifest.requires;
  if (requires && typeof requires === "object") {
    const tools = (requires as { tools?: unknown }).tools;
    if (Array.isArray(tools)) {
      for (const t of tools) {
        if (typeof t === "string") {
          names.add(t);
        } else if (
          t &&
          typeof t === "object" &&
          typeof (t as { name?: unknown }).name === "string"
        ) {
          names.add((t as { name: string }).name);
        }
      }
    }
  }
  for (const server of getMcpServers(skill)) {
    const tools = (server as { tools?: unknown }).tools;
    if (Array.isArray(tools)) {
      for (const t of tools) {
        if (typeof t === "string") {
          names.add(t);
        } else if (
          t &&
          typeof t === "object" &&
          typeof (t as { name?: unknown }).name === "string"
        ) {
          names.add((t as { name: string }).name);
        }
      }
    }
  }
  return names;
}

/** Match a host against an allowlist that may contain `*.` wildcards. */
function hostMatchesAllowlist(host: string, allowlist: readonly string[]): boolean {
  const lower = host.toLowerCase();
  for (const entry of allowlist) {
    if (entry.startsWith("*.")) {
      const suffix = entry.slice(1).toLowerCase();
      if (lower.endsWith(suffix) || lower === suffix.slice(1)) return true;
    } else if (lower === entry.toLowerCase()) {
      return true;
    }
  }
  return false;
}

/** Best-effort URL host parse. Returns null when the value is not a URL. */
function parseHost(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

function checkMissingPinning(
  skill: AgentSkill,
  findings: SecurityFinding[],
  counter: { n: number },
): void {
  const servers = getMcpServers(skill);
  for (let i = 0; i < servers.length; i++) {
    const server = servers[i];
    const hasHash = typeof server.pinnedHash === "string" && server.pinnedHash.length > 0;
    const hasVersion = typeof server.pinnedVersion === "string" && server.pinnedVersion.length > 0;
    if (hasHash || hasVersion) continue;

    const url = typeof server.url === "string" ? server.url : "<unspecified>";
    counter.n++;
    findings.push({
      id: `W08-001-${counter.n}`,
      rule: "web3-mcp-chain-drift",
      severity: "high",
      category: "web3-mcp-chain-drift",
      title: "MCP server declared without pinnedHash or pinnedVersion",
      description: `The MCP server entry at index ${i} (\`${url}\`) is declared without a \`pinnedHash\` or \`pinnedVersion\`. The upstream server can be silently updated to add new chain tools, expand parameter schemas, or rebind the same tool name to a different RPC / contract — turning a previously-audited capability surface into an attacker-controlled one.`,
      remediation:
        "Pin every entry in `web3.mcpServers` to a `pinnedHash` (preferred — content hash of the server bundle or stdio binary) or, at minimum, an exact `pinnedVersion`. Refuse to launch the skill if the runtime resolves a different hash than declared.",
    });
  }
}

function checkUnrecognisedTransport(
  skill: AgentSkill,
  findings: SecurityFinding[],
  counter: { n: number },
): void {
  const servers = getMcpServers(skill);
  for (let i = 0; i < servers.length; i++) {
    const url = servers[i].url;
    if (typeof url !== "string" || url.length === 0) continue;
    if (/^https?:\/\//i.test(url)) continue;
    if (STDIO_TRANSPORT_RE.test(url.trim())) continue;

    counter.n++;
    findings.push({
      id: `W08-002-${counter.n}`,
      rule: "web3-mcp-chain-drift",
      severity: "medium",
      category: "web3-mcp-chain-drift",
      title: "MCP server with unrecognised transport",
      description: `The MCP server entry at index ${i} declares URL \`${url}\`, which is neither an https:// endpoint nor a recognised stdio command (node | python | deno | bun | npx | uvx). The runtime cannot apply transport-specific hardening (TLS pinning for HTTPS, sandbox profile for stdio) when it cannot classify the transport.`,
      remediation:
        "Use an `https://` URL for remote servers (and pin the TLS leaf or hash) or invoke a local stdio server via one of `node | python | deno | bun | npx | uvx`. Reject any other transport at load time.",
    });
  }
}

function checkUndeclaredChainCapability(
  skill: AgentSkill,
  findings: SecurityFinding[],
  counter: { n: number },
): void {
  if (manifestHasMcpServersBlock(skill)) return;

  for (const file of skill.files) {
    if (!shouldScanFile(file.relativePath)) continue;
    for (const match of findAllMatches(file.content, CHAIN_TOOL_RE)) {
      if (isInComment(file.content, match.index)) continue;
      counter.n++;
      findings.push({
        id: `W08-003-${counter.n}`,
        rule: "web3-mcp-chain-drift",
        severity: "high",
        category: "web3-mcp-chain-drift",
        title: "Undeclared MCP chain capability",
        description: `Skill code references the chain-namespaced tool \`${match[0]}\` but the manifest does not declare a \`web3.mcpServers\` block. The runtime cannot pin, version-check, or sandbox an MCP capability it does not know about — a silent upstream change can introduce or rebind tools the skill ends up calling.`,
        file: file.relativePath,
        line: getLineNumber(file.content, match.index),
        evidence: getEvidenceLine(file.content, match.index),
        remediation:
          "Declare every MCP server the skill depends on under `web3.mcpServers` in SKILL.md (with `pinnedHash` or `pinnedVersion`). List the chain tools the skill is permitted to invoke so the runtime can reject any tool name that drifts in later.",
      });
    }
  }
}

function checkChainToolNotInDeclared(
  skill: AgentSkill,
  findings: SecurityFinding[],
  counter: { n: number },
): void {
  if (!manifestHasMcpServersBlock(skill)) return;

  const declared = getDeclaredToolNames(skill);

  for (const file of skill.files) {
    if (!shouldScanFile(file.relativePath)) continue;
    for (const match of findAllMatches(file.content, CHAIN_TOOL_RE)) {
      if (isInComment(file.content, match.index)) continue;
      const name = match[0];
      if (declared.has(name)) continue;

      counter.n++;
      findings.push({
        id: `W08-004-${counter.n}`,
        rule: "web3-mcp-chain-drift",
        severity: "medium",
        category: "web3-mcp-chain-drift",
        title: "Chain tool referenced but not in declared MCP tool list",
        description: `Code references the chain-namespaced tool \`${name}\` but it is not listed in any declared MCP server's tool list nor in \`requires.tools\`. This is the smuggling shape of AST-W08: the manifest pins a server but the skill quietly invokes a tool name that may not have existed at audit time.`,
        file: file.relativePath,
        line: getLineNumber(file.content, match.index),
        evidence: getEvidenceLine(file.content, match.index),
        remediation:
          "Add the tool name to the relevant `web3.mcpServers[].tools` entry (or to `requires.tools`). Re-run the audit so the declared capability surface matches what the skill actually calls.",
      });
    }
  }
}

function fileHasMcpProseInChainContext(file: SkillFile): boolean {
  return MCP_PROSE_RE.test(file.content) && CHAIN_PROSE_RE.test(file.content);
}

function checkMcpProseWithEmptyBlock(
  skill: AgentSkill,
  findings: SecurityFinding[],
  counter: { n: number },
): void {
  const servers = getMcpServers(skill);
  if (!manifestHasMcpServersBlock(skill) || servers.length > 0) return;

  for (const file of skill.files) {
    if (!shouldScanFile(file.relativePath)) continue;
    if (!fileHasMcpProseInChainContext(file)) continue;

    counter.n++;
    findings.push({
      id: `W08-010-${counter.n}`,
      rule: "web3-mcp-chain-drift",
      severity: "low",
      category: "web3-mcp-chain-drift",
      title: "Skill mentions MCP in chain context but `web3.mcpServers` is empty",
      description:
        "Skill documentation or code refers to the Model Context Protocol / MCP server in a chain context, yet the manifest's `web3.mcpServers` array is empty. Either the skill does not actually use MCP (and the reference should be removed) or the manifest is out of date and the runtime cannot pin the server.",
      file: file.relativePath,
      line: getLineNumber(file.content, 0),
      evidence: getEvidenceLine(file.content, 0),
      remediation:
        "Populate `web3.mcpServers` with the actual servers the skill depends on (with `pinnedHash` / `pinnedVersion`), or remove the MCP references from prose if the skill no longer uses MCP.",
    });
    return;
  }
}

function checkUntrustedHost(
  skill: AgentSkill,
  findings: SecurityFinding[],
  counter: { n: number },
): void {
  const servers = getMcpServers(skill);
  for (let i = 0; i < servers.length; i++) {
    const url = servers[i].url;
    if (typeof url !== "string") continue;
    if (!/^https?:\/\//i.test(url)) continue;
    const host = parseHost(url);
    if (!host) continue;
    if (hostMatchesAllowlist(host, RECOMMENDED_HOSTS)) continue;

    counter.n++;
    findings.push({
      id: `W08-011-${counter.n}`,
      rule: "web3-mcp-chain-drift",
      severity: "low",
      category: "web3-mcp-chain-drift",
      title: "MCP server host not on project-recommended list",
      description: `The MCP server entry at index ${i} points to host \`${host}\`, which is not on the project-recommended allowlist (\`mcp.anthropic.com\`, \`localhost\`, \`127.0.0.1\`, \`*.coinbase.com\`, \`*.metamask.io\`). Unknown hosts cannot be implicitly trusted to enforce capability boundaries.`,
      remediation:
        "Move the server behind a recommended host or add the host to a curated allowlist after a security review. Pair host trust with `pinnedHash` so the runtime can detect upstream drift even on a recognised host.",
    });
  }
}

/**
 * Run the AST-W08 detection pipeline over a single skill.
 */
export function checkMcpChainTools(skill: AgentSkill): SecurityFinding[] {
  const findings: SecurityFinding[] = [];
  const counter = { n: 0 };

  checkMissingPinning(skill, findings, counter);
  checkUnrecognisedTransport(skill, findings, counter);
  checkUndeclaredChainCapability(skill, findings, counter);
  checkChainToolNotInDeclared(skill, findings, counter);
  checkMcpProseWithEmptyBlock(skill, findings, counter);
  checkUntrustedHost(skill, findings, counter);

  return findings;
}
