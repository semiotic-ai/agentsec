import { describe, expect, test } from "bun:test";
import type { AgentSkill, SkillManifest } from "@agentsec/shared";
import { checkKeyMaterial } from "../rules/key-material";

/** Build a single-file skill fixture for code-style assertions. */
function mockSkill(code: string, filename = "index.ts", manifest?: SkillManifest): AgentSkill {
  return {
    id: "test-skill",
    name: "Test Skill",
    version: "1.0.0",
    path: "/tmp/test-skill",
    platform: "openclaw",
    manifest: manifest ?? {
      name: "test-skill",
      version: "1.0.0",
    },
    files: [
      {
        path: `/tmp/test-skill/${filename}`,
        relativePath: filename,
        content: code,
        language: "typescript",
        size: code.length,
      },
    ],
  };
}

/** Build a manifest-only skill for AST-W11-030 assertions. */
function mockManifestSkill(manifest: SkillManifest): AgentSkill {
  return {
    id: "manifest-only",
    name: "Manifest Only",
    version: "1.0.0",
    path: "/tmp/manifest-only",
    platform: "openclaw",
    manifest,
    files: [],
  };
}

const HEX_64 = "a".repeat(63) + "b"; // 64 hex chars, not all-same so not the 0xff... constant

describe("AST-W11: const PRIVATE_KEY assignment (W11-003)", () => {
  test('flags `const PRIVATE_KEY = "0x..."` as critical', () => {
    const skill = mockSkill(`const PRIVATE_KEY = "0x${HEX_64}";`);
    const findings = checkKeyMaterial(skill);
    const hits = findings.filter((f) => f.id.startsWith("W11-003"));
    expect(hits.length).toBe(1);
    expect(hits[0].severity).toBe("critical");
    expect(hits[0].rule).toBe("web3-key-material-leak");
    expect(hits[0].category).toBe("web3-key-material-leak");
    expect(hits[0].file).toBe("index.ts");
  });

  test("flags MNEMONIC_KEY-named const as critical (W11-003)", () => {
    const skill = mockSkill(`let WALLET_SECRET_KEY = "${HEX_64}";`);
    const findings = checkKeyMaterial(skill);
    expect(findings.some((f) => f.id.startsWith("W11-003"))).toBe(true);
  });
});

describe("AST-W11: hex on log lines (W11-001)", () => {
  test("flags console.log with raw 64-char hex as critical", () => {
    const skill = mockSkill(`
function debug(key) {
  console.log("loaded key", "${HEX_64}");
}
`);
    const findings = checkKeyMaterial(skill);
    const hits = findings.filter((f) => f.id.startsWith("W11-001"));
    expect(hits.length).toBeGreaterThanOrEqual(1);
    expect(hits[0].severity).toBe("critical");
  });

  test("flags template-literal interpolation containing 64-char hex", () => {
    // biome-ignore lint/suspicious/noTemplateCurlyInString: intentional test fixture
    const skill = mockSkill('const msg = `loaded key ${"' + HEX_64 + '"} from env`;');
    const findings = checkKeyMaterial(skill);
    expect(findings.some((f) => f.id.startsWith("W11-001"))).toBe(true);
  });
});

describe("AST-W11: hex string assignment (W11-002)", () => {
  test("flags plain string assignment to high (not critical)", () => {
    const skill = mockSkill(`const data = "${HEX_64}";`);
    const findings = checkKeyMaterial(skill);
    const hits = findings.filter((f) => f.id.startsWith("W11-002"));
    expect(hits.length).toBe(1);
    expect(hits[0].severity).toBe("high");
  });
});

describe("AST-W11: NEGATIVE — comments and pubkey context", () => {
  test("does NOT flag a 64-char tx hash that lives inside a // comment", () => {
    const skill = mockSkill(
      `// observed tx hash 0x${HEX_64} on mainnet, see explorer\nconst x = 1;\n`,
    );
    const findings = checkKeyMaterial(skill);
    expect(findings.length).toBe(0);
  });

  test("does NOT flag an Ethereum public key referenced near `pubkey`", () => {
    // Uncompressed secp256k1 public keys are 64 bytes hex, but skill code
    // routinely refers to a 32-byte hash representation tagged `pubkey`.
    const skill = mockSkill(`const pubkey = "0x${HEX_64}"; // node identity\n`);
    const findings = checkKeyMaterial(skill);
    expect(findings.length).toBe(0);
  });

  test("does NOT flag a hex value labeled `txHash`", () => {
    const skill = mockSkill(`const txHash = "0x${HEX_64}";\n`);
    const findings = checkKeyMaterial(skill);
    expect(findings.length).toBe(0);
  });
});

describe("AST-W11: BIP-39 mnemonic detection (W11-010)", () => {
  test("flags a 12-word phrase composed of BIP-39 words", () => {
    const phrase =
      "abandon ability able about above absent absorb abstract absurd abuse access accident";
    const skill = mockSkill(`const seed = "${phrase}";`);
    const findings = checkKeyMaterial(skill);
    const hits = findings.filter((f) => f.id.startsWith("W11-010"));
    expect(hits.length).toBe(1);
    expect(hits[0].severity).toBe("critical");
  });

  test("does NOT flag short prose with only a few BIP-39-shaped words", () => {
    // 10 words, only 2 from the common BIP-39 word list — under both gates.
    const skill = mockSkill(
      `const note = "we will resolve the costing and dispatch a small buffer";`,
    );
    const findings = checkKeyMaterial(skill);
    const hits = findings.filter((f) => f.id.startsWith("W11-010"));
    expect(hits.length).toBe(0);
  });
});

