import { describe, expect, test } from "bun:test";
import type { AgentSkill } from "@agent-audit/shared";
import { checkInjection } from "../rules/injection";

/**
 * Helper to create a mock AgentSkill with a single file containing
 * the provided code content.
 */
function mockSkill(code: string, filename = "index.ts"): AgentSkill {
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

/** Helper to create a skill with multiple files. */
function mockSkillMultiFile(files: { name: string; code: string }[]): AgentSkill {
  return {
    id: "multi-skill",
    name: "Multi File Skill",
    version: "1.0.0",
    path: "/tmp/multi-skill",
    platform: "openclaw",
    manifest: {
      name: "multi-skill",
      version: "1.0.0",
    },
    files: files.map((f) => ({
      path: `/tmp/multi-skill/${f.name}`,
      relativePath: f.name,
      content: f.code,
      language: "typescript",
      size: f.code.length,
    })),
  };
}

// ---------------------------------------------------------------------------
// eval() detection
// ---------------------------------------------------------------------------
describe("Injection: eval() detection", () => {
  test("detects direct eval() call", () => {
    const skill = mockSkill(`
const result = eval(userInput);
`);
    const findings = checkInjection(skill);
    const evalFindings = findings.filter((f) => f.title.includes("eval()"));
    expect(evalFindings.length).toBeGreaterThanOrEqual(1);
    expect(evalFindings[0].severity).toBe("critical");
    expect(evalFindings[0].rule).toBe("injection");
    expect(evalFindings[0].category).toBe("skill-injection");
  });

  test("detects eval with whitespace before parens", () => {
    const skill = mockSkill(`
const x = eval  ("code");
`);
    const findings = checkInjection(skill);
    const evalFindings = findings.filter((f) => f.id.startsWith("INJ-001"));
    expect(evalFindings.length).toBeGreaterThanOrEqual(1);
  });

  test("detects new Function() constructor", () => {
    const skill = mockSkill(`
const fn = new Function("return " + userInput);
`);
    const findings = checkInjection(skill);
    const fnFindings = findings.filter((f) => f.id.startsWith("INJ-002"));
    expect(fnFindings.length).toBeGreaterThanOrEqual(1);
    expect(fnFindings[0].severity).toBe("critical");
  });

  test("ignores eval in comments", () => {
    const skill = mockSkill(`
// eval(dangerous) - just a comment
const x = 42;
`);
    const findings = checkInjection(skill);
    const evalFindings = findings.filter((f) => f.id.startsWith("INJ-001"));
    expect(evalFindings.length).toBe(0);
  });

  test("ignores eval in block comments", () => {
    const skill = mockSkill(`
/*
  Never use eval() in production code.
*/
const safe = JSON.parse(data);
`);
    const findings = checkInjection(skill);
    const evalFindings = findings.filter((f) => f.id.startsWith("INJ-001"));
    expect(evalFindings.length).toBe(0);
  });

  test("reports correct file and line for eval", () => {
    const skill = mockSkill(`const a = 1;
const b = 2;
const c = eval(something);
`);
    const findings = checkInjection(skill);
    const evalFindings = findings.filter((f) => f.id.startsWith("INJ-001"));
    expect(evalFindings.length).toBeGreaterThanOrEqual(1);
    expect(evalFindings[0].file).toBe("index.ts");
    expect(evalFindings[0].line).toBe(3);
  });

  test("clean code with no eval produces no eval findings", () => {
    const skill = mockSkill(`
const data = JSON.parse(input);
console.log(data);
`);
    const findings = checkInjection(skill);
    const evalFindings = findings.filter((f) => f.id.startsWith("INJ-001"));
    expect(evalFindings.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// exec/spawn detection
// ---------------------------------------------------------------------------
describe("Injection: exec/spawn detection", () => {
  test("detects child_process exec call", () => {
    const skill = mockSkill(`
const { exec } = require("child_process");
exec("ls -la " + userInput);
`);
    const findings = checkInjection(skill);
    const execFindings = findings.filter((f) => f.id.startsWith("INJ-003"));
    expect(execFindings.length).toBeGreaterThanOrEqual(1);
    expect(execFindings[0].severity).toBe("critical");
  });

  test("detects .execSync call", () => {
    const skill = mockSkill(`
const cp = require("child_process");
cp.execSync("rm -rf " + path);
`);
    const findings = checkInjection(skill);
    const execFindings = findings.filter((f) => f.id.startsWith("INJ-003"));
    expect(execFindings.length).toBeGreaterThanOrEqual(1);
  });

  test("detects spawn call", () => {
    const skill = mockSkill(`
import { spawn } from "child_process";
spawn("node", [script]);
`);
    const findings = checkInjection(skill);
    const spawnFindings = findings.filter((f) => f.id.startsWith("INJ-004"));
    expect(spawnFindings.length).toBeGreaterThanOrEqual(1);
    expect(spawnFindings[0].severity).toBe("high");
  });

  test("detects spawnSync call", () => {
    const skill = mockSkill(`
import cp from "child_process";
const result = cp.spawnSync("git", ["status"]);
`);
    const findings = checkInjection(skill);
    const spawnFindings = findings.filter((f) => f.id.startsWith("INJ-004"));
    expect(spawnFindings.length).toBeGreaterThanOrEqual(1);
  });

  test("detects template literal in exec", () => {
    // biome-ignore lint/suspicious/noTemplateCurlyInString: intentional test fixture
    const skill = mockSkill("child_process.exec(`echo ${userInput}`);");
    const findings = checkInjection(skill);
    const templateFindings = findings.filter((f) => f.id.startsWith("INJ-005"));
    expect(templateFindings.length).toBeGreaterThanOrEqual(1);
    expect(templateFindings[0].severity).toBe("critical");
  });
});

// ---------------------------------------------------------------------------
// Template literal injection
// ---------------------------------------------------------------------------
describe("Injection: template literal injection", () => {
  test("detects untrusted variable interpolation in template", () => {
    const skill = mockSkill("`Hello $" + "{input}, welcome!`");
    const findings = checkInjection(skill);
    const templateFindings = findings.filter((f) => f.id.startsWith("INJ-010"));
    expect(templateFindings.length).toBeGreaterThanOrEqual(1);
    expect(templateFindings[0].severity).toBe("high");
  });

  test("detects query variable in template", () => {
    // biome-ignore lint/suspicious/noTemplateCurlyInString: intentional test fixture
    const skill = mockSkill("const sql = `SELECT * FROM users WHERE id = ${query}`;");
    const findings = checkInjection(skill);
    const templateFindings = findings.filter((f) => f.id.startsWith("INJ-010"));
    expect(templateFindings.length).toBeGreaterThanOrEqual(1);
  });

  test("detects template with dynamic replacement", () => {
    // biome-ignore lint/suspicious/noTemplateCurlyInString: intentional test fixture
    const skill = mockSkill("`prefix ${value} suffix`.replace(/pattern/, replacement)");
    const findings = checkInjection(skill);
    const replaceFindings = findings.filter((f) => f.id.startsWith("INJ-011"));
    expect(replaceFindings.length).toBeGreaterThanOrEqual(1);
    expect(replaceFindings[0].severity).toBe("medium");
  });

  test("safe template with static content produces no findings", () => {
    // biome-ignore lint/suspicious/noTemplateCurlyInString: intentional test fixture
    const skill = mockSkill("`Hello ${greeting}, welcome!`");
    const findings = checkInjection(skill);
    // "greeting" is not a known untrusted variable name
    const templateFindings = findings.filter((f) => f.id.startsWith("INJ-010"));
    expect(templateFindings.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Dynamic import detection
// ---------------------------------------------------------------------------
describe("Injection: dynamic import detection", () => {
  test("detects dynamic import with user input", () => {
    const skill = mockSkill(`
const module = await import(input);
`);
    const findings = checkInjection(skill);
    const importFindings = findings.filter((f) => f.id.startsWith("INJ-031"));
    expect(importFindings.length).toBeGreaterThanOrEqual(1);
    expect(importFindings[0].severity).toBe("critical");
  });

  test("detects dynamic require with user input", () => {
    const skill = mockSkill(`
const mod = require(data);
`);
    const findings = checkInjection(skill);
    const requireFindings = findings.filter((f) => f.id.startsWith("INJ-030"));
    expect(requireFindings.length).toBeGreaterThanOrEqual(1);
    expect(requireFindings[0].severity).toBe("critical");
  });

  test("detects vm module usage", () => {
    const skill = mockSkill(`
const vm = require("vm");
vm.runInNewContext(code, sandbox);
`);
    const findings = checkInjection(skill);
    const vmFindings = findings.filter((f) => f.id.startsWith("INJ-032"));
    expect(vmFindings.length).toBeGreaterThanOrEqual(1);
    expect(vmFindings[0].severity).toBe("high");
  });

  test("detects innerHTML assignment", () => {
    const skill = mockSkill(`
element.innerHTML = userContent;
`);
    const findings = checkInjection(skill);
    const htmlFindings = findings.filter((f) => f.id.startsWith("INJ-034"));
    expect(htmlFindings.length).toBeGreaterThanOrEqual(1);
    expect(htmlFindings[0].severity).toBe("high");
  });

  test("detects document.write usage", () => {
    const skill = mockSkill(`
document.write(content);
`);
    const findings = checkInjection(skill);
    const docWriteFindings = findings.filter((f) => f.id.startsWith("INJ-033"));
    expect(docWriteFindings.length).toBeGreaterThanOrEqual(1);
  });

  test("safe static import produces no findings", () => {
    const skill = mockSkill(`
import { helper } from "./utils";
const result = helper(42);
`);
    const findings = checkInjection(skill);
    const importFindings = findings.filter(
      (f) => f.id.startsWith("INJ-030") || f.id.startsWith("INJ-031"),
    );
    expect(importFindings.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// SQL injection patterns
// ---------------------------------------------------------------------------
describe("Injection: SQL injection patterns", () => {
  test("detects SQL query with template literal interpolation", () => {
    // biome-ignore lint/suspicious/noTemplateCurlyInString: intentional test fixture
    const skill = mockSkill("db.query(`SELECT * FROM users WHERE id = ${userId}`);");
    const findings = checkInjection(skill);
    const sqlFindings = findings.filter((f) => f.id.startsWith("INJ-040"));
    expect(sqlFindings.length).toBeGreaterThanOrEqual(1);
    expect(sqlFindings[0].severity).toBe("critical");
  });

  test("detects SQL query with string concatenation", () => {
    const skill = mockSkill(`db.query("SELECT * FROM users WHERE id = " + id);`);
    const findings = checkInjection(skill);
    const sqlFindings = findings.filter((f) => f.id.startsWith("INJ-040"));
    expect(sqlFindings.length).toBeGreaterThanOrEqual(1);
  });

  test("detects NoSQL $where injection pattern", () => {
    const skill = mockSkill(`
collection.find({ $where: "this.name == '" + input + "'" });
`);
    const findings = checkInjection(skill);
    const nosqlFindings = findings.filter((f) => f.id.startsWith("INJ-041"));
    expect(nosqlFindings.length).toBeGreaterThanOrEqual(1);
    expect(nosqlFindings[0].severity).toBe("high");
  });

  test("parameterized query produces no SQL injection findings", () => {
    const skill = mockSkill(`
db.query("SELECT * FROM users WHERE id = ?", [userId]);
`);
    const findings = checkInjection(skill);
    const sqlFindings = findings.filter((f) => f.id.startsWith("INJ-040"));
    expect(sqlFindings.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Prompt injection patterns
// ---------------------------------------------------------------------------
describe("Injection: prompt injection patterns", () => {
  test("detects user input concatenated into prompt", () => {
    const skill = mockSkill(`
const prompt = "You are a helper. " + input;
`);
    const findings = checkInjection(skill);
    const promptFindings = findings.filter(
      (f) => f.id.startsWith("INJ-020") || f.id.startsWith("INJ-021"),
    );
    expect(promptFindings.length).toBeGreaterThanOrEqual(1);
  });

  test("detects system prompt concatenation with request body", () => {
    const skill = mockSkill(`
const system_prompt = baseInstructions + request;
`);
    const findings = checkInjection(skill);
    const promptFindings = findings.filter(
      (f) => f.id.startsWith("INJ-020") || f.id.startsWith("INJ-021"),
    );
    expect(promptFindings.length).toBeGreaterThanOrEqual(1);
    expect(promptFindings.some((f) => f.severity === "critical")).toBe(true);
  });

  test("detects dynamic system message injection", () => {
    const skill = mockSkill(`
messages.push({ role: "system", content: dynamicContent });
`);
    const findings = checkInjection(skill);
    const sysFindings = findings.filter((f) => f.id.startsWith("INJ-022"));
    expect(sysFindings.length).toBeGreaterThanOrEqual(1);
    expect(sysFindings[0].severity).toBe("high");
  });
});

// ---------------------------------------------------------------------------
// Data flow / tainted input tracking
// ---------------------------------------------------------------------------
describe("Injection: data flow taint tracking", () => {
  test("detects tainted input flowing into eval", () => {
    const skill = mockSkill(`
const userCmd = req.body.command;
eval(userCmd);
`);
    const findings = checkInjection(skill);
    // Should find both the eval pattern and the tainted data flow
    const taintFindings = findings.filter((f) => f.id.startsWith("INJ-050"));
    expect(taintFindings.length).toBeGreaterThanOrEqual(1);
    expect(taintFindings[0].severity).toBe("critical");
  });

  test("detects tainted input flowing into query", () => {
    const skill = mockSkill(`
const searchTerm = req.query.search;
db.query("SELECT * FROM items WHERE name = " + searchTerm);
`);
    const findings = checkInjection(skill);
    const taintFindings = findings.filter((f) => f.id.startsWith("INJ-050"));
    expect(taintFindings.length).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// File type filtering
// ---------------------------------------------------------------------------
describe("Injection: file type filtering", () => {
  test("scans .ts files", () => {
    const skill = mockSkill("eval(input);", "handler.ts");
    const findings = checkInjection(skill);
    expect(findings.length).toBeGreaterThanOrEqual(1);
  });

  test("scans .js files", () => {
    const skill = mockSkill("eval(input);", "handler.js");
    const findings = checkInjection(skill);
    expect(findings.length).toBeGreaterThanOrEqual(1);
  });

  test("scans .py files", () => {
    const skill = mockSkill("eval(input)", "handler.py");
    const findings = checkInjection(skill);
    expect(findings.length).toBeGreaterThanOrEqual(1);
  });

  test("does not scan unsupported file types like .png", () => {
    const skill = mockSkill("eval(input)", "image.png");
    const findings = checkInjection(skill);
    expect(findings.length).toBe(0);
  });

  test("does not scan .wasm files", () => {
    const skill = mockSkill("eval(input)", "module.wasm");
    const findings = checkInjection(skill);
    expect(findings.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Multiple files
// ---------------------------------------------------------------------------
describe("Injection: multiple file scanning", () => {
  test("reports findings from all files in a skill", () => {
    const skill = mockSkillMultiFile([
      { name: "a.ts", code: "eval(input);" },
      { name: "b.ts", code: "exec(cmd);" },
    ]);
    const findings = checkInjection(skill);
    const filesWithFindings = new Set(findings.map((f) => f.file));
    expect(filesWithFindings.has("a.ts")).toBe(true);
    expect(filesWithFindings.has("b.ts")).toBe(true);
  });

  test("returns empty findings for clean multi-file skill", () => {
    const skill = mockSkillMultiFile([
      { name: "utils.ts", code: "export function add(a: number, b: number) { return a + b; }" },
      { name: "index.ts", code: 'import { add } from "./utils";\nconsole.log(add(1, 2));' },
    ]);
    const findings = checkInjection(skill);
    expect(findings.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Finding structure validation
// ---------------------------------------------------------------------------
describe("Injection: finding structure", () => {
  test("every finding has required fields", () => {
    const skill = mockSkill(`
eval(code);
exec(cmd);
const x = new Function(body);
`);
    const findings = checkInjection(skill);
    expect(findings.length).toBeGreaterThanOrEqual(1);

    for (const f of findings) {
      expect(f.id).toBeDefined();
      expect(f.rule).toBe("injection");
      expect(f.severity).toBeDefined();
      expect(f.category).toBe("skill-injection");
      expect(f.title).toBeDefined();
      expect(f.description).toBeDefined();
      expect(typeof f.title).toBe("string");
      expect(typeof f.description).toBe("string");
      expect(f.remediation).toBeDefined();
    }
  });

  test("findings have unique ids", () => {
    const skill = mockSkill(`
eval(a);
eval(b);
eval(c);
`);
    const findings = checkInjection(skill);
    const ids = findings.map((f) => f.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });
});
