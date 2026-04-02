import { describe, expect, test } from "bun:test";
import type { AgentSkill } from "@agent-audit/shared";
import { checkDenialOfService } from "../rules/dos";

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
// Infinite loop detection: while(true)
// ---------------------------------------------------------------------------
describe("DoS: while(true) detection", () => {
  test("detects bare while(true) without mitigation", () => {
    const skill = mockSkill(`
while(true) {
  doWork();
}
`);
    const findings = checkDenialOfService(skill);
    const loopFindings = findings.filter((f) => f.id.startsWith("DOS-001"));
    expect(loopFindings.length).toBeGreaterThanOrEqual(1);
    expect(loopFindings[0].severity).toBe("high");
    expect(loopFindings[0].rule).toBe("dos");
    expect(loopFindings[0].category).toBe("denial-of-service");
  });

  test("skips while(true) with break mitigation", () => {
    const skill = mockSkill(`
while(true) {
  if (done) break;
  doWork();
}
`);
    const findings = checkDenialOfService(skill);
    const loopFindings = findings.filter((f) => f.id.startsWith("DOS-001"));
    expect(loopFindings.length).toBe(0);
  });

  test("skips while(true) with return mitigation", () => {
    const skill = mockSkill(`
function process() {
  while(true) {
    if (complete) return result;
    step();
  }
}
`);
    const findings = checkDenialOfService(skill);
    const loopFindings = findings.filter((f) => f.id.startsWith("DOS-001"));
    expect(loopFindings.length).toBe(0);
  });

  test("skips while(true) with throw mitigation", () => {
    const skill = mockSkill(`
while(true) {
  if (timeout) throw new Error("timed out");
  poll();
}
`);
    const findings = checkDenialOfService(skill);
    const loopFindings = findings.filter((f) => f.id.startsWith("DOS-001"));
    expect(loopFindings.length).toBe(0);
  });

  test("detects while( true ) with extra whitespace", () => {
    const skill = mockSkill(`
while( true ) {
  spin();
}
`);
    const findings = checkDenialOfService(skill);
    const loopFindings = findings.filter((f) => f.id.startsWith("DOS-001"));
    expect(loopFindings.length).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// Infinite loop detection: for(;;)
// ---------------------------------------------------------------------------
describe("DoS: for(;;) detection", () => {
  test("detects bare for(;;) without mitigation", () => {
    const skill = mockSkill(`
for(;;) {
  spin();
}
`);
    const findings = checkDenialOfService(skill);
    const loopFindings = findings.filter((f) => f.id.startsWith("DOS-002"));
    expect(loopFindings.length).toBeGreaterThanOrEqual(1);
    expect(loopFindings[0].severity).toBe("high");
  });

  test("skips for(;;) with break mitigation", () => {
    const skill = mockSkill(`
for(;;) {
  const msg = queue.pop();
  if (!msg) break;
  handle(msg);
}
`);
    const findings = checkDenialOfService(skill);
    const loopFindings = findings.filter((f) => f.id.startsWith("DOS-002"));
    expect(loopFindings.length).toBe(0);
  });

  test("detects for( ; ; ) with extra whitespace", () => {
    const skill = mockSkill(`
for( ; ; ) {
  loop();
}
`);
    const findings = checkDenialOfService(skill);
    const loopFindings = findings.filter((f) => f.id.startsWith("DOS-002"));
    expect(loopFindings.length).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// Infinite loop detection: while(1), while(!0), while(!false)
// ---------------------------------------------------------------------------
describe("DoS: while(1) / while(!0) / while(!false) detection", () => {
  test("detects while(1) without mitigation", () => {
    const skill = mockSkill(`
while(1) {
  busyWait();
}
`);
    const findings = checkDenialOfService(skill);
    const loopFindings = findings.filter((f) => f.id.startsWith("DOS-003"));
    expect(loopFindings.length).toBeGreaterThanOrEqual(1);
    expect(loopFindings[0].severity).toBe("high");
  });

  test("detects while(!0) without mitigation", () => {
    const skill = mockSkill(`
while(!0) {
  tick();
}
`);
    const findings = checkDenialOfService(skill);
    const loopFindings = findings.filter((f) => f.id.startsWith("DOS-003"));
    expect(loopFindings.length).toBeGreaterThanOrEqual(1);
  });

  test("detects while(!false) without mitigation", () => {
    const skill = mockSkill(`
while(!false) {
  process();
}
`);
    const findings = checkDenialOfService(skill);
    const loopFindings = findings.filter((f) => f.id.startsWith("DOS-003"));
    expect(loopFindings.length).toBeGreaterThanOrEqual(1);
  });

  test("skips while(1) with return mitigation", () => {
    const skill = mockSkill(`
function poll() {
  while(1) {
    const data = check();
    if (data) return data;
  }
}
`);
    const findings = checkDenialOfService(skill);
    const loopFindings = findings.filter((f) => f.id.startsWith("DOS-003"));
    expect(loopFindings.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// ReDoS: RegExp from user input
// ---------------------------------------------------------------------------
describe("DoS: ReDoS - RegExp from user input", () => {
  test("detects new RegExp(input)", () => {
    const skill = mockSkill(`
const regex = new RegExp(input);
`);
    const findings = checkDenialOfService(skill);
    const redosFindings = findings.filter((f) => f.id.startsWith("DOS-010"));
    expect(redosFindings.length).toBeGreaterThanOrEqual(1);
    expect(redosFindings[0].severity).toBe("high");
  });

  test("detects new RegExp(query) case-insensitive", () => {
    const skill = mockSkill(`
const re = new RegExp(query, "i");
`);
    const findings = checkDenialOfService(skill);
    const redosFindings = findings.filter((f) => f.id.startsWith("DOS-010"));
    expect(redosFindings.length).toBeGreaterThanOrEqual(1);
  });

  test("detects new RegExp(req variable)", () => {
    const skill = mockSkill(`
const pattern = new RegExp(req.body.search);
`);
    const findings = checkDenialOfService(skill);
    const redosFindings = findings.filter((f) => f.id.startsWith("DOS-010"));
    expect(redosFindings.length).toBeGreaterThanOrEqual(1);
  });

  test("detects new RegExp(param)", () => {
    const skill = mockSkill(`
const filter = new RegExp(param);
`);
    const findings = checkDenialOfService(skill);
    const redosFindings = findings.filter((f) => f.id.startsWith("DOS-010"));
    expect(redosFindings.length).toBeGreaterThanOrEqual(1);
  });

  test("does not flag static RegExp constructor", () => {
    const skill = mockSkill(`
const re = new RegExp("^[a-z]+$");
`);
    const findings = checkDenialOfService(skill);
    const redosFindings = findings.filter((f) => f.id.startsWith("DOS-010"));
    expect(redosFindings.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// ReDoS: nested quantifiers and multiple .* sequences
// ---------------------------------------------------------------------------
describe("DoS: ReDoS - dangerous regex patterns", () => {
  test("detects consecutive .* sequences", () => {
    const skill = mockSkill(`
const re = /prefix.*.*suffix/;
`);
    const findings = checkDenialOfService(skill);
    const dotStarFindings = findings.filter((f) => f.id.startsWith("DOS-011"));
    expect(dotStarFindings.length).toBeGreaterThanOrEqual(1);
    expect(dotStarFindings[0].severity).toBe("medium");
  });

  test("detects consecutive quantified groups (a+)(b+)", () => {
    const skill = mockSkill(`
const evil = /(a+)(b+)/;
`);
    const findings = checkDenialOfService(skill);
    const nestedFindings = findings.filter((f) => f.id.startsWith("DOS-012"));
    expect(nestedFindings.length).toBeGreaterThanOrEqual(1);
    expect(nestedFindings[0].severity).toBe("high");
  });

  test("detects consecutive quantified groups (x*)(y*)", () => {
    const skill = mockSkill(`
const evil = /(x*)(y*)/;
`);
    const findings = checkDenialOfService(skill);
    const nestedFindings = findings.filter((f) => f.id.startsWith("DOS-012"));
    expect(nestedFindings.length).toBeGreaterThanOrEqual(1);
  });

  test("does not flag simple regex", () => {
    const skill = mockSkill(`
const safe = /^[a-z0-9]+$/;
`);
    const findings = checkDenialOfService(skill);
    const regexFindings = findings.filter(
      (f) => f.id.startsWith("DOS-011") || f.id.startsWith("DOS-012"),
    );
    expect(regexFindings.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Resource exhaustion: Buffer.alloc
// ---------------------------------------------------------------------------
describe("DoS: Buffer.alloc with user-controlled size", () => {
  test("detects Buffer.alloc(input)", () => {
    const skill = mockSkill(`
const buf = Buffer.alloc(input);
`);
    const findings = checkDenialOfService(skill);
    const bufFindings = findings.filter((f) => f.id.startsWith("DOS-021"));
    expect(bufFindings.length).toBeGreaterThanOrEqual(1);
    expect(bufFindings[0].severity).toBe("high");
  });

  test("detects Buffer.alloc(size) from user param", () => {
    const skill = mockSkill(`
const buf = Buffer.alloc(size);
`);
    const findings = checkDenialOfService(skill);
    const bufFindings = findings.filter((f) => f.id.startsWith("DOS-021"));
    expect(bufFindings.length).toBeGreaterThanOrEqual(1);
  });

  test("detects Buffer.alloc(length)", () => {
    const skill = mockSkill(`
const buf = Buffer.alloc(length);
`);
    const findings = checkDenialOfService(skill);
    const bufFindings = findings.filter((f) => f.id.startsWith("DOS-021"));
    expect(bufFindings.length).toBeGreaterThanOrEqual(1);
  });

  test("does not flag Buffer.alloc with literal", () => {
    const skill = mockSkill(`
const buf = Buffer.alloc(1024);
`);
    const findings = checkDenialOfService(skill);
    const bufFindings = findings.filter((f) => f.id.startsWith("DOS-021"));
    expect(bufFindings.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Resource exhaustion: new Array with user-controlled size
// ---------------------------------------------------------------------------
describe("DoS: new Array with user-controlled size", () => {
  test("detects new Array(input)", () => {
    const skill = mockSkill(`
const arr = new Array(input);
`);
    const findings = checkDenialOfService(skill);
    const arrFindings = findings.filter((f) => f.id.startsWith("DOS-022"));
    expect(arrFindings.length).toBeGreaterThanOrEqual(1);
    expect(arrFindings[0].severity).toBe("medium");
  });

  test("detects new Array(count)", () => {
    const skill = mockSkill(`
const items = new Array(count);
`);
    const findings = checkDenialOfService(skill);
    const arrFindings = findings.filter((f) => f.id.startsWith("DOS-022"));
    expect(arrFindings.length).toBeGreaterThanOrEqual(1);
  });

  test("does not flag new Array with literal", () => {
    const skill = mockSkill(`
const items = new Array(10);
`);
    const findings = checkDenialOfService(skill);
    const arrFindings = findings.filter((f) => f.id.startsWith("DOS-022"));
    expect(arrFindings.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Resource exhaustion: .repeat with user-controlled count
// ---------------------------------------------------------------------------
describe("DoS: .repeat with user-controlled count", () => {
  test("detects str.repeat(input)", () => {
    const skill = mockSkill(`
const padded = "x".repeat(input);
`);
    const findings = checkDenialOfService(skill);
    const repeatFindings = findings.filter((f) => f.id.startsWith("DOS-023"));
    expect(repeatFindings.length).toBeGreaterThanOrEqual(1);
    expect(repeatFindings[0].severity).toBe("high");
  });

  test("detects str.repeat(count)", () => {
    const skill = mockSkill(`
const result = padding.repeat(count);
`);
    const findings = checkDenialOfService(skill);
    const repeatFindings = findings.filter((f) => f.id.startsWith("DOS-023"));
    expect(repeatFindings.length).toBeGreaterThanOrEqual(1);
  });

  test("detects str.repeat(times)", () => {
    const skill = mockSkill(`
const line = "-".repeat(times);
`);
    const findings = checkDenialOfService(skill);
    const repeatFindings = findings.filter((f) => f.id.startsWith("DOS-023"));
    expect(repeatFindings.length).toBeGreaterThanOrEqual(1);
  });

  test("does not flag .repeat with literal", () => {
    const skill = mockSkill(`
const dashes = "-".repeat(40);
`);
    const findings = checkDenialOfService(skill);
    const repeatFindings = findings.filter((f) => f.id.startsWith("DOS-023"));
    expect(repeatFindings.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Missing fetch timeout
// ---------------------------------------------------------------------------
describe("DoS: missing fetch timeout", () => {
  test("detects fetch without AbortController or timeout", () => {
    const skill = mockSkill(`
const response = await fetch("https://api.example.com/data");
const json = await response.json();
`);
    const findings = checkDenialOfService(skill);
    const timeoutFindings = findings.filter(
      (f) => f.id.startsWith("DOS-030") || f.id.startsWith("DOS-TIMEOUT"),
    );
    expect(timeoutFindings.length).toBeGreaterThanOrEqual(1);
  });

  test("does not flag fetch with AbortController", () => {
    const skill = mockSkill(`
const controller = new AbortController();
setTimeout(() => controller.abort(), 5000);
const response = await fetch("https://api.example.com/data", {
  signal: controller.signal,
});
`);
    const findings = checkDenialOfService(skill);
    const missingTimeout = findings.filter((f) => f.id.startsWith("DOS-TIMEOUT"));
    expect(missingTimeout.length).toBe(0);
  });

  test("does not flag fetch with AbortSignal.timeout", () => {
    const skill = mockSkill(`
const response = await fetch("https://api.example.com/data", {
  signal: AbortSignal.timeout(5000),
});
`);
    const findings = checkDenialOfService(skill);
    const missingTimeout = findings.filter((f) => f.id.startsWith("DOS-TIMEOUT"));
    expect(missingTimeout.length).toBe(0);
  });

  test("does not flag fetch with timeout option", () => {
    const skill = mockSkill(`
const response = await fetch("https://api.example.com/data", {
  timeout: 5000,
});
`);
    const findings = checkDenialOfService(skill);
    const missingTimeout = findings.filter((f) => f.id.startsWith("DOS-TIMEOUT"));
    expect(missingTimeout.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Unbounded recursion
// ---------------------------------------------------------------------------
describe("DoS: unbounded recursion", () => {
  test("detects self-recursive function", () => {
    const skill = mockSkill(`
function traverse(node) {
  process(node);
  traverse(node.child);
}
`);
    const findings = checkDenialOfService(skill);
    const recurFindings = findings.filter((f) => f.id.startsWith("DOS-040"));
    expect(recurFindings.length).toBeGreaterThanOrEqual(1);
    expect(recurFindings[0].severity).toBe("medium");
  });

  test("detects recursive function with complex body", () => {
    const skill = mockSkill(`
function flatten(arr) {
  const result = [];
  for (const item of arr) {
    if (Array.isArray(item)) {
      result.push(...flatten(item));
    }
  }
  return result;
}
`);
    const findings = checkDenialOfService(skill);
    const recurFindings = findings.filter((f) => f.id.startsWith("DOS-040"));
    expect(recurFindings.length).toBeGreaterThanOrEqual(1);
  });

  test("does not flag non-recursive function", () => {
    const skill = mockSkill(`
function add(a, b) {
  return a + b;
}
function multiply(a, b) {
  return a * b;
}
`);
    const findings = checkDenialOfService(skill);
    const recurFindings = findings.filter((f) => f.id.startsWith("DOS-040"));
    expect(recurFindings.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// setInterval with near-zero delay
// ---------------------------------------------------------------------------
describe("DoS: setInterval with near-zero delay", () => {
  test("detects setInterval with 0ms delay", () => {
    const skill = mockSkill(`
setInterval(doWork, 0);
`);
    const findings = checkDenialOfService(skill);
    const intervalFindings = findings.filter((f) => f.id.startsWith("DOS-024"));
    expect(intervalFindings.length).toBeGreaterThanOrEqual(1);
    expect(intervalFindings[0].severity).toBe("medium");
  });

  test("detects setInterval with 1ms delay", () => {
    const skill = mockSkill(`
setInterval(tick, 1);
`);
    const findings = checkDenialOfService(skill);
    const intervalFindings = findings.filter((f) => f.id.startsWith("DOS-024"));
    expect(intervalFindings.length).toBeGreaterThanOrEqual(1);
  });

  test("does not flag setInterval with reasonable delay", () => {
    const skill = mockSkill(`
setInterval(healthCheck, 5000);
`);
    const findings = checkDenialOfService(skill);
    const intervalFindings = findings.filter((f) => f.id.startsWith("DOS-024"));
    expect(intervalFindings.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Comment filtering
// ---------------------------------------------------------------------------
describe("DoS: comment filtering", () => {
  test("ignores patterns in line comments", () => {
    const skill = mockSkill(`
// while(true) { spin(); }
const safe = 42;
`);
    const findings = checkDenialOfService(skill);
    const loopFindings = findings.filter((f) => f.id.startsWith("DOS-001"));
    expect(loopFindings.length).toBe(0);
  });

  test("ignores patterns in block comments", () => {
    const skill = mockSkill(`
/*
  while(true) { spin(); }
  for(;;) { loop(); }
*/
const safe = "hello";
`);
    const findings = checkDenialOfService(skill);
    const loopFindings = findings.filter(
      (f) => f.id.startsWith("DOS-001") || f.id.startsWith("DOS-002"),
    );
    expect(loopFindings.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// File type filtering
// ---------------------------------------------------------------------------
describe("DoS: file type filtering", () => {
  test("scans .ts files", () => {
    const skill = mockSkill("while(true) { spin(); }", "handler.ts");
    const findings = checkDenialOfService(skill);
    expect(findings.length).toBeGreaterThanOrEqual(1);
  });

  test("scans .js files", () => {
    const skill = mockSkill("while(true) { spin(); }", "handler.js");
    const findings = checkDenialOfService(skill);
    expect(findings.length).toBeGreaterThanOrEqual(1);
  });

  test("scans .py files", () => {
    const skill = mockSkill("while(true) { spin(); }", "handler.py");
    const findings = checkDenialOfService(skill);
    expect(findings.length).toBeGreaterThanOrEqual(1);
  });

  test("does not scan non-code files", () => {
    const skill = mockSkill("while(true) { spin(); }", "readme.md");
    const findings = checkDenialOfService(skill);
    expect(findings.length).toBe(0);
  });

  test("does not scan .png files", () => {
    const skill = mockSkill("while(true) { spin(); }", "image.png");
    const findings = checkDenialOfService(skill);
    expect(findings.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Clean code (no false positives)
// ---------------------------------------------------------------------------
describe("DoS: clean code produces no findings", () => {
  test("normal bounded loop has no findings", () => {
    const skill = mockSkill(`
for (let i = 0; i < items.length; i++) {
  process(items[i]);
}
`);
    const findings = checkDenialOfService(skill);
    expect(findings.length).toBe(0);
  });

  test("safe iteration code has no findings", () => {
    const skill = mockSkill(`
const result = items.map((item) => transform(item));
const filtered = result.filter((r) => r.valid);
console.log(filtered);
`);
    const findings = checkDenialOfService(skill);
    expect(findings.length).toBe(0);
  });

  test("static regex has no findings", () => {
    const skill = mockSkill(`
const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$/;
const valid = emailRegex.test(email);
`);
    const findings = checkDenialOfService(skill);
    expect(findings.length).toBe(0);
  });

  test("Buffer.alloc with literal size has no findings", () => {
    const skill = mockSkill(`
const buf = Buffer.alloc(256);
buf.write("hello");
`);
    const findings = checkDenialOfService(skill);
    expect(findings.length).toBe(0);
  });

  test("ordinary function (non-recursive) has no findings", () => {
    const skill = mockSkill(`
function greet(name: string): string {
  return "Hello, " + name;
}
`);
    const findings = checkDenialOfService(skill);
    expect(findings.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Finding structure validation
// ---------------------------------------------------------------------------
describe("DoS: finding structure", () => {
  test("every finding has required fields", () => {
    const skill = mockSkill(`
while(true) { spin(); }
const re = new RegExp(input);
const buf = Buffer.alloc(size);
`);
    const findings = checkDenialOfService(skill);
    expect(findings.length).toBeGreaterThanOrEqual(1);

    for (const f of findings) {
      expect(f.id).toBeDefined();
      expect(f.rule).toBe("dos");
      expect(f.severity).toBeDefined();
      expect(f.category).toBe("denial-of-service");
      expect(f.title).toBeDefined();
      expect(f.description).toBeDefined();
      expect(typeof f.title).toBe("string");
      expect(typeof f.description).toBe("string");
      expect(f.remediation).toBeDefined();
    }
  });

  test("findings have unique ids", () => {
    const skill = mockSkill(`
while(true) { doA(); }
while(true) { doB(); }
while(true) { doC(); }
`);
    const findings = checkDenialOfService(skill);
    const ids = findings.map((f) => f.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  test("findings include file path", () => {
    const skill = mockSkill("while(true) { spin(); }", "worker.ts");
    const findings = checkDenialOfService(skill);
    expect(findings.length).toBeGreaterThanOrEqual(1);
    expect(findings[0].file).toBe("worker.ts");
  });

  test("findings include correct line number", () => {
    const skill = mockSkill(`const a = 1;
const b = 2;
while(true) { hang(); }
`);
    const findings = checkDenialOfService(skill);
    const loopFindings = findings.filter((f) => f.id.startsWith("DOS-001"));
    expect(loopFindings.length).toBeGreaterThanOrEqual(1);
    expect(loopFindings[0].line).toBe(3);
  });

  test("findings include evidence", () => {
    const skill = mockSkill(`
while(true) { spin(); }
`);
    const findings = checkDenialOfService(skill);
    const loopFindings = findings.filter((f) => f.id.startsWith("DOS-001"));
    expect(loopFindings.length).toBeGreaterThanOrEqual(1);
    expect(loopFindings[0].evidence).toBeDefined();
    expect(loopFindings[0].evidence).toContain("while(true)");
  });
});

// ---------------------------------------------------------------------------
// Multiple file scanning
// ---------------------------------------------------------------------------
describe("DoS: multiple file scanning", () => {
  test("reports findings from all files", () => {
    const skill = mockSkillMultiFile([
      { name: "a.ts", code: "while(true) { spin(); }" },
      { name: "b.ts", code: "const re = new RegExp(input);" },
    ]);
    const findings = checkDenialOfService(skill);
    const filesWithFindings = new Set(findings.map((f) => f.file));
    expect(filesWithFindings.has("a.ts")).toBe(true);
    expect(filesWithFindings.has("b.ts")).toBe(true);
  });

  test("returns empty findings for clean multi-file skill", () => {
    const skill = mockSkillMultiFile([
      { name: "utils.ts", code: "export function add(a: number, b: number) { return a + b; }" },
      { name: "index.ts", code: 'import { add } from "./utils";\nconsole.log(add(1, 2));' },
    ]);
    const findings = checkDenialOfService(skill);
    expect(findings.length).toBe(0);
  });
});