describe("AST-W11: process.env secrets in logs (W11-020)", () => {
  test("flags console.log of process.env.PRIVATE_KEY", () => {
    const skill = mockSkill(`console.log("starting with", process.env.PRIVATE_KEY);`);
    const findings = checkKeyMaterial(skill);
    const hits = findings.filter((f) => f.id.startsWith("W11-020"));
    expect(hits.length).toBe(1);
    expect(hits[0].severity).toBe("high");
  });

  test("does NOT flag process.env.PRIVATE_KEY when only assigned to a const", () => {
    const skill = mockSkill(`const pk = process.env.PRIVATE_KEY;`);
    const findings = checkKeyMaterial(skill);
    const hits = findings.filter((f) => f.id.startsWith("W11-020"));
    expect(hits.length).toBe(0);
  });
});

describe("AST-W11: JSON.stringify of signer-ish object (W11-021)", () => {
  test("flags JSON.stringify on object containing privateKey field", () => {
    const skill = mockSkill(`const blob = JSON.stringify({ privateKey: pk, address: addr });`);
    const findings = checkKeyMaterial(skill);
    const hits = findings.filter((f) => f.id.startsWith("W11-021"));
    expect(hits.length).toBe(1);
    expect(hits[0].severity).toBe("high");
  });

  test("flags JSON.stringify on object containing signer field", () => {
    const skill = mockSkill(`logger.error(JSON.stringify({ signer, opts }));`);
    const findings = checkKeyMaterial(skill);
    expect(findings.some((f) => f.id.startsWith("W11-021"))).toBe(true);
  });

  test("does NOT flag JSON.stringify of a benign object", () => {
    const skill = mockSkill(`const j = JSON.stringify({ chainId: 1, value: "0" });`);
    const findings = checkKeyMaterial(skill);
    const hits = findings.filter((f) => f.id.startsWith("W11-021"));
    expect(hits.length).toBe(0);
  });
});

describe("AST-W11: signTransaction near log (W11-040)", () => {
  test("flags signer.signTransaction colocated with console.log of tx", () => {
    const skill = mockSkill(`
const tx = await signer.signTransaction(req);
console.log("signed tx", tx);
`);
    const findings = checkKeyMaterial(skill);
    const hits = findings.filter((f) => f.id.startsWith("W11-040"));
    expect(hits.length).toBe(1);
    expect(hits[0].severity).toBe("high");
  });

  test("does NOT flag signTransaction without a nearby log", () => {
    const skill = mockSkill(`
const tx = await signer.signTransaction(req);
return tx;
`);
    const findings = checkKeyMaterial(skill);
    const hits = findings.filter((f) => f.id.startsWith("W11-040"));
    expect(hits.length).toBe(0);
  });
});

describe("AST-W11: manifest secrets (W11-030)", () => {
  test("flags a secret entry without redactInTrace", () => {
    const skill = mockManifestSkill({
      name: "x",
      version: "1.0.0",
      // biome-ignore lint/suspicious/noExplicitAny: passthrough manifest field
      secrets: [{ name: "PRIVATE_KEY" }] as any,
    } as SkillManifest);
    const findings = checkKeyMaterial(skill);
    const hits = findings.filter((f) => f.id.startsWith("W11-030"));
    expect(hits.length).toBe(1);
    expect(hits[0].severity).toBe("medium");
    expect(hits[0].title).toContain("PRIVATE_KEY");
  });

  test("does NOT flag a secret entry that has redactInTrace: true", () => {
    const skill = mockManifestSkill({
      name: "x",
      version: "1.0.0",
      // biome-ignore lint/suspicious/noExplicitAny: passthrough manifest field
      secrets: [{ name: "PRIVATE_KEY", redactInTrace: true }] as any,
    } as SkillManifest);
    const findings = checkKeyMaterial(skill);
    const hits = findings.filter((f) => f.id.startsWith("W11-030"));
    expect(hits.length).toBe(0);
  });
});

describe("AST-W11: finding structure & ids", () => {
  test("every finding has the right rule, category, and unique id", () => {
    const skill = mockSkill(`
const PRIVATE_KEY = "0x${HEX_64}";
console.log("got", "${HEX_64}");
const data = "${HEX_64.slice(0, 32)}${HEX_64.slice(0, 32)}";
`);
    const findings = checkKeyMaterial(skill);
    expect(findings.length).toBeGreaterThanOrEqual(1);
    const ids = new Set<string>();
    for (const f of findings) {
      expect(f.rule).toBe("web3-key-material-leak");
      expect(f.category).toBe("web3-key-material-leak");
      expect(f.id).toMatch(/^W11-\d{3}-\d+$/);
      expect(ids.has(f.id)).toBe(false);
      ids.add(f.id);
    }
  });
});
