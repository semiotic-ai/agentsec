import { describe, test, expect } from "bun:test";
import { checkErrorHandling } from "../rules/error-handling";
import type { AgentSkill } from "@agent-audit/shared";

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

// ---------------------------------------------------------------------------
// Error leakage: res.send(err), res.json(error.stack), Express middleware
// ---------------------------------------------------------------------------
describe("Error Handling: error leakage in HTTP responses", () => {
  test("detects res.send(err)", () => {
    const skill = mockSkill(`
app.get("/api", (req, res) => {
  try { doWork(); } catch (err) {
    res.send(err);
  }
});
`);
    const findings = checkErrorHandling(skill);
    const leakFindings = findings.filter((f) => f.id.startsWith("ERR-001"));
    expect(leakFindings.length).toBeGreaterThanOrEqual(1);
    expect(leakFindings[0].severity).toBe("high");
    expect(leakFindings[0].rule).toBe("error-handling");
  });

  test("detects res.json(error.stack)", () => {
    const skill = mockSkill(`
app.post("/data", (req, res) => {
  try { process(); } catch (error) {
    res.json(error.stack);
  }
});
`);
    const findings = checkErrorHandling(skill);
    const leakFindings = findings.filter((f) => f.id.startsWith("ERR-001"));
    expect(leakFindings.length).toBeGreaterThanOrEqual(1);
  });

  test("detects response.send(error.message)", () => {
    const skill = mockSkill(`
try { run(); } catch (error) {
  response.send(error.message);
}
`);
    const findings = checkErrorHandling(skill);
    const leakFindings = findings.filter((f) => f.id.startsWith("ERR-001"));
    expect(leakFindings.length).toBeGreaterThanOrEqual(1);
  });

  test("detects stack trace access (ERR-002)", () => {
    const skill = mockSkill(`
try { work(); } catch (e) {
  logger.info(e.stack);
}
`);
    const findings = checkErrorHandling(skill);
    const stackFindings = findings.filter((f) => f.id.startsWith("ERR-002"));
    expect(stackFindings.length).toBeGreaterThanOrEqual(1);
    expect(stackFindings[0].severity).toBe("medium");
  });

  test("detects Express error middleware leaking details (ERR-003)", () => {
    const skill = mockSkill(
      `app.use(error => { res.send(error.stack) });`
    );
    const findings = checkErrorHandling(skill);
    const mwFindings = findings.filter((f) => f.id.startsWith("ERR-003"));
    expect(mwFindings.length).toBeGreaterThanOrEqual(1);
    expect(mwFindings[0].severity).toBe("high");
  });
});

// ---------------------------------------------------------------------------
// Empty catch blocks
// ---------------------------------------------------------------------------
describe("Error Handling: empty catch blocks", () => {
  test("detects catch(e) {}", () => {
    const skill = mockSkill(`
try {
  doSomething();
} catch(e) {}
`);
    const findings = checkErrorHandling(skill);
    const emptyFindings = findings.filter((f) => f.id.startsWith("ERR-010"));
    expect(emptyFindings.length).toBeGreaterThanOrEqual(1);
    expect(emptyFindings[0].severity).toBe("medium");
  });

  test("detects catch(error) {}", () => {
    const skill = mockSkill(`
try { parse(data); } catch(error) {}
`);
    const findings = checkErrorHandling(skill);
    const emptyFindings = findings.filter((f) => f.id.startsWith("ERR-010"));
    expect(emptyFindings.length).toBeGreaterThanOrEqual(1);
  });

  test("detects catch block with only a comment (ERR-011)", () => {
    const skill = mockSkill(`
try { read(); } catch(e) { // ignore }
`);
    const findings = checkErrorHandling(skill);
    const commentFindings = findings.filter((f) => f.id.startsWith("ERR-011"));
    expect(commentFindings.length).toBeGreaterThanOrEqual(1);
    expect(commentFindings[0].severity).toBe("low");
  });

  test("detects .catch(() => {})", () => {
    const skill = mockSkill(`
fetchData().then(handle).catch(() => {});
`);
    const findings = checkErrorHandling(skill);
    const promiseFindings = findings.filter((f) => f.id.startsWith("ERR-012"));
    expect(promiseFindings.length).toBeGreaterThanOrEqual(1);
    expect(promiseFindings[0].severity).toBe("medium");
  });

  test("detects .catch returning null (ERR-013)", () => {
    const skill = mockSkill(`
getData().catch(() => null);
`);
    const findings = checkErrorHandling(skill);
    const nullFindings = findings.filter((f) => f.id.startsWith("ERR-013"));
    expect(nullFindings.length).toBeGreaterThanOrEqual(1);
    expect(nullFindings[0].severity).toBe("low");
  });
});

