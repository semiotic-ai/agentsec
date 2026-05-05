/**
 * E2E tests for the AST-10 Web3 Annex (`@agentsec/web3`).
 *
 * Walks the fixtures under e2e/fixtures/web3, runs the scanner with
 * `WEB3_RULES` merged in, and asserts that each vuln fixture surfaces the
 * expected AST-W rule and that the good fixture surfaces none.
 *
 * Unlike the VM-backed audit.test.ts these tests run entirely in-process
 * — no Lume / SSH dependency, no network. Suitable for CI on every push.
 */

import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import { SkillDiscovery } from "@agentsec/openclaw";
import { Scanner } from "@agentsec/scanner";
import type { AgentSkill, SecurityFinding } from "@agentsec/shared";
import { detectWeb3, WEB3_RULES } from "@agentsec/web3";

const FIXTURES_ROOT = resolve(import.meta.dir, "fixtures/web3");

interface VulnExpectation {
  fixture: string;
  rule: string;
  expectedFindingPrefixes: string[];
}

const VULN_EXPECTATIONS: VulnExpectation[] = [
  {
    fixture: "w01-signing-vuln-skill",
    rule: "web3-signing-authority",
    expectedFindingPrefixes: ["W01-001", "W01-002"],
  },
  {
    fixture: "w02-permit2-vuln-skill",
    rule: "web3-permit-capture",
    expectedFindingPrefixes: ["W02-001"],
  },
  {
    fixture: "w03-7702-vuln-skill",
    rule: "web3-eip7702-delegation",
    expectedFindingPrefixes: ["W03-001"],
  },
  {
    fixture: "w04-blindsigning-vuln-skill",
    rule: "web3-blind-signing",
    expectedFindingPrefixes: ["W04-001"],
  },
  {
    fixture: "w05-rpc-vuln-skill",
    rule: "web3-rpc-substitution",
    expectedFindingPrefixes: ["W05-001"],
  },
  {
    fixture: "w06-targets-vuln-skill",
    rule: "web3-contract-targets",
    expectedFindingPrefixes: ["W06-003"],
  },
  {
    fixture: "w07-bridge-vuln-skill",
    rule: "web3-bridge-replay",
    expectedFindingPrefixes: ["W07-001"],
  },
  {
    fixture: "w08-mcp-vuln-skill",
    rule: "web3-mcp-chain-drift",
    expectedFindingPrefixes: ["W08-001"],
  },
  {
    fixture: "w09-session-vuln-skill",
    rule: "web3-session-key-erosion",
    expectedFindingPrefixes: ["W09-001"],
  },
  {
    fixture: "w10-oracle-vuln-skill",
    rule: "web3-oracle-manipulation",
    expectedFindingPrefixes: ["W10-003"],
  },
  {
    fixture: "w11-keys-vuln-skill",
    rule: "web3-key-material-leak",
    expectedFindingPrefixes: ["W11-001", "W11-003"],
  },
  {
    fixture: "w12-audit-vuln-skill",
    rule: "web3-no-audit-killswitch",
    expectedFindingPrefixes: ["W12-001", "W12-002"],
  },
];

async function loadFixture(name: string): Promise<AgentSkill> {
  const discovery = new SkillDiscovery();
  const skill = await discovery.parseSkill(resolve(FIXTURES_ROOT, name));
  if (!skill) throw new Error(`Could not parse fixture skill: ${name}`);
  return skill;
}

async function scanWithWeb3Profile(skill: AgentSkill): Promise<SecurityFinding[]> {
  const scanner = new Scanner({ extraRules: WEB3_RULES });
  return await scanner.scan(skill);
}

