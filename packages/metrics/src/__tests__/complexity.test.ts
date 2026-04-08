import { describe, expect, test } from "bun:test";
import type { SkillFile } from "@agent-audit/shared";
import { calculateComplexity, countTotalLinesOfCode } from "../complexity";

/** Helper to build a SkillFile from source and language. */
function makeFile(content: string, language: string, relativePath = "index.ts"): SkillFile {
  return {
    path: `/tmp/skill/${relativePath}`,
    relativePath,
    content,
    language,
    size: content.length,
  };
}

// ---------------------------------------------------------------------------
// JS/TS branch detection
// ---------------------------------------------------------------------------
describe("calculateComplexity: JS/TS branches", () => {
  test("detects if / else if / else", () => {
    const code = `
if (a) {
  doA();
} else if (b) {
  doB();
} else {
  doC();
}
`;
    const result = calculateComplexity([makeFile(code, "typescript")]);
    const types = result.branches.map((b) => b.type);
    expect(types).toContain("if");
    expect(types).toContain("else if");
    expect(types).toContain("else");
    expect(result.rawBranchCount).toBeGreaterThanOrEqual(3);
    expect(result.score).toBeGreaterThan(0);
  });

  test("detects for / while / do-while loops", () => {
    const code = `
for (let i = 0; i < 10; i++) { sum += i; }
while (running) { tick(); }
do { step(); } while (hasMore);
`;
    const result = calculateComplexity([makeFile(code, "javascript")]);
    const types = result.branches.map((b) => b.type);
    expect(types).toContain("for");
    expect(types).toContain("while");
    expect(types).toContain("do-while");
  });

  test("detects switch / case", () => {
    const code = `
switch (action) {
  case "start": begin(); break;
  case "stop": end(); break;
  default: idle();
}
`;
    const result = calculateComplexity([makeFile(code, "typescript")]);
    const types = result.branches.map((b) => b.type);
    expect(types).toContain("switch");
    expect(types).toContain("case");
  });

  test("detects ternary operator", () => {
    const code = `const x = a > 0 ? "pos" : "neg";`;
    const result = calculateComplexity([makeFile(code, "ts")]);
    const ternary = result.branches.find((b) => b.type === "ternary");
    expect(ternary).toBeDefined();
    expect(ternary?.count).toBeGreaterThanOrEqual(1);
  });

  test("detects try / catch / finally", () => {
    const code = `
try {
  riskyCall();
} catch (e) {
  handleError(e);
} finally {
  cleanup();
}
`;
    const result = calculateComplexity([makeFile(code, "typescript")]);
    const types = result.branches.map((b) => b.type);
    expect(types).toContain("try");
    expect(types).toContain("catch");
    expect(types).toContain("finally");
  });

  test("detects logical operators (&&, ||, ??)", () => {
    const code = `
const a = x && y;
const b = x || y;
const c = x ?? fallback;
`;
    const result = calculateComplexity([makeFile(code, "typescript")]);
    const types = result.branches.map((b) => b.type);
    expect(types).toContain("logical-and");
    expect(types).toContain("logical-or");
    expect(types).toContain("nullish-coalesce");
  });

  test("detects optional chaining", () => {
    const code = `const v = obj?.nested?.value;`;
    const result = calculateComplexity([makeFile(code, "typescript")]);
    const oc = result.branches.find((b) => b.type === "optional-chain");
    expect(oc).toBeDefined();
    expect(oc?.count).toBeGreaterThanOrEqual(2);
  });

  test("detects for-in and for-of loops", () => {
    const code = `
for (const key in obj) { use(key); }
for (const item of arr) { use(item); }
`;
    const result = calculateComplexity([makeFile(code, "typescript")]);
    const types = result.branches.map((b) => b.type);
    expect(types).toContain("for-in");
    expect(types).toContain("for-of");
  });

  test("applies correct weights to branches", () => {
    // A single for-loop has weight 2, a single if has weight 1
    const forCode = `for (let i = 0; i < 10; i++) { x++; }`;
    const ifCode = `if (x) { y(); }`;

    const forResult = calculateComplexity([makeFile(forCode, "typescript")]);
    const ifResult = calculateComplexity([makeFile(ifCode, "typescript")]);

    // for weight=2, if weight=1
    expect(forResult.score).toBeGreaterThan(ifResult.score);
  });
});

