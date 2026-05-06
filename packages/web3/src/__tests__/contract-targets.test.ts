import { describe, expect, test } from "bun:test";
import type { AgentSkill, SkillFile } from "@agentsec/shared";
import { checkContractTargets } from "../rules/contract-targets";

function mkFile(name: string, code: string): SkillFile {
  return {
    path: `/tmp/test-skill/${name}`,
    relativePath: name,
    content: code,
    language: name.endsWith(".md") ? "markdown" : "typescript",
    size: code.length,
  };
}

function mockSkill(code: string, filename = "index.ts"): AgentSkill {
  return {
    id: "test-skill",
    name: "Test Skill",
    version: "1.0.0",
    path: "/tmp/test-skill",
    platform: "openclaw",
    manifest: { name: "test-skill", version: "1.0.0" },
    files: [mkFile(filename, code)],
  };
}

function mockSkillMulti(files: { name: string; code: string }[]): AgentSkill {
  return {
    id: "multi-skill",
    name: "Multi Skill",
    version: "1.0.0",
    path: "/tmp/multi-skill",
    platform: "openclaw",
    manifest: { name: "multi-skill", version: "1.0.0" },
    files: files.map((f) => mkFile(f.name, f.code)),
  };
}

describe("AST-W06: target derived from model output", () => {
  test("detects to: ${response.address} interpolation", () => {
    // biome-ignore lint/suspicious/noTemplateCurlyInString: intentional fixture
    const skill = mockSkill("const tx = `to: ${response.toAddress}, data: 0x`;");
    const findings = checkContractTargets(skill);
    const w001 = findings.filter((f) => f.id.startsWith("W06-001"));
    expect(w001.length).toBeGreaterThanOrEqual(1);
    expect(w001[0].severity).toBe("high");
    expect(w001[0].rule).toBe("web3-contract-targets");
    expect(w001[0].category).toBe("web3-contract-targets");
  });

  test("detects to = userInput direct assignment", () => {
    const skill = mockSkill(`
const userInput = req.body.target;
const target = { to: "0x0", data: "0x" };
target.to = user;
`);
    const findings = checkContractTargets(skill);
    const w001 = findings.filter((f) => f.id.startsWith("W06-001"));
    expect(w001.length).toBeGreaterThanOrEqual(1);
  });

  test("ignores hardcoded to address", () => {
    const skill = mockSkill(
      'const tx = { to: "0x000000000022D473030F116dDEE9F6B43aC78BA3", data: "0x" };',
    );
    const findings = checkContractTargets(skill);
    expect(findings.filter((f) => f.id.startsWith("W06-001")).length).toBe(0);
  });
});

describe("AST-W06: checksum-naive address compare", () => {
  test("detects toLowerCase() === with hex literal", () => {
    const skill = mockSkill(
      'if (addr.toLowerCase() === "0x000000000022D473030F116dDEE9F6B43aC78BA3".toLowerCase()) {}',
    );
    const findings = checkContractTargets(skill);
    const w002 = findings.filter((f) => f.id.startsWith("W06-002"));
    expect(w002.length).toBeGreaterThanOrEqual(1);
    expect(w002[0].severity).toBe("medium");
  });

  test("ignores toLowerCase compare without address literal", () => {
    const skill = mockSkill('if (name.toLowerCase() === "alice") {}');
    const findings = checkContractTargets(skill);
    expect(findings.filter((f) => f.id.startsWith("W06-002")).length).toBe(0);
  });

  test("ignores getAddress-based compare", () => {
    const skill = mockSkill(
      'import { getAddress } from "viem";\nif (getAddress(a) === getAddress(b)) {}',
    );
    const findings = checkContractTargets(skill);
    expect(findings.filter((f) => f.id.startsWith("W06-002")).length).toBe(0);
  });
});

describe("AST-W06: ENS resolution without reverse-resolution", () => {
  test("flags resolveName without lookupAddress", () => {
    const skill = mockSkill(`
const provider = getProvider();
const addr = await provider.resolveName("vitalik.eth");
sendTo(addr);
`);
    const findings = checkContractTargets(skill);
    const w003 = findings.filter((f) => f.id.startsWith("W06-003"));
    expect(w003.length).toBeGreaterThanOrEqual(1);
    expect(w003[0].severity).toBe("medium");
  });

  test("does not flag resolveName paired with lookupAddress", () => {
    const skill = mockSkill(`
const addr = await provider.resolveName(name);
const back = await provider.lookupAddress(addr);
if (back !== name) throw new Error("ens mismatch");
`);
    const findings = checkContractTargets(skill);
    expect(findings.filter((f) => f.id.startsWith("W06-003")).length).toBe(0);
  });
});

