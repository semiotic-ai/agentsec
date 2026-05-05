import { describe, expect, test } from "bun:test";
import type { AgentSkill, SkillManifest } from "@agentsec/shared";
import { checkOracleSlippage } from "../rules/oracle-slippage";

function mockSkill(
  code: string,
  filename = "swap.ts",
  manifest: Partial<SkillManifest> = {},
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
      ...manifest,
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

function manifestSkill(manifest: Partial<SkillManifest>): AgentSkill {
  return {
    id: "manifest-skill",
    name: "Manifest Skill",
    version: "1.0.0",
    path: "/tmp/manifest-skill",
    platform: "openclaw",
    manifest: {
      name: "manifest-skill",
      version: "1.0.0",
      ...manifest,
    },
    files: [],
  };
}

describe("AST-W10: quote-then-swap (W10-001)", () => {
  test("flags getReserves followed by swap in the same window", () => {
    const code = `
const reserves = await pair.getReserves();
const out = (amountIn * reserves[1]) / reserves[0];
await router.swapExactTokensForTokens(amountIn, out, path, to, deadline);
`;
    const findings = checkOracleSlippage(mockSkill(code));
    const w001 = findings.filter((f) => f.id.startsWith("W10-001"));
    expect(w001.length).toBeGreaterThanOrEqual(1);
    expect(w001[0].severity).toBe("high");
    expect(w001[0].rule).toBe("web3-oracle-manipulation");
    expect(w001[0].category).toBe("web3-oracle-manipulation");
  });

  test("flags slot0 read immediately followed by exactInputSingle", () => {
    const code = `
const { sqrtPriceX96 } = await pool.slot0();
await router.exactInputSingle({ tokenIn, tokenOut, amountIn, amountOutMinimum: minOut });
`;
    const findings = checkOracleSlippage(mockSkill(code));
    const w001 = findings.filter((f) => f.id.startsWith("W10-001"));
    expect(w001.length).toBeGreaterThanOrEqual(1);
  });

  test("does not flag a getReserves read with no nearby swap", () => {
    const code = `
const reserves = await pair.getReserves();
console.log("price snapshot", reserves);
return reserves;
`;
    const findings = checkOracleSlippage(mockSkill(code));
    const w001 = findings.filter((f) => f.id.startsWith("W10-001"));
    expect(w001.length).toBe(0);
  });
});

describe("AST-W10: missing minOut (W10-002)", () => {
  test("flags swap without amountOutMin argument", () => {
    const code = `
await router.swapExactTokensForTokens(amountIn, 0, path, to, deadline);
`;
    const findings = checkOracleSlippage(mockSkill(code));
    const w002 = findings.filter((f) => f.id.startsWith("W10-002"));
    expect(w002.length).toBeGreaterThanOrEqual(1);
    expect(w002[0].severity).toBe("critical");
  });

  test("does not flag swap when amountOutMin is named in args", () => {
    const code = `
await router.exactInputSingle({
  tokenIn,
  tokenOut,
  fee: 3000,
  recipient,
  amountIn,
  amountOutMinimum: minOut,
  sqrtPriceLimitX96: 0,
});
`;
    const findings = checkOracleSlippage(mockSkill(code));
    const w002 = findings.filter((f) => f.id.startsWith("W10-002"));
    expect(w002.length).toBe(0);
  });
});

describe("AST-W10: slippage literal and model-sourced (W10-003 / W10-004)", () => {
  test("flags numeric literal slippage greater than 5", () => {
    const code = `const config = { slippage: 12 };`;
    const findings = checkOracleSlippage(mockSkill(code));
    const w003 = findings.filter((f) => f.id.startsWith("W10-003"));
    expect(w003.length).toBeGreaterThanOrEqual(1);
    expect(w003[0].severity).toBe("high");
  });

  test("flags string-literal slippage greater than 5", () => {
    const code = `const config = { slippage: "7.5" };`;
    const findings = checkOracleSlippage(mockSkill(code));
    const w003 = findings.filter((f) => f.id.startsWith("W10-003"));
    expect(w003.length).toBeGreaterThanOrEqual(1);
  });

  test("does not flag slippage of 1", () => {
    const code = `const config = { slippage: 1 };`;
    const findings = checkOracleSlippage(mockSkill(code));
    const w003 = findings.filter((f) => f.id.startsWith("W10-003"));
    expect(w003.length).toBe(0);
  });

  test("flags slippage sourced from model response", () => {
    const code = `const config = { slippage: response.slippage };`;
    const findings = checkOracleSlippage(mockSkill(code));
    const w004 = findings.filter((f) => f.id.startsWith("W10-004"));
    expect(w004.length).toBeGreaterThanOrEqual(1);
    expect(w004[0].severity).toBe("medium");
  });

  test("does not flag slippage from policy.config", () => {
    const code = `const config = { slippage: policy.maxSlippage };`;
    const findings = checkOracleSlippage(mockSkill(code));
    const w004 = findings.filter((f) => f.id.startsWith("W10-004"));
    expect(w004.length).toBe(0);
  });
});

describe("AST-W10: deadline drift (W10-005)", () => {
  test("flags deadline with offset of 1800 seconds", () => {
    const code = `await router.swapExactTokensForTokens(amountIn, minOut, path, to, { deadline: now + 1800 });`;
    const findings = checkOracleSlippage(mockSkill(code));
    const w005 = findings.filter((f) => f.id.startsWith("W10-005"));
    expect(w005.length).toBeGreaterThanOrEqual(1);
    expect(w005[0].severity).toBe("medium");
  });

  test("does not flag deadline within the 5-minute window", () => {
    const code = `await router.swap({ deadline: now + 60, amountOutMin: minOut });`;
    const findings = checkOracleSlippage(mockSkill(code));
    const w005 = findings.filter((f) => f.id.startsWith("W10-005"));
    expect(w005.length).toBe(0);
  });
});

describe("AST-W10: swap inside polling loop (W10-006)", () => {
  test("flags swap inside setInterval", () => {
    const code = `
setInterval(async () => {
  await router.swapExactTokensForTokens(amountIn, minOut, path, to, deadline);
}, 5000);
`;
    const findings = checkOracleSlippage(mockSkill(code));
    const w006 = findings.filter((f) => f.id.startsWith("W10-006"));
    expect(w006.length).toBeGreaterThanOrEqual(1);
    expect(w006[0].severity).toBe("medium");
  });

  test("does not flag swap that is not inside setInterval", () => {
    const code = `await router.exactInputSingle({ amountIn, amountOutMinimum: minOut });`;
    const findings = checkOracleSlippage(mockSkill(code));
    const w006 = findings.filter((f) => f.id.startsWith("W10-006"));
    expect(w006.length).toBe(0);
  });
});

describe("AST-W10: manifest signals (W10-010 / W10-011)", () => {
  test("flags trade actions without oracle source", () => {
    const skill = manifestSkill({ actions: ["swap", "rebalance"] });
    const findings = checkOracleSlippage(skill);
    const w010 = findings.filter((f) => f.id.startsWith("W10-010"));
    expect(w010.length).toBeGreaterThanOrEqual(1);
    expect(w010[0].severity).toBe("high");
  });

  test("does not flag trade actions when oracle source is declared", () => {
    const skill = manifestSkill({
      actions: ["swap"],
      web3: { oracle: { source: "chainlink:ETH/USD", type: "chainlink" } },
    });
    const findings = checkOracleSlippage(skill);
    const w010 = findings.filter((f) => f.id.startsWith("W10-010"));
    expect(w010.length).toBe(0);
  });

  test("flags spot oracle declaration", () => {
    const skill = manifestSkill({
      actions: ["swap"],
      web3: { oracle: { source: "uniswap-v3-pool", type: "spot" } },
    });
    const findings = checkOracleSlippage(skill);
    const w011 = findings.filter((f) => f.id.startsWith("W10-011"));
    expect(w011.length).toBeGreaterThanOrEqual(1);
    expect(w011[0].severity).toBe("high");
  });

  test("does not flag manifest with twap oracle and no trade actions", () => {
    const skill = manifestSkill({
      web3: { oracle: { source: "uniswap-v3-twap", type: "twap" } },
    });
    const findings = checkOracleSlippage(skill);
    expect(findings.length).toBe(0);
  });
});

describe("AST-W10: hygiene", () => {
  test("ignores quote-then-swap inside comments", () => {
    const code = `
// const reserves = await pair.getReserves();
// await router.swapExactTokensForTokens(...);
const x = 1;
`;
    const findings = checkOracleSlippage(mockSkill(code));
    expect(findings.length).toBe(0);
  });

  test("every finding has the required shape", () => {
    const code = `
const { sqrtPriceX96 } = await pool.slot0();
await router.swapExactTokensForTokens(amountIn, 0, path, to, now + 3600);
const config = { slippage: 9, tolerance: response.slippage };
setInterval(() => router.swap(amountIn, 0, path, to, deadline), 1000);
`;
    const skill = mockSkill(code, "swap.ts", {
      actions: ["swap"],
      web3: { oracle: { type: "spot" } },
    });
    const findings = checkOracleSlippage(skill);
    expect(findings.length).toBeGreaterThan(0);
    const ids = new Set<string>();
    for (const f of findings) {
      expect(f.rule).toBe("web3-oracle-manipulation");
      expect(f.category).toBe("web3-oracle-manipulation");
      expect(f.id).toMatch(/^W10-\d{3}-\d+$/);
      expect(typeof f.title).toBe("string");
      expect(typeof f.description).toBe("string");
      expect(typeof f.remediation).toBe("string");
      expect(ids.has(f.id)).toBe(false);
      ids.add(f.id);
    }
  });

  test("does not scan unsupported file types", () => {
    const code = `await router.swapExactTokensForTokens(amountIn, 0, path, to, deadline);`;
    const findings = checkOracleSlippage(mockSkill(code, "logo.png"));
    expect(findings.length).toBe(0);
  });
});
