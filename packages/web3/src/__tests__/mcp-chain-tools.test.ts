import { describe, expect, test } from "bun:test";
import type { AgentSkill, SkillManifest } from "@agentsec/shared";
import { checkMcpChainTools } from "../rules/mcp-chain-tools";

interface FixtureFile {
  name: string;
  code: string;
}

function mockSkill(manifest: SkillManifest, files: FixtureFile[] = []): AgentSkill {
  return {
    id: "test-skill",
    name: manifest.name,
    version: manifest.version,
    path: "/tmp/test-skill",
    platform: "openclaw",
    manifest,
    files: files.map((f) => ({
      path: `/tmp/test-skill/${f.name}`,
      relativePath: f.name,
      content: f.code,
      language: "typescript",
      size: f.code.length,
    })),
  };
}

const baseManifest: SkillManifest = {
  name: "test-skill",
  version: "1.0.0",
  description: "AST-W08 fixture",
};

// ---------------------------------------------------------------------------
// W08-001: missing pinnedHash AND pinnedVersion
// ---------------------------------------------------------------------------
describe("AST-W08: missing pinning", () => {
  test("flags an MCP server with neither pinnedHash nor pinnedVersion", () => {
    const skill = mockSkill({
      ...baseManifest,
      web3: {
        mcpServers: [{ url: "https://mcp.anthropic.com/eth" }],
      },
    });
    const findings = checkMcpChainTools(skill);
    const hits = findings.filter((f) => f.id.startsWith("W08-001"));
    expect(hits.length).toBeGreaterThanOrEqual(1);
    expect(hits[0].severity).toBe("high");
    expect(hits[0].rule).toBe("web3-mcp-chain-drift");
    expect(hits[0].category).toBe("web3-mcp-chain-drift");
  });

  test("does not flag an MCP server pinned by hash", () => {
    const skill = mockSkill({
      ...baseManifest,
      web3: {
        mcpServers: [
          {
            url: "https://mcp.anthropic.com/eth",
            pinnedHash: "0xabc123",
          },
        ],
      },
    });
    const findings = checkMcpChainTools(skill);
    const hits = findings.filter((f) => f.id.startsWith("W08-001"));
    expect(hits.length).toBe(0);
  });

  test("does not flag an MCP server pinned by version", () => {
    const skill = mockSkill({
      ...baseManifest,
      web3: {
        mcpServers: [
          {
            url: "https://mcp.anthropic.com/eth",
            pinnedVersion: "1.4.2",
          },
        ],
      },
    });
    const findings = checkMcpChainTools(skill);
    const hits = findings.filter((f) => f.id.startsWith("W08-001"));
    expect(hits.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// W08-002: unrecognised transport
// ---------------------------------------------------------------------------
describe("AST-W08: unrecognised transport", () => {
  test("flags an unrecognised transport scheme", () => {
    const skill = mockSkill({
      ...baseManifest,
      web3: {
        mcpServers: [{ url: "ftp://example.com/server", pinnedHash: "0xdeadbeef" }],
      },
    });
    const findings = checkMcpChainTools(skill);
    const hits = findings.filter((f) => f.id.startsWith("W08-002"));
    expect(hits.length).toBe(1);
    expect(hits[0].severity).toBe("medium");
    expect(hits[0].title).toContain("unrecognised transport");
  });

  test("accepts stdio commands as a transport (npx, node, python, etc.)", () => {
    const skill = mockSkill({
      ...baseManifest,
      web3: {
        mcpServers: [
          { url: "npx @example/mcp-eth", pinnedVersion: "1.0.0" },
          { url: "python -m mcp.eth", pinnedVersion: "1.0.0" },
          { url: "node ./bin/mcp.js", pinnedVersion: "1.0.0" },
        ],
      },
    });
    const findings = checkMcpChainTools(skill);
    const hits = findings.filter((f) => f.id.startsWith("W08-002"));
    expect(hits.length).toBe(0);
  });

  test("accepts https endpoints as a transport", () => {
    const skill = mockSkill({
      ...baseManifest,
      web3: {
        mcpServers: [{ url: "https://mcp.anthropic.com/eth", pinnedHash: "0xfeed" }],
      },
    });
    const findings = checkMcpChainTools(skill);
    const hits = findings.filter((f) => f.id.startsWith("W08-002"));
    expect(hits.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// W08-003: undeclared MCP chain capability
// ---------------------------------------------------------------------------
describe("AST-W08: undeclared MCP chain capability", () => {
  test("flags eth_sendTransaction usage when no mcpServers block is declared", () => {
    const skill = mockSkill({ ...baseManifest }, [
      {
        name: "index.ts",
        code: `
import { client } from "./mcp";
await client.call("eth_sendTransaction", { to, value });
`,
      },
    ]);
    const findings = checkMcpChainTools(skill);
    const hits = findings.filter((f) => f.id.startsWith("W08-003"));
    expect(hits.length).toBeGreaterThanOrEqual(1);
    expect(hits[0].severity).toBe("high");
    expect(hits[0].title).toContain("Undeclared MCP chain capability");
    expect(hits[0].file).toBe("index.ts");
    expect(hits[0].evidence).toContain("eth_sendTransaction");
  });

  test("flags wallet_switchEthereumChain usage when no mcpServers block is declared", () => {
    const skill = mockSkill({ ...baseManifest }, [
      {
        name: "switch.ts",
        code: `await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0x1" }] });`,
      },
    ]);
    const findings = checkMcpChainTools(skill);
    const hits = findings.filter((f) => f.id.startsWith("W08-003"));
    expect(hits.length).toBeGreaterThanOrEqual(1);
    expect(hits[0].evidence).toContain("wallet_switchEthereumChain");
  });

  test("ignores eth_* references that sit inside a comment", () => {
    const skill = mockSkill({ ...baseManifest }, [
      {
        name: "noop.ts",
        code: `
// This skill never calls eth_sendTransaction, see docs.
const x = 1;
`,
      },
    ]);
    const findings = checkMcpChainTools(skill);
    const hits = findings.filter((f) => f.id.startsWith("W08-003"));
    expect(hits.length).toBe(0);
  });

  test("does not fire W08-003 when mcpServers block is declared", () => {
    const skill = mockSkill(
      {
        ...baseManifest,
        web3: {
          mcpServers: [
            {
              url: "https://mcp.anthropic.com/eth",
              pinnedHash: "0xabc",
            },
          ],
        },
      },
      [
        {
          name: "index.ts",
          code: `await client.call("eth_sendTransaction", payload);`,
        },
      ],
    );
    const findings = checkMcpChainTools(skill);
    const hits = findings.filter((f) => f.id.startsWith("W08-003"));
    expect(hits.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// W08-004: chain tool referenced but not in declared tool list
// ---------------------------------------------------------------------------
describe("AST-W08: chain tool not in declared tool list", () => {
  test("flags a chain tool that is missing from declared lists", () => {
    const manifest: SkillManifest = {
      ...baseManifest,
      requires: { tools: ["eth_call"] },
      web3: {
        mcpServers: [
          {
            url: "https://mcp.anthropic.com/eth",
            pinnedHash: "0xabc",
          },
        ],
      },
    };
    const skill = mockSkill(manifest, [
      {
        name: "index.ts",
        code: `await client.call("eth_sendTransaction", payload);`,
      },
    ]);
    const findings = checkMcpChainTools(skill);
    const hits = findings.filter((f) => f.id.startsWith("W08-004"));
    expect(hits.length).toBeGreaterThanOrEqual(1);
    expect(hits[0].severity).toBe("medium");
    expect(hits[0].evidence).toContain("eth_sendTransaction");
  });

  test("does not flag a chain tool present in requires.tools", () => {
    const manifest: SkillManifest = {
      ...baseManifest,
      requires: { tools: ["eth_sendTransaction"] },
      web3: {
        mcpServers: [
          {
            url: "https://mcp.anthropic.com/eth",
            pinnedHash: "0xabc",
          },
        ],
      },
    };
    const skill = mockSkill(manifest, [
      {
        name: "index.ts",
        code: `await client.call("eth_sendTransaction", payload);`,
      },
    ]);
    const findings = checkMcpChainTools(skill);
    const hits = findings.filter((f) => f.id.startsWith("W08-004"));
    expect(hits.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// W08-010: MCP prose with empty mcpServers block
// ---------------------------------------------------------------------------
describe("AST-W08: MCP prose with empty servers block", () => {
  test("flags MCP prose in chain context when mcpServers is empty", () => {
    const skill = mockSkill(
      {
        ...baseManifest,
        web3: { mcpServers: [] },
      },
      [
        {
          name: "SKILL.md",
          code: `# Skill\nThis skill uses an MCP server to call eth_sendTransaction on Base.`,
        },
      ],
    );
    const findings = checkMcpChainTools(skill);
    const hits = findings.filter((f) => f.id.startsWith("W08-010"));
    expect(hits.length).toBe(1);
    expect(hits[0].severity).toBe("low");
  });

  test("does not flag MCP prose when mcpServers has at least one entry", () => {
    const skill = mockSkill(
      {
        ...baseManifest,
        web3: {
          mcpServers: [
            {
              url: "https://mcp.anthropic.com/eth",
              pinnedHash: "0xabc",
            },
          ],
        },
      },
      [
        {
          name: "SKILL.md",
          code: `This skill uses an MCP server to call eth methods.`,
        },
      ],
    );
    const findings = checkMcpChainTools(skill);
    const hits = findings.filter((f) => f.id.startsWith("W08-010"));
    expect(hits.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// W08-011: untrusted host
// ---------------------------------------------------------------------------
describe("AST-W08: untrusted host", () => {
  test("flags a host that is not on the project-recommended list", () => {
    const skill = mockSkill({
      ...baseManifest,
      web3: {
        mcpServers: [
          {
            url: "https://evil.example.com/mcp",
            pinnedHash: "0xabc",
          },
        ],
      },
    });
    const findings = checkMcpChainTools(skill);
    const hits = findings.filter((f) => f.id.startsWith("W08-011"));
    expect(hits.length).toBe(1);
    expect(hits[0].severity).toBe("low");
  });

  test("accepts wildcard-matched hosts (e.g. *.coinbase.com)", () => {
    const skill = mockSkill({
      ...baseManifest,
      web3: {
        mcpServers: [
          {
            url: "https://api.coinbase.com/mcp",
            pinnedHash: "0xabc",
          },
          {
            url: "https://snap.metamask.io/mcp",
            pinnedHash: "0xdef",
          },
          {
            url: "https://localhost/mcp",
            pinnedHash: "0xfed",
          },
        ],
      },
    });
    const findings = checkMcpChainTools(skill);
    const hits = findings.filter((f) => f.id.startsWith("W08-011"));
    expect(hits.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Cross-cutting: clean skills, finding shape
// ---------------------------------------------------------------------------
describe("AST-W08: clean skill and finding shape", () => {
  test("a skill with a properly pinned, recognised, allow-listed server has no findings", () => {
    const skill = mockSkill(
      {
        ...baseManifest,
        requires: { tools: ["eth_sendTransaction"] },
        web3: {
          mcpServers: [
            {
              url: "https://mcp.anthropic.com/eth",
              pinnedHash: "0xabc",
            },
          ],
        },
      },
      [
        {
          name: "index.ts",
          code: `await client.call("eth_sendTransaction", payload);`,
        },
      ],
    );
    const findings = checkMcpChainTools(skill);
    expect(findings.length).toBe(0);
  });

  test("findings use the AST-W08 rule, category, and an id with a -N counter suffix", () => {
    const skill = mockSkill({
      ...baseManifest,
      web3: {
        mcpServers: [{ url: "https://evil.example.com/mcp" }],
      },
    });
    const findings = checkMcpChainTools(skill);
    expect(findings.length).toBeGreaterThanOrEqual(1);
    for (const f of findings) {
      expect(f.rule).toBe("web3-mcp-chain-drift");
      expect(f.category).toBe("web3-mcp-chain-drift");
      expect(f.id).toMatch(/^W08-\d{3}-\d+$/);
      expect(typeof f.title).toBe("string");
      expect(typeof f.description).toBe("string");
      expect(typeof f.remediation).toBe("string");
    }
    const ids = findings.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
