import { describe, expect, test } from "bun:test";
import type { AgentSkill, SkillManifest } from "@agentsec/shared";
import { checkRpc } from "../rules/rpc";

function mockSkill(
  files: { name: string; code: string }[],
  manifest: Partial<SkillManifest> = {},
): AgentSkill {
  return {
    id: "rpc-test",
    name: "RPC Test",
    version: "1.0.0",
    path: "/tmp/rpc-test",
    platform: "openclaw",
    manifest: {
      name: "rpc-test",
      version: "1.0.0",
      ...manifest,
    },
    files: files.map((f) => ({
      path: `/tmp/rpc-test/${f.name}`,
      relativePath: f.name,
      content: f.code,
      language: "typescript",
      size: f.code.length,
    })),
  };
}

describe("AST-W05: hardcoded RPC URL with embedded API key", () => {
  test("flags an Alchemy URL with an embedded key as high severity", () => {
    const skill = mockSkill([
      {
        name: "client.ts",
        code: 'const url = "https://eth-mainnet.g.alchemy.com/v2/abcdef0123456789ABCDEF01";',
      },
    ]);
    const findings = checkRpc(skill);
    const w001 = findings.filter((f) => f.id.startsWith("W05-001"));
    expect(w001.length).toBe(1);
    expect(w001[0].severity).toBe("high");
    expect(w001[0].rule).toBe("web3-rpc-substitution");
    expect(w001[0].category).toBe("web3-rpc-substitution");
    expect(w001[0].file).toBe("client.ts");
    expect(w001[0].line).toBe(1);
  });

  test("flags an Infura URL with an embedded project key", () => {
    const skill = mockSkill([
      {
        name: "rpc.ts",
        code: 'const u = "https://mainnet.infura.io/v3/AAAAAAAAAAAAAAAAAAAAAAAA";',
      },
    ]);
    const findings = checkRpc(skill);
    const w001 = findings.filter((f) => f.id.startsWith("W05-001"));
    expect(w001.length).toBe(1);
    expect(w001[0].severity).toBe("high");
  });
});

describe("AST-W05: hardcoded RPC URL not on protected-RPC allowlist", () => {
  test("flags a hardcoded provider URL without an embedded key as low (substitution-attack target)", () => {
    const skill = mockSkill([
      {
        name: "client.ts",
        code: 'const u = "https://rpc.ankr.com/eth";',
      },
    ]);
    const findings = checkRpc(skill);
    const w002 = findings.filter((f) => f.id.startsWith("W05-002"));
    expect(w002.length).toBe(1);
    // Downgraded from medium to low: read-only RPC use against Alchemy/Infura
    // is normal. The high-severity broadcast-against-public-mempool case is
    // covered by W05-003 separately.
    expect(w002[0].severity).toBe("low");
  });

  test("does NOT flag protected RPC URLs (Flashbots, MEV Blocker)", () => {
    const skill = mockSkill([
      {
        name: "client.ts",
        code: 'const a = "https://rpc.flashbots.net/fast"; const b = "https://rpc.mevblocker.io";',
      },
    ]);
    const findings = checkRpc(skill);
    const hardcodedFindings = findings.filter(
      (f) => f.id.startsWith("W05-001") || f.id.startsWith("W05-002"),
    );
    expect(hardcodedFindings.length).toBe(0);
  });

  test("ignores URLs in line comments", () => {
    const skill = mockSkill([
      {
        name: "client.ts",
        code: "// see https://rpc.ankr.com/eth for docs\nconst x = 1;",
      },
    ]);
    const findings = checkRpc(skill);
    const w002 = findings.filter((f) => f.id.startsWith("W05-002"));
    expect(w002.length).toBe(0);
  });
});

describe("AST-W05: public-mempool broadcast", () => {
  test("flags eth_sendRawTransaction with no protected RPC anywhere", () => {
    const skill = mockSkill([
      {
        name: "broadcast.ts",
        code: 'await provider.send("eth_sendRawTransaction", [signed]);',
      },
    ]);
    const findings = checkRpc(skill);
    const w003 = findings.filter((f) => f.id.startsWith("W05-003"));
    expect(w003.length).toBe(1);
    expect(w003[0].severity).toBe("high");
    expect(w003[0].title).toContain("sandwich");
  });

  test("flags .sendRawTransaction( method call", () => {
    const skill = mockSkill([
      {
        name: "broadcast.ts",
        code: "await wallet.sendRawTransaction(serialized);",
      },
    ]);
    const findings = checkRpc(skill);
    const w003 = findings.filter((f) => f.id.startsWith("W05-003"));
    expect(w003.length).toBe(1);
  });

  test("does NOT flag when a protected RPC reference exists in another file", () => {
    const skill = mockSkill([
      {
        name: "broadcast.ts",
        code: "await wallet.sendRawTransaction(serialized);",
      },
      {
        name: "rpc.ts",
        code: 'export const RPC = "https://rpc.flashbots.net/fast";',
      },
    ]);
    const findings = checkRpc(skill);
    const w003 = findings.filter((f) => f.id.startsWith("W05-003"));
    expect(w003.length).toBe(0);
  });
});

