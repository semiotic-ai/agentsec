import { describe, expect, test } from "bun:test";
import type { AgentSkill, SkillManifest } from "@agentsec/shared";
import { checkConfirmationSkip } from "../rules/confirmation-skip";

interface MockFile {
  name: string;
  content: string;
}

function mockSkill(
  manifestOverride: Partial<SkillManifest> = {},
  files: MockFile[] = [],
): AgentSkill {
  const manifest: SkillManifest = {
    name: "test-skill",
    version: "1.0.0",
    description: "A test skill",
    ...manifestOverride,
  };
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
      content: f.content,
      language: f.name.endsWith(".md") ? "markdown" : "typescript",
      size: f.content.length,
    })),
  };
}

describe("AST-W12 sub-rule: explicit user-confirmation bypass", () => {
  test("fires on a skill named *-fast", () => {
    const skill = mockSkill({ name: "swap-execute-fast" });
    const findings = checkConfirmationSkip(skill);
    const hits = findings.filter((f) => f.id.startsWith("W12-040"));
    expect(hits.length).toBe(1);
    expect(hits[0].severity).toBe("high");
    expect(hits[0].rule).toBe("web3-no-user-confirmation");
    expect(hits[0].category).toBe("web3-no-audit-killswitch");
    expect(hits[0].title).toContain("bypasses user confirmation");
    expect(hits[0].evidence).toContain("swap-execute-fast");
    expect(hits[0].file).toBeUndefined();
  });

  test("fires on multiple *-fast variants (limit-order-fast, zap-fast)", () => {
    for (const name of ["limit-order-fast", "zap-fast", "Swap-Fast"]) {
      const skill = mockSkill({ name });
      const hits = checkConfirmationSkip(skill).filter((f) => f.id.startsWith("W12-040"));
      expect(hits.length).toBe(1);
    }
  });

  test("fires on SKILL.md containing --auto-approve", () => {
    const skill = mockSkill({}, [
      {
        name: "SKILL.md",
        content: "# Swap\n\nUsage: `bun run swap --auto-approve --slippage 0.5`\n",
      },
    ]);
    const findings = checkConfirmationSkip(skill);
    const hits = findings.filter((f) => f.id.startsWith("W12-041"));
    expect(hits.length).toBe(1);
    expect(hits[0].severity).toBe("high");
    expect(hits[0].file).toBe("SKILL.md");
    expect(hits[0].evidence).toContain("--auto-approve");
  });

  test("fires on body containing --no-confirm", () => {
    const skill = mockSkill({}, [
      { name: "SKILL.md", content: "Run with `--no-confirm` to broadcast." },
    ]);
    expect(checkConfirmationSkip(skill).filter((f) => f.id.startsWith("W12-041")).length).toBe(1);
  });

  test("fires on body containing --yes", () => {
    const skill = mockSkill({}, [{ name: "run.sh", content: "swap-cli execute --yes\n" }]);
    expect(checkConfirmationSkip(skill).filter((f) => f.id.startsWith("W12-041")).length).toBe(1);
  });

  test("fires on body containing -y short flag", () => {
    const skill = mockSkill({}, [{ name: "run.sh", content: "swap-cli execute -y\n" }]);
    expect(checkConfirmationSkip(skill).filter((f) => f.id.startsWith("W12-041")).length).toBe(1);
  });

  test("does NOT match -y inside a longer identifier (e.g. 'key', '--dry')", () => {
    const skill = mockSkill({}, [
      { name: "config.ts", content: "const key = '0xabc';\nconst dry = true;\n" },
    ]);
    expect(checkConfirmationSkip(skill).filter((f) => f.id.startsWith("W12-041")).length).toBe(0);
  });

  test("fires on body containing 'skip confirmation'", () => {
    const skill = mockSkill({}, [
      { name: "SKILL.md", content: "The fast path will skip confirmation entirely." },
    ]);
    const hits = checkConfirmationSkip(skill).filter((f) => f.id.startsWith("W12-042"));
    expect(hits.length).toBe(1);
    expect(hits[0].severity).toBe("high");
  });

  test("fires on 'skip user confirmation', 'without confirming', 'broadcast immediately'", () => {
    for (const phrase of [
      "This skill will skip user confirmation.",
      "Sends the tx without confirming with the operator.",
      "We broadcast immediately after signing.",
      "The agent broadcasts without confirmation in production.",
      "Don't prompt before signing.",
      "Do not prompt the user.",
      "This bypasses user review entirely.",
    ]) {
      const skill = mockSkill({}, [{ name: "SKILL.md", content: phrase }]);
      const hits = checkConfirmationSkip(skill).filter((f) => f.id.startsWith("W12-042"));
      expect(hits.length).toBe(1);
    }
  });

  test("downgrades to medium when EXTREMELY DANGEROUS appears in the same body", () => {
    const skill = mockSkill({ name: "swap-fast" }, [
      {
        name: "SKILL.md",
        content:
          "# swap-fast\n\nEXTREMELY DANGEROUS — this skill calls `--auto-approve` and will skip confirmation.",
      },
    ]);
    const findings = checkConfirmationSkip(skill);
    expect(findings.length).toBeGreaterThan(0);
    for (const f of findings) {
      expect(f.severity).toBe("medium");
      expect(f.description).toContain("EXTREMELY DANGEROUS");
    }
  });

  test("downgrades on 'use only after audit' warning", () => {
    const skill = mockSkill({ name: "swap-fast" }, [
      { name: "SKILL.md", content: "swap-fast — use only after audit. Calls --auto-approve." },
    ]);
    const findings = checkConfirmationSkip(skill);
    expect(findings.length).toBeGreaterThan(0);
    for (const f of findings) expect(f.severity).toBe("medium");
  });

  test("downgrades on 'in CI only' warning", () => {
    const skill = mockSkill({ name: "swap-fast" }, [
      { name: "SKILL.md", content: "Intended for use in CI only. Will skip confirmation." },
    ]);
    const findings = checkConfirmationSkip(skill);
    expect(findings.length).toBeGreaterThan(0);
    for (const f of findings) expect(f.severity).toBe("medium");
  });

  test("does NOT fire on a normal swap-execute skill that requires confirmation", () => {
    const skill = mockSkill({ name: "swap-execute" }, [
      {
        name: "SKILL.md",
        content:
          "# swap-execute\n\nDrafts a swap transaction and prompts the user for confirmation before broadcasting.",
      },
    ]);
    expect(checkConfirmationSkip(skill).length).toBe(0);
  });

  test("ignores patterns inside code comments", () => {
    const skill = mockSkill({}, [
      {
        name: "swap.ts",
        content: "// Avoid passing --auto-approve in production\nconst x = 1;\n",
      },
    ]);
    expect(checkConfirmationSkip(skill).length).toBe(0);
  });

  test("does not fire on unscanned binary-like extensions", () => {
    const skill = mockSkill({}, [{ name: "image.png", content: "--auto-approve garbage bytes" }]);
    expect(checkConfirmationSkip(skill).length).toBe(0);
  });

  test("scans plain README (no extension)", () => {
    const skill = mockSkill({}, [
      { name: "README", content: "Run with --auto-approve to skip prompts." },
    ]);
    expect(checkConfirmationSkip(skill).length).toBeGreaterThanOrEqual(1);
  });

  test("every finding carries the canonical rule and category", () => {
    const skill = mockSkill({ name: "swap-fast" }, [
      { name: "SKILL.md", content: "Uses --auto-approve to skip confirmation." },
    ]);
    const findings = checkConfirmationSkip(skill);
    expect(findings.length).toBeGreaterThan(0);
    for (const f of findings) {
      expect(f.rule).toBe("web3-no-user-confirmation");
      expect(f.category).toBe("web3-no-audit-killswitch");
      expect(typeof f.title).toBe("string");
      expect(typeof f.description).toBe("string");
      expect(typeof f.remediation).toBe("string");
    }
    const ids = findings.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("AST-W12 sub-rule: regression — good fixtures", () => {
  test("clean swap skill produces no findings", () => {
    const skill = mockSkill({ name: "scoped-trader" }, [
      {
        name: "SKILL.md",
        content:
          "Bounded automated trading skill. Drafts a swap and asks the operator to approve before signing.",
      },
      {
        name: "src/index.ts",
        content: "export async function swap() { return await signer.signTypedData(payload); }",
      },
    ]);
    expect(checkConfirmationSkip(skill).length).toBe(0);
  });
});
