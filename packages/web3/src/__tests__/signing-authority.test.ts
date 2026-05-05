import { describe, expect, test } from "bun:test";
import type { AgentSkill, SkillManifest, Web3ManifestBlock } from "@agentsec/shared";
import { checkSigningAuthority } from "../rules/signing-authority";

interface MockFile {
  name: string;
  content: string;
}

function mockSkill(
  manifestOverride: Partial<SkillManifest> = {},
  files: MockFile[] = [],
): AgentSkill {
  return {
    id: "test-skill",
    name: "Test Skill",
    version: "1.0.0",
    path: "/tmp/test-skill",
    platform: "openclaw",
    manifest: {
      name: "test-skill",
      version: "1.0.0",
      description: "A test skill",
      ...manifestOverride,
    },
    files: files.map((f) => ({
      path: `/tmp/test-skill/${f.name}`,
      relativePath: f.name,
      content: f.content,
      language: f.name.endsWith(".md") ? "markdown" : "typescript",
      size: f.content.length,
    })),
  };
}

const FULLY_SCOPED_POLICY: Web3ManifestBlock = {
  signers: ["hot"],
  chains: [1],
  policy: {
    maxValuePerTx: "1000000000000000000",
    allowedContracts: ["0x000000000022D473030F116dDEE9F6B43aC78BA3"],
    allowedChains: [1],
    dailyCap: "10000000000000000000",
  },
};

describe("AST-W01: hot signer manifest gates", () => {
  test("W01-001 fires when hot signer has no maxValuePerTx", () => {
    const skill = mockSkill({
      web3: {
        signers: ["hot"],
        chains: [1],
        policy: {
          allowedContracts: ["0xabc"],
          allowedChains: [1],
          dailyCap: "1",
        },
      },
    });
    const findings = checkSigningAuthority(skill);
    const hits = findings.filter((f) => f.id.startsWith("W01-001"));
    expect(hits.length).toBe(1);
    expect(hits[0].severity).toBe("critical");
    expect(hits[0].rule).toBe("web3-signing-authority");
    expect(hits[0].category).toBe("web3-signing-authority");
    expect(hits[0].file).toBeUndefined();
  });

  test("W01-002 fires when hot signer has no allowedContracts", () => {
    const skill = mockSkill({
      web3: {
        signers: ["hot"],
        chains: [1],
        policy: {
          maxValuePerTx: "1",
          allowedChains: [1],
          dailyCap: "1",
        },
      },
    });
    const findings = checkSigningAuthority(skill);
    const hits = findings.filter((f) => f.id.startsWith("W01-002"));
    expect(hits.length).toBe(1);
    expect(hits[0].severity).toBe("high");
  });

  test("W01-002 fires when allowedContracts is an empty array", () => {
    const skill = mockSkill({
      web3: {
        signers: ["hot"],
        chains: [1],
        policy: {
          maxValuePerTx: "1",
          allowedContracts: [],
          allowedChains: [1],
          dailyCap: "1",
        },
      },
    });
    const findings = checkSigningAuthority(skill);
    expect(findings.filter((f) => f.id.startsWith("W01-002")).length).toBe(1);
  });

  test("W01-003 fires when hot signer has no chain restriction at all", () => {
    const skill = mockSkill({
      web3: {
        signers: ["hot"],
        policy: {
          maxValuePerTx: "1",
          allowedContracts: ["0xabc"],
          dailyCap: "1",
        },
      },
    });
    const findings = checkSigningAuthority(skill);
    const hits = findings.filter((f) => f.id.startsWith("W01-003"));
    expect(hits.length).toBe(1);
    expect(hits[0].severity).toBe("high");
  });

  test("W01-003 does not fire when web3.chains is set even without policy.allowedChains", () => {
    const skill = mockSkill({
      web3: {
        signers: ["hot"],
        chains: [1, 8453],
        policy: {
          maxValuePerTx: "1",
          allowedContracts: ["0xabc"],
          dailyCap: "1",
        },
      },
    });
    const findings = checkSigningAuthority(skill);
    expect(findings.filter((f) => f.id.startsWith("W01-003")).length).toBe(0);
  });

  test("W01-004 fires when hot signer has no dailyCap", () => {
    const skill = mockSkill({
      web3: {
        signers: ["hot"],
        chains: [1],
        policy: {
          maxValuePerTx: "1",
          allowedContracts: ["0xabc"],
          allowedChains: [1],
        },
      },
    });
    const findings = checkSigningAuthority(skill);
    const hits = findings.filter((f) => f.id.startsWith("W01-004"));
    expect(hits.length).toBe(1);
    expect(hits[0].severity).toBe("medium");
  });

  test("fully scoped hot signer manifest produces no W01-00x findings", () => {
    const skill = mockSkill({ web3: FULLY_SCOPED_POLICY });
    const findings = checkSigningAuthority(skill);
    const manifestFindings = findings.filter((f) =>
      ["W01-001", "W01-002", "W01-003", "W01-004"].some((p) => f.id.startsWith(p)),
    );
    expect(manifestFindings.length).toBe(0);
  });

  test("non-hot signer (session-only) skips W01-00x manifest checks", () => {
    const skill = mockSkill({
      web3: {
        signers: ["session"],
        sessionKey: { expiry: 3600 },
      },
    });
    const findings = checkSigningAuthority(skill);
    expect(findings.length).toBe(0);
  });
});