describe("AST-W05: env-based RPC without chainId integrity check", () => {
  test("flags process.env.RPC_URL with no chainId cross-check", () => {
    const skill = mockSkill([
      {
        name: "client.ts",
        code: "const rpc = process.env.RPC_URL;\nconst provider = new JsonRpcProvider(rpc);",
      },
    ]);
    const findings = checkRpc(skill);
    const w004 = findings.filter((f) => f.id.startsWith("W05-004"));
    expect(w004.length).toBe(1);
    expect(w004[0].severity).toBe("medium");
  });

  test("flags process.env.MAINNET_RPC pattern", () => {
    const skill = mockSkill([
      {
        name: "client.ts",
        code: "const rpc = process.env.MAINNET_RPC_URL;",
      },
    ]);
    const findings = checkRpc(skill);
    const w004 = findings.filter((f) => f.id.startsWith("W05-004"));
    expect(w004.length).toBe(1);
  });

  test("does NOT flag when an eth_chainId / getNetwork check is present", () => {
    const skill = mockSkill([
      {
        name: "client.ts",
        code: "const rpc = process.env.RPC_URL;\nconst net = await provider.getNetwork();\nif (net.chainId !== 1n) throw new Error('wrong net');",
      },
    ]);
    const findings = checkRpc(skill);
    const w004 = findings.filter((f) => f.id.startsWith("W05-004"));
    expect(w004.length).toBe(0);
  });
});

describe("AST-W05: manifest chains without rpcRegistry", () => {
  test("flags web3.chains declared but rpcRegistry missing as low", () => {
    const skill = mockSkill([{ name: "noop.ts", code: "export const x = 1;" }], {
      web3: { chains: [1, 8453] },
    });
    const findings = checkRpc(skill);
    const w010 = findings.filter((f) => f.id.startsWith("W05-010"));
    expect(w010.length).toBe(1);
    expect(w010[0].severity).toBe("low");
  });

  test("does NOT flag when rpcRegistry is declared", () => {
    const skill = mockSkill([{ name: "noop.ts", code: "export const x = 1;" }], {
      web3: { chains: [1], rpcRegistry: "https://registry.example.com/rpc.json" },
    });
    const findings = checkRpc(skill);
    const w010 = findings.filter((f) => f.id.startsWith("W05-010"));
    expect(w010.length).toBe(0);
  });
});

describe("AST-W05: multi-provider sprawl", () => {
  test("flags >2 distinct providers in one file with no registry as low", () => {
    const skill = mockSkill([
      {
        name: "providers.ts",
        code: [
          'const a = "https://rpc.ankr.com/eth";',
          'const b = "https://eth.llamarpc.com";',
          'const c = "https://eth.drpc.org";',
        ].join("\n"),
      },
    ]);
    const findings = checkRpc(skill);
    const w011 = findings.filter((f) => f.id.startsWith("W05-011"));
    expect(w011.length).toBe(1);
    expect(w011[0].severity).toBe("low");
  });

  test("does NOT flag sprawl when manifest.web3.rpcRegistry is set", () => {
    const skill = mockSkill(
      [
        {
          name: "providers.ts",
          code: [
            'const a = "https://rpc.ankr.com/eth";',
            'const b = "https://eth.llamarpc.com";',
            'const c = "https://eth.drpc.org";',
          ].join("\n"),
        },
      ],
      { web3: { rpcRegistry: "https://registry.example.com/rpc.json" } },
    );
    const findings = checkRpc(skill);
    const w011 = findings.filter((f) => f.id.startsWith("W05-011"));
    expect(w011.length).toBe(0);
  });
});

describe("AST-W05: finding structure and clean skills", () => {
  test("clean skill with no web3 manifest and no RPC code produces no findings", () => {
    const skill = mockSkill([
      { name: "utils.ts", code: "export const add = (a: number, b: number) => a + b;" },
    ]);
    const findings = checkRpc(skill);
    expect(findings.length).toBe(0);
  });

  test("every finding carries the correct rule, category, and a unique id", () => {
    const skill = mockSkill(
      [
        {
          name: "client.ts",
          code: [
            'const a = "https://eth-mainnet.g.alchemy.com/v2/abcdef0123456789ABCDEF01";',
            'const b = "https://rpc.ankr.com/eth";',
            "const env = process.env.RPC_URL;",
            "await wallet.sendRawTransaction(tx);",
          ].join("\n"),
        },
      ],
      { web3: { chains: [1] } },
    );
    const findings = checkRpc(skill);
    expect(findings.length).toBeGreaterThanOrEqual(4);
    const ids = findings.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const f of findings) {
      expect(f.rule).toBe("web3-rpc-substitution");
      expect(f.category).toBe("web3-rpc-substitution");
      expect(f.title.length).toBeGreaterThan(0);
      expect(f.description.length).toBeGreaterThan(0);
      expect(f.remediation).toBeDefined();
    }
  });
});