// ---------------------------------------------------------------------------
// Missing promise catch handlers
// ---------------------------------------------------------------------------
describe("Error Handling: missing promise catch", () => {
  test("flags multiple .then() calls without .catch()", () => {
    const skill = mockSkill(`
fetchA().then(handleA);
fetchB().then(handleB);
fetchC().then(handleC);
`);
    const findings = checkErrorHandling(skill);
    const promiseFindings = findings.filter((f) => f.id.startsWith("ERR-PROMISE"));
    expect(promiseFindings.length).toBeGreaterThanOrEqual(1);
    expect(promiseFindings[0].severity).toBe("medium");
  });

  test("does not flag .then() when .catch() is on the same line", () => {
    const skill = mockSkill(`
fetchA().then(handleA).catch(logError);
fetchB().then(handleB).catch(logError);
fetchC().then(handleC).catch(logError);
`);
    const findings = checkErrorHandling(skill);
    const promiseFindings = findings.filter((f) => f.id.startsWith("ERR-PROMISE"));
    expect(promiseFindings.length).toBe(0);
  });

  test("does not flag when .catch() follows on a subsequent line", () => {
    const skill = mockSkill(`
fetchA()
  .then(handleA)
  .catch(logError);
fetchB()
  .then(handleB)
  .catch(logError);
fetchC()
  .then(handleC)
  .catch(logError);
`);
    const findings = checkErrorHandling(skill);
    const promiseFindings = findings.filter((f) => f.id.startsWith("ERR-PROMISE"));
    expect(promiseFindings.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Global error handler issues
// ---------------------------------------------------------------------------
describe("Error Handling: global error handler issues", () => {
  test("detects uncaughtException handler that exits without cleanup (ERR-020)", () => {
    const skill = mockSkill(`
const app = express();
process.on("uncaughtException", err => { process.exit(1) });
`);
    const findings = checkErrorHandling(skill);
    const exitFindings = findings.filter((f) => f.id.startsWith("ERR-020"));
    expect(exitFindings.length).toBeGreaterThanOrEqual(1);
    expect(exitFindings[0].severity).toBe("medium");
  });

  test("detects empty unhandledRejection handler (ERR-021)", () => {
    const skill = mockSkill(`
const app = express();
process.on('unhandledRejection', () => {});
`);
    const findings = checkErrorHandling(skill);
    const emptyFindings = findings.filter((f) => f.id.startsWith("ERR-021"));
    expect(emptyFindings.length).toBeGreaterThanOrEqual(1);
    expect(emptyFindings[0].severity).toBe("medium");
  });

  test("flags server without any global error handler (ERR-GLOBAL)", () => {
    const skill = mockSkill(`
const app = express();
app.get("/", (req, res) => res.send("ok"));
app.listen(3000);
`);
    const findings = checkErrorHandling(skill);
    const globalFindings = findings.filter((f) => f.id.startsWith("ERR-GLOBAL"));
    expect(globalFindings.length).toBeGreaterThanOrEqual(1);
    expect(globalFindings[0].severity).toBe("low");
  });

  test("does not flag server that has a global error handler", () => {
    const skill = mockSkill(`
const app = express();
app.get("/", (req, res) => res.send("ok"));
process.on('uncaughtException', (err) => { logger.error(err); });
app.listen(3000);
`);
    const findings = checkErrorHandling(skill);
    const globalFindings = findings.filter((f) => f.id.startsWith("ERR-GLOBAL"));
    expect(globalFindings.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Catch-all with generic return
// ---------------------------------------------------------------------------
describe("Error Handling: catch-all with generic return", () => {
  test("detects catch returning null (ERR-030)", () => {
    const skill = mockSkill(`
try { parse(data); } catch (e) { return null; }
`);
    const findings = checkErrorHandling(skill);
    const catchAllFindings = findings.filter((f) => f.id.startsWith("ERR-030"));
    expect(catchAllFindings.length).toBeGreaterThanOrEqual(1);
    expect(catchAllFindings[0].severity).toBe("low");
  });

  test("detects catch returning false", () => {
    const skill = mockSkill(`
try { validate(input); } catch (err) { return false; }
`);
    const findings = checkErrorHandling(skill);
    const catchAllFindings = findings.filter((f) => f.id.startsWith("ERR-030"));
    expect(catchAllFindings.length).toBeGreaterThanOrEqual(1);
  });

  test("detects catch with continue", () => {
    const skill = mockSkill(`
for (const item of items) {
  try { process(item); } catch (error) { continue; }
}
`);
    const findings = checkErrorHandling(skill);
    const catchAllFindings = findings.filter((f) => f.id.startsWith("ERR-030"));
    expect(catchAllFindings.length).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// Clean code negatives
// ---------------------------------------------------------------------------
describe("Error Handling: clean code produces no findings", () => {
  test("proper error handling with logging", () => {
    const skill = mockSkill(`
try {
  const result = doWork();
  return result;
} catch (error) {
  logger.error("Operation failed", error);
  throw new AppError("Operation failed", { cause: error });
}
`);
    const findings = checkErrorHandling(skill);
    expect(findings.length).toBe(0);
  });

  test("generic HTTP error response without leaking internals", () => {
    const skill = mockSkill(`
app.get("/api/data", async (req, res) => {
  try {
    const data = await fetchData();
    res.json(data);
  } catch (error) {
    logger.error("Failed to fetch data", error);
    res.status(500).json({ message: "Internal server error" });
  }
});
`);
    const findings = checkErrorHandling(skill);
    const leakFindings = findings.filter((f) => f.id.startsWith("ERR-001"));
    expect(leakFindings.length).toBe(0);
  });

  test("non-code files are skipped", () => {
    const skill = mockSkill("res.send(error.stack);", "readme.md");
    const findings = checkErrorHandling(skill);
    expect(findings.length).toBe(0);
  });

  test("code in comments is ignored", () => {
    const skill = mockSkill(`
// res.send(err) - bad practice, don't do this
// catch(e) {} - never do this
const x = 42;
`);
    const findings = checkErrorHandling(skill);
    const leakFindings = findings.filter((f) => f.id.startsWith("ERR-001"));
    expect(leakFindings.length).toBe(0);
  });

  test("empty skill returns no findings", () => {
    const skill = mockSkill("");
    const findings = checkErrorHandling(skill);
    expect(findings.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Finding structure validation
// ---------------------------------------------------------------------------
describe("Error Handling: finding structure", () => {
  test("every finding has required fields", () => {
    const skill = mockSkill(`
try { work(); } catch(e) {}
res.send(err);
`);
    const findings = checkErrorHandling(skill);
    expect(findings.length).toBeGreaterThanOrEqual(1);

    for (const f of findings) {
      expect(f.id).toBeDefined();
      expect(f.rule).toBe("error-handling");
      expect(f.severity).toBeDefined();
      expect(f.category).toBe("improper-error-handling");
      expect(f.title).toBeDefined();
      expect(f.description).toBeDefined();
      expect(typeof f.title).toBe("string");
      expect(typeof f.description).toBe("string");
      expect(f.remediation).toBeDefined();
    }
  });

  test("findings have unique ids", () => {
    const skill = mockSkill(`
try { a(); } catch(e) {}
try { b(); } catch(e) {}
try { c(); } catch(e) {}
`);
    const findings = checkErrorHandling(skill);
    const ids = findings.map((f) => f.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });
});