describe("AST-10 Web3 Annex E2E", () => {
  describe("vuln fixtures", () => {
    for (const exp of VULN_EXPECTATIONS) {
      test(`${exp.fixture} surfaces ${exp.rule} findings`, async () => {
        const skill = await loadFixture(exp.fixture);
        const findings = await scanWithWeb3Profile(skill);

        const ruleFindings = findings.filter((f) => f.rule === exp.rule);
        expect(ruleFindings.length).toBeGreaterThan(0);

        for (const prefix of exp.expectedFindingPrefixes) {
          const matched = ruleFindings.some((f) => f.id.startsWith(prefix));
          if (!matched) {
            const ids = ruleFindings.map((f) => f.id).join(", ");
            throw new Error(
              `Expected finding id starting with ${prefix} for ${exp.fixture}, got: [${ids}]`,
            );
          }
        }
      });
    }
  });

  describe("good fixture", () => {
    test("good-web3-skill surfaces no critical or high web3 findings", async () => {
      const skill = await loadFixture("good-web3-skill");
      const findings = await scanWithWeb3Profile(skill);

      const web3Findings = findings.filter((f) => f.rule.startsWith("web3-"));
      const blockingFindings = web3Findings.filter(
        (f) => f.severity === "critical" || f.severity === "high",
      );

      if (blockingFindings.length > 0) {
        const summary = blockingFindings
          .map((f) => `[${f.severity}] ${f.id} ${f.title}`)
          .join("\n  ");
        throw new Error(
          `good-web3-skill produced ${blockingFindings.length} blocking finding(s):\n  ${summary}`,
        );
      }
      expect(blockingFindings.length).toBe(0);
    });
  });

  describe("profile gating", () => {
    test("default profile skips web3 rules entirely", async () => {
      const skill = await loadFixture("w01-signing-vuln-skill");
      const scanner = new Scanner();
      const findings = await scanner.scan(skill);
      const web3Findings = findings.filter((f) => f.rule.startsWith("web3-"));
      expect(web3Findings.length).toBe(0);
    });

    test("web3 profile produces findings the default profile misses", async () => {
      const skill = await loadFixture("w11-keys-vuln-skill");
      const defaultScanner = new Scanner();
      const web3Scanner = new Scanner({ extraRules: WEB3_RULES });
      const defaultFindings = await defaultScanner.scan(skill);
      const web3Findings = await web3Scanner.scan(skill);
      const defaultWeb3 = defaultFindings.filter((f) => f.rule.startsWith("web3-"));
      const w3Web3 = web3Findings.filter((f) => f.rule.startsWith("web3-"));
      expect(defaultWeb3.length).toBe(0);
      expect(w3Web3.length).toBeGreaterThan(0);
    });
  });

  describe("auto-detection", () => {
    test("every vuln fixture is detected as Web3", async () => {
      for (const exp of VULN_EXPECTATIONS) {
        const skill = await loadFixture(exp.fixture);
        const det = detectWeb3(skill);
        if (!det.isWeb3) {
          throw new Error(
            `${exp.fixture} should detect as Web3 but didn't (confidence=${det.confidence})`,
          );
        }
        expect(det.isWeb3).toBe(true);
        expect(det.signals.length).toBeGreaterThan(0);
      }
    });

    test("good-web3-skill is detected as definite via manifest.web3 block", async () => {
      const skill = await loadFixture("good-web3-skill");
      const det = detectWeb3(skill);
      expect(det.isWeb3).toBe(true);
      expect(det.confidence).toBe("definite");
      expect(det.signals.some((s) => s.includes("web3") && s.includes("block"))).toBe(true);
    });
  });

  describe("WEB3_RULES registry", () => {
    test("contains exactly 12 rules covering AST-W01..W12", () => {
      expect(WEB3_RULES.length).toBe(12);
      const owaspIds = WEB3_RULES.map((r) => r.owaspId).sort();
      expect(owaspIds).toEqual([
        "AST-W01",
        "AST-W02",
        "AST-W03",
        "AST-W04",
        "AST-W05",
        "AST-W06",
        "AST-W07",
        "AST-W08",
        "AST-W09",
        "AST-W10",
        "AST-W11",
        "AST-W12",
      ]);
    });

    test("every rule has a unique category and a runnable check", () => {
      const categories = new Set(WEB3_RULES.map((r) => r.category));
      expect(categories.size).toBe(WEB3_RULES.length);
      for (const rule of WEB3_RULES) {
        expect(typeof rule.run).toBe("function");
      }
    });
  });
});