describe("AST-W01: code-level signing primitive without manifest", () => {
  test("W01-010 fires for eth_sendTransaction with no web3 block", () => {
    const skill = mockSkill({}, [
      {
        name: "send.ts",
        content: `await provider.request({ method: "eth_sendTransaction", params: [tx] });`,
      },
    ]);
    const findings = checkSigningAuthority(skill);
    const hits = findings.filter((f) => f.id.startsWith("W01-010"));
    expect(hits.length).toBeGreaterThanOrEqual(1);
    expect(hits[0].severity).toBe("high");
    expect(hits[0].file).toBe("send.ts");
    expect(hits[0].line).toBe(1);
    expect(hits[0].evidence).toContain("eth_sendTransaction");
  });

  test("W01-010 fires for .signTransaction call with no web3 block", () => {
    const skill = mockSkill({}, [
      {
        name: "sign.ts",
        content: `const raw = await wallet.signTransaction(tx);`,
      },
    ]);
    const findings = checkSigningAuthority(skill);
    expect(findings.filter((f) => f.id.startsWith("W01-010")).length).toBeGreaterThanOrEqual(1);
  });

  test("W01-010 ignores signing primitives that appear inside comments", () => {
    const skill = mockSkill({}, [
      {
        name: "doc.ts",
        content: `// Avoid eth_sendTransaction directly\nconst x = 1;\n`,
      },
    ]);
    const findings = checkSigningAuthority(skill);
    expect(findings.filter((f) => f.id.startsWith("W01-010")).length).toBe(0);
  });

  test("W01-010 does NOT fire when a web3 manifest block is declared", () => {
    const skill = mockSkill({ web3: FULLY_SCOPED_POLICY }, [
      {
        name: "send.ts",
        content: `await provider.request({ method: "eth_sendTransaction", params: [tx] });`,
      },
    ]);
    const findings = checkSigningAuthority(skill);
    expect(findings.filter((f) => f.id.startsWith("W01-010")).length).toBe(0);
  });
});

describe("AST-W01: autonomous-trader prose without session key", () => {
  test("W01-020 fires when SKILL.md describes autonomous trading without sessionKey.expiry", () => {
    const skill = mockSkill({}, [
      {
        name: "SKILL.md",
        content:
          "# DeFi Bot\n\nThis skill will trade ETH for you automatically based on market signals.",
      },
    ]);
    const findings = checkSigningAuthority(skill);
    const hits = findings.filter((f) => f.id.startsWith("W01-020"));
    expect(hits.length).toBe(1);
    expect(hits[0].severity).toBe("medium");
    expect(hits[0].file).toBe("SKILL.md");
  });

  test("W01-020 fires for 'rebalance ... autonomous' phrasing", () => {
    const skill = mockSkill({}, [
      {
        name: "SKILL.md",
        content: "An autonomous agent that will rebalance your portfolio every hour.",
      },
    ]);
    const findings = checkSigningAuthority(skill);
    expect(findings.filter((f) => f.id.startsWith("W01-020")).length).toBe(1);
  });

  test("W01-020 does NOT fire when sessionKey.expiry is set", () => {
    const skill = mockSkill(
      {
        web3: {
          signers: ["session"],
          sessionKey: { expiry: 1700000000 },
        },
      },
      [
        {
          name: "SKILL.md",
          content: "This skill will swap tokens for you automatically.",
        },
      ],
    );
    const findings = checkSigningAuthority(skill);
    expect(findings.filter((f) => f.id.startsWith("W01-020")).length).toBe(0);
  });

  test("W01-020 does NOT fire when prose lacks an autonomy qualifier", () => {
    const skill = mockSkill({}, [
      {
        name: "SKILL.md",
        content: "This skill helps you trade tokens by drafting a transaction you confirm.",
      },
    ]);
    const findings = checkSigningAuthority(skill);
    expect(findings.filter((f) => f.id.startsWith("W01-020")).length).toBe(0);
  });
});

describe("AST-W01: finding structure and id uniqueness", () => {
  test("every finding carries the canonical rule and category", () => {
    const skill = mockSkill({ web3: { signers: ["hot"] } }, [
      { name: "SKILL.md", content: "We will execute trades for you autonomously." },
    ]);
    const findings = checkSigningAuthority(skill);
    expect(findings.length).toBeGreaterThan(0);
    for (const f of findings) {
      expect(f.rule).toBe("web3-signing-authority");
      expect(f.category).toBe("web3-signing-authority");
      expect(typeof f.title).toBe("string");
      expect(typeof f.description).toBe("string");
      expect(typeof f.remediation).toBe("string");
    }
    const ids = findings.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