// ---------------------------------------------------------------------------
// Python branch detection
// ---------------------------------------------------------------------------
describe("calculateComplexity: Python branches", () => {
  test("detects if / elif / else", () => {
    const code = `
if x > 0:
    do_a()
elif x == 0:
    do_b()
else:
    do_c()
`;
    const result = calculateComplexity([makeFile(code, "python", "main.py")]);
    const types = result.branches.map((b) => b.type);
    expect(types).toContain("if");
    expect(types).toContain("elif");
    expect(types).toContain("else");
  });

  test("detects for and while loops", () => {
    const code = `
for item in items:
    process(item)

while running:
    tick()
`;
    const result = calculateComplexity([makeFile(code, "python", "main.py")]);
    const types = result.branches.map((b) => b.type);
    expect(types).toContain("for");
    expect(types).toContain("while");
  });

  test("detects try / except / finally", () => {
    const code = `
try:
    risky()
except ValueError:
    handle()
finally:
    cleanup()
`;
    const result = calculateComplexity([makeFile(code, "python", "main.py")]);
    const types = result.branches.map((b) => b.type);
    expect(types).toContain("try");
    expect(types).toContain("catch"); // Python except maps to "catch"
    expect(types).toContain("finally");
  });

  test("detects logical operators (and / or)", () => {
    const code = `
x = a and b
y = c or d
`;
    const result = calculateComplexity([makeFile(code, "python", "main.py")]);
    const types = result.branches.map((b) => b.type);
    expect(types).toContain("logical-and");
    expect(types).toContain("logical-or");
  });

  test("detects Python ternary (x if cond else y)", () => {
    const code = `result = "yes" if condition else "no"`;
    const result = calculateComplexity([makeFile(code, "python", "main.py")]);
    const ternary = result.branches.find((b) => b.type === "ternary");
    expect(ternary).toBeDefined();
    expect(ternary?.count).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// Strings and comments are ignored
// ---------------------------------------------------------------------------
describe("calculateComplexity: string/comment stripping", () => {
  test("does not count keywords inside JS string literals", () => {
    const code = `const msg = "if (x) { for (y) { while (z) } }";`;
    const result = calculateComplexity([makeFile(code, "typescript")]);
    // The keywords are inside a string, so branch count should be 0
    expect(result.rawBranchCount).toBe(0);
  });

  test("does not count keywords inside JS comments", () => {
    const code = `
// if (x) { for (y) { while (z) } }
/* switch (a) { case 1: break; } */
`;
    const result = calculateComplexity([makeFile(code, "typescript")]);
    expect(result.rawBranchCount).toBe(0);
  });

  test("does not count keywords inside Python comments", () => {
    const code = `# if x: for y in z: while True:`;
    const result = calculateComplexity([makeFile(code, "python", "main.py")]);
    expect(result.rawBranchCount).toBe(0);
  });

  test("does not count keywords inside Python triple-quoted strings", () => {
    const code = `
msg = """
if x:
    for y in items:
        while True:
            pass
"""
`;
    const result = calculateComplexity([makeFile(code, "python", "main.py")]);
    expect(result.rawBranchCount).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------
describe("calculateComplexity: edge cases", () => {
  test("returns zero for empty file list", () => {
    const result = calculateComplexity([]);
    expect(result.score).toBe(0);
    expect(result.rawBranchCount).toBe(0);
    expect(result.branches).toHaveLength(0);
    expect(result.fileComplexities).toHaveLength(0);
  });

  test("returns zero for unknown language files", () => {
    const result = calculateComplexity([makeFile("if (x) { while (y) {} }", "rust", "main.rs")]);
    expect(result.score).toBe(0);
    expect(result.rawBranchCount).toBe(0);
  });

  test("aggregates complexity across multiple files", () => {
    const file1 = makeFile("if (a) { x(); }", "typescript", "a.ts");
    const file2 = makeFile("for (const x of items) { y(); }", "typescript", "b.ts");
    const result = calculateComplexity([file1, file2]);
    expect(result.fileComplexities).toHaveLength(2);
    expect(result.score).toBeGreaterThan(0);
    expect(result.rawBranchCount).toBeGreaterThanOrEqual(2);
  });

  test("handles mixed JS and Python files", () => {
    const jsFile = makeFile("if (x) { }", "typescript", "index.ts");
    const pyFile = makeFile("for item in items:\n    pass", "python", "main.py");
    const result = calculateComplexity([jsFile, pyFile]);
    expect(result.fileComplexities).toHaveLength(2);
    expect(result.rawBranchCount).toBeGreaterThanOrEqual(2);
  });

  test("fileComplexities contain per-file scores and line counts", () => {
    const code = `
if (a) { x(); }
for (let i = 0; i < 10; i++) { y(); }
`;
    const result = calculateComplexity([makeFile(code, "typescript", "main.ts")]);
    expect(result.fileComplexities).toHaveLength(1);
    const fc = result.fileComplexities[0];
    expect(fc.path).toBe("main.ts");
    expect(fc.language).toBe("typescript");
    expect(fc.score).toBeGreaterThan(0);
    expect(fc.branchCount).toBeGreaterThanOrEqual(2);
    expect(fc.linesOfCode).toBeGreaterThan(0);
  });

  test("branches array is sorted by weighted contribution descending", () => {
    const code = `
for (let i = 0; i < 10; i++) { }
for (let j = 0; j < 10; j++) { }
if (x) { }
`;
    const result = calculateComplexity([makeFile(code, "typescript")]);
    // for (weight 2) should appear before if (weight 1) if both have the same count
    for (let i = 1; i < result.branches.length; i++) {
      const prev = result.branches[i - 1];
      const curr = result.branches[i];
      expect(prev.count * prev.weight).toBeGreaterThanOrEqual(curr.count * curr.weight);
    }
  });
});

// ---------------------------------------------------------------------------
// countTotalLinesOfCode
// ---------------------------------------------------------------------------
describe("countTotalLinesOfCode", () => {
  test("counts non-blank, non-comment lines in JS/TS", () => {
    const code = `
// A comment
const x = 1;

/* Block comment */
const y = 2;
`;
    const count = countTotalLinesOfCode([makeFile(code, "typescript")]);
    // Lines: "const x = 1;" and "const y = 2;" -> 2
    expect(count).toBe(2);
  });

  test("counts non-blank, non-comment lines in Python", () => {
    const code = `
# A comment
x = 1

y = 2
`;
    const count = countTotalLinesOfCode([makeFile(code, "python", "main.py")]);
    expect(count).toBe(2);
  });

  test("returns 0 for empty file list", () => {
    expect(countTotalLinesOfCode([])).toBe(0);
  });

  test("sums across multiple files", () => {
    const f1 = makeFile("const a = 1;\nconst b = 2;", "typescript", "a.ts");
    const f2 = makeFile("x = 1\ny = 2\nz = 3", "python", "b.py");
    const count = countTotalLinesOfCode([f1, f2]);
    expect(count).toBe(5);
  });

  test("includes unknown-language files in line count", () => {
    const f = makeFile("line1\nline2\nline3", "markdown", "README.md");
    const count = countTotalLinesOfCode([f]);
    expect(count).toBe(3);
  });
});