describe("AST-W06: named-protocol call without pinned address", () => {
  test("flags Uniswap reference with no nearby address pin", () => {
    const skill = mockSkill(`
const protocol = "Uniswap";
async function swap() {
  const router = await fetchRouter(protocol);
  return router.swap(args);
}
`);
    const findings = checkContractTargets(skill);
    const w004 = findings.filter((f) => f.id.startsWith("W06-004"));
    expect(w004.length).toBeGreaterThanOrEqual(1);
    expect(w004[0].severity).toBe("medium");
  });

  test("does not flag Permit2 reference when canonical address is pinned nearby", () => {
    const skill = mockSkill(`
const PERMIT2_ADDRESS = "0x000000000022D473030F116dDEE9F6B43aC78BA3";
async function permitTransfer() {
  return Permit2.transferFrom(PERMIT2_ADDRESS, args);
}
`);
    const findings = checkContractTargets(skill);
    expect(findings.filter((f) => f.id.startsWith("W06-004")).length).toBe(0);
  });

  test("flags Multicall3 reference without any address literal nearby", () => {
    const skill = mockSkill(`
async function batch() {
  const mc = clients.Multicall3;
  return mc.aggregate(calls);
}
`);
    const findings = checkContractTargets(skill);
    expect(findings.filter((f) => f.id.startsWith("W06-004")).length).toBeGreaterThanOrEqual(1);
  });
});

describe("AST-W06: address-poisoning surface in markdown", () => {
  test("flags 'recent transactions' phrasing in SKILL.md", () => {
    const skill = mockSkill(
      "# Skill\nThe agent picks addresses from the user's recent transactions to repeat transfers.",
      "SKILL.md",
    );
    const findings = checkContractTargets(skill);
    const w010 = findings.filter((f) => f.id.startsWith("W06-010"));
    expect(w010.length).toBeGreaterThanOrEqual(1);
    expect(w010[0].severity).toBe("medium");
  });

  test("does not flag unrelated md content", () => {
    const skill = mockSkill("# Skill\nThis skill computes prime numbers.", "SKILL.md");
    const findings = checkContractTargets(skill);
    expect(findings.filter((f) => f.id.startsWith("W06-010")).length).toBe(0);
  });
});

describe("AST-W06: tx history extraction without allowlist", () => {
  test("flags getTransactions usage with no allowlist hint", () => {
    const skill = mockSkill(`
const txs = await provider.getTransactions(account);
const target = txs[0].to;
sendTx({ to: target });
`);
    const findings = checkContractTargets(skill);
    const w011 = findings.filter((f) => f.id.startsWith("W06-011"));
    expect(w011.length).toBeGreaterThanOrEqual(1);
    expect(w011[0].severity).toBe("low");
  });

  test("does not flag tx history use when allowlist check is present", () => {
    const skill = mockSkill(`
const allowlist = new Set(["0xabc"]);
const txs = await provider.getTransactions(account);
const target = txs[0].to;
if (!allowlist.has(target)) throw new Error("blocked");
`);
    const findings = checkContractTargets(skill);
    expect(findings.filter((f) => f.id.startsWith("W06-011")).length).toBe(0);
  });
});

describe("AST-W06: finding structure", () => {
  test("every finding has required fields and unique ids", () => {
    const skill = mockSkillMulti([
      // biome-ignore lint/suspicious/noTemplateCurlyInString: intentional fixture
      { name: "a.ts", code: "const t = `to: ${user.target}`;" },
      {
        name: "b.ts",
        code: 'if (a.toLowerCase() === "0x000000000022D473030F116dDEE9F6B43aC78BA3") {}',
      },
      { name: "SKILL.md", code: "Picks addresses from transaction history." },
    ]);
    const findings = checkContractTargets(skill);
    expect(findings.length).toBeGreaterThanOrEqual(3);
    const ids = findings.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const f of findings) {
      expect(f.rule).toBe("web3-contract-targets");
      expect(f.category).toBe("web3-contract-targets");
      expect(f.title).toBeDefined();
      expect(f.description).toBeDefined();
      expect(f.remediation).toBeDefined();
      expect(f.file).toBeDefined();
      expect(f.line).toBeGreaterThanOrEqual(1);
    }
  });

  test("clean code produces no findings", () => {
    const skill = mockSkill(`
import { getAddress } from "viem";
const PERMIT2 = getAddress("0x000000000022D473030F116dDEE9F6B43aC78BA3");
function isPermit2(addr: string): boolean {
  return getAddress(addr) === PERMIT2;
}
`);
    const findings = checkContractTargets(skill);
    expect(findings.length).toBe(0);
  });
});
