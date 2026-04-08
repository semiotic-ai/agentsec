import { describe, expect, test } from "bun:test";
import type { AgentSkill } from "@agentsec/shared";
import { checkOutputHandling } from "../rules/output-handling";

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
// XSS: innerHTML assignment
// ---------------------------------------------------------------------------
describe("Output Handling: innerHTML assignment", () => {
  test("detects innerHTML assignment with dynamic content", () => {
    const skill = mockSkill(`
element.innerHTML = userContent;
`);
    const findings = checkOutputHandling(skill);
    const matched = findings.filter((f) => f.id.startsWith("OUT-001"));
    expect(matched.length).toBeGreaterThanOrEqual(1);
    expect(matched[0].severity).toBe("high");
    expect(matched[0].rule).toBe("output-handling");
    expect(matched[0].category).toBe("insecure-output");
  });

  test("detects innerHTML with concatenation", () => {
    const skill = mockSkill(`
el.innerHTML = "<div>" + data + "</div>";
`);
    const findings = checkOutputHandling(skill);
    const matched = findings.filter((f) => f.id.startsWith("OUT-001"));
    expect(matched.length).toBeGreaterThanOrEqual(1);
  });

  test("ignores innerHTML in comments", () => {
    const skill = mockSkill(`
// el.innerHTML = userContent;
const x = 42;
`);
    const findings = checkOutputHandling(skill);
    const matched = findings.filter((f) => f.id.startsWith("OUT-001"));
    expect(matched.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// XSS: document.write
// ---------------------------------------------------------------------------
describe("Output Handling: document.write", () => {
  test("detects document.write call", () => {
    const skill = mockSkill(`
document.write(content);
`);
    const findings = checkOutputHandling(skill);
    const matched = findings.filter((f) => f.id.startsWith("OUT-004"));
    expect(matched.length).toBeGreaterThanOrEqual(1);
    expect(matched[0].severity).toBe("high");
  });

  test("detects document.writeln call", () => {
    const skill = mockSkill(`
document.writeln(content);
`);
    const findings = checkOutputHandling(skill);
    const matched = findings.filter((f) => f.id.startsWith("OUT-004"));
    expect(matched.length).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// XSS: React dangerouslySetInnerHTML
// ---------------------------------------------------------------------------
describe("Output Handling: dangerouslySetInnerHTML", () => {
  test("detects dangerouslySetInnerHTML usage", () => {
    const skill = mockSkill(
      `
<div dangerouslySetInnerHTML ={{ __html: data }} />
`,
      "component.tsx",
    );
    const findings = checkOutputHandling(skill);
    const matched = findings.filter((f) => f.id.startsWith("OUT-005"));
    expect(matched.length).toBeGreaterThanOrEqual(1);
    expect(matched[0].severity).toBe("high");
  });
});

// ---------------------------------------------------------------------------
// XSS: Vue v-html
// ---------------------------------------------------------------------------
describe("Output Handling: Vue v-html", () => {
  test("detects v-html directive", () => {
    const skill = mockSkill(
      `
<div v-html="rawHtml"></div>
`,
      "component.vue",
    );
    const findings = checkOutputHandling(skill);
    const matched = findings.filter((f) => f.id.startsWith("OUT-006"));
    expect(matched.length).toBeGreaterThanOrEqual(1);
    expect(matched[0].severity).toBe("high");
  });
});

// ---------------------------------------------------------------------------
// XSS: Angular [innerHTML]
// ---------------------------------------------------------------------------
describe("Output Handling: Angular [innerHTML]", () => {
  test("detects Angular innerHTML binding", () => {
    const skill = mockSkill(
      `
<div [innerHTML]="dynamicContent"></div>
`,
      "component.html",
    );
    const findings = checkOutputHandling(skill);
    const matched = findings.filter((f) => f.id.startsWith("OUT-007"));
    expect(matched.length).toBeGreaterThanOrEqual(1);
    expect(matched[0].severity).toBe("medium");
  });
});

// ---------------------------------------------------------------------------
// Path traversal in file writes
// ---------------------------------------------------------------------------
describe("Output Handling: path traversal in file writes", () => {
  test("detects writeFile with template literal path", () => {
    // biome-ignore lint/suspicious/noTemplateCurlyInString: intentional test fixture
    const skill = mockSkill("writeFile(`/uploads/${userInput}.txt`, data, cb);");
    const findings = checkOutputHandling(skill);
    const matched = findings.filter((f) => f.id.startsWith("OUT-020"));
    expect(matched.length).toBeGreaterThanOrEqual(1);
    expect(matched[0].severity).toBe("high");
  });

  test("detects writeFileSync with concatenated path", () => {
    const skill = mockSkill(`writeFileSync("/uploads/" + name, data);`);
    const findings = checkOutputHandling(skill);
    const matched = findings.filter((f) => f.id.startsWith("OUT-020"));
    expect(matched.length).toBeGreaterThanOrEqual(1);
  });

  test("detects createWriteStream with dynamic path", () => {
    // biome-ignore lint/suspicious/noTemplateCurlyInString: intentional test fixture
    const skill = mockSkill("createWriteStream(`/tmp/${filename}`);");
    const findings = checkOutputHandling(skill);
    const matched = findings.filter((f) => f.id.startsWith("OUT-020"));
    expect(matched.length).toBeGreaterThanOrEqual(1);
  });

  test("detects user input in path.join", () => {
    const skill = mockSkill(`
const filePath = path.join(baseDir, userInput);
`);
    const findings = checkOutputHandling(skill);
    const matched = findings.filter((f) => f.id.startsWith("OUT-021"));
    expect(matched.length).toBeGreaterThanOrEqual(1);
    expect(matched[0].severity).toBe("high");
  });
});

// ---------------------------------------------------------------------------
// Open redirect patterns
// ---------------------------------------------------------------------------
describe("Output Handling: open redirect", () => {
  test("detects res.redirect with user-controlled URL", () => {
    const skill = mockSkill(`
res.redirect(url);
`);
    const findings = checkOutputHandling(skill);
    const matched = findings.filter((f) => f.id.startsWith("OUT-032"));
    expect(matched.length).toBeGreaterThanOrEqual(1);
    expect(matched[0].severity).toBe("high");
  });

  test("detects res.redirect with req param", () => {
    const skill = mockSkill(`
res.redirect(req.query.next);
`);
    const findings = checkOutputHandling(skill);
    const matched = findings.filter((f) => f.id.startsWith("OUT-032"));
    expect(matched.length).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// Response injection
// ---------------------------------------------------------------------------
describe("Output Handling: response injection", () => {
  test("detects unsanitized data in res.send", () => {
    const skill = mockSkill(`
res.send(input);
`);
    const findings = checkOutputHandling(skill);
    const matched = findings.filter((f) => f.id.startsWith("OUT-030"));
    expect(matched.length).toBeGreaterThanOrEqual(1);
    expect(matched[0].severity).toBe("medium");
  });

  test("detects user input in res.json", () => {
    const skill = mockSkill(`
res.json(body);
`);
    const findings = checkOutputHandling(skill);
    const matched = findings.filter((f) => f.id.startsWith("OUT-030"));
    expect(matched.length).toBeGreaterThanOrEqual(1);
  });

  test("detects user input in HTTP response headers via template literal", () => {
    // biome-ignore lint/suspicious/noTemplateCurlyInString: intentional test fixture
    const skill = mockSkill("res.setHeader(`X-${param}`, value);");
    const findings = checkOutputHandling(skill);
    const matched = findings.filter((f) => f.id.startsWith("OUT-031"));
    expect(matched.length).toBeGreaterThanOrEqual(1);
    expect(matched[0].severity).toBe("high");
  });
});

// ---------------------------------------------------------------------------
// Template output risks: EJS
// ---------------------------------------------------------------------------
describe("Output Handling: EJS template output", () => {
  test("detects unescaped EJS output with user data", () => {
    const skill = mockSkill(
      `
<p><%- input %></p>
`,
      "page.ejs",
    );
    const findings = checkOutputHandling(skill);
    const matched = findings.filter((f) => f.id.startsWith("OUT-040"));
    expect(matched.length).toBeGreaterThanOrEqual(1);
    expect(matched[0].severity).toBe("high");
  });

  test("detects escaped EJS with user variable (still flagged)", () => {
    const skill = mockSkill(
      `
<p><%= query %></p>
`,
      "page.ejs",
    );
    const findings = checkOutputHandling(skill);
    const matched = findings.filter((f) => f.id.startsWith("OUT-040"));
    expect(matched.length).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// Template output risks: Handlebars / safe filter
// ---------------------------------------------------------------------------
describe("Output Handling: template safe filter", () => {
  test("detects Jinja2/Nunjucks safe filter", () => {
    const skill = mockSkill(
      `
{{ content|safe }}
`,
      "template.html",
    );
    const findings = checkOutputHandling(skill);
    const matched = findings.filter((f) => f.id.startsWith("OUT-041"));
    expect(matched.length).toBeGreaterThanOrEqual(1);
    expect(matched[0].severity).toBe("high");
  });

  test("detects Blade unescaped output", () => {
    const skill = mockSkill(
      `
{!! $userContent !!}
`,
      "view.html",
    );
    const findings = checkOutputHandling(skill);
    const matched = findings.filter((f) => f.id.startsWith("OUT-042"));
    expect(matched.length).toBeGreaterThanOrEqual(1);
    expect(matched[0].severity).toBe("high");
  });
});

// ---------------------------------------------------------------------------
// Missing CSP headers
// ---------------------------------------------------------------------------
describe("Output Handling: CSP headers", () => {
  test("detects unsafe-inline in CSP", () => {
    const skill = mockSkill(`
const app = express();
app.use((req, res) => {
  res.setHeader("Content-Security-Policy", "script-src 'unsafe-inline'");
});
`);
    const findings = checkOutputHandling(skill);
    const matched = findings.filter((f) => f.id.startsWith("OUT-050"));
    expect(matched.length).toBeGreaterThanOrEqual(1);
    expect(matched[0].severity).toBe("medium");
  });

  test("detects unsafe-eval in CSP", () => {
    const skill = mockSkill(`
const app = express();
app.use((req, res) => {
  res.setHeader("Content-Security-Policy", "script-src 'unsafe-eval'");
});
`);
    const findings = checkOutputHandling(skill);
    const matched = findings.filter((f) => f.id.startsWith("OUT-050"));
    expect(matched.length).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// Missing X-Content-Type-Options
// ---------------------------------------------------------------------------
describe("Output Handling: missing X-Content-Type-Options", () => {
  test("detects server without nosniff header", () => {
    const skill = mockSkill(`
const app = express();
app.get("/data", (req, res) => {
  res.json({ ok: true });
});
`);
    const findings = checkOutputHandling(skill);
    const matched = findings.filter((f) => f.id.startsWith("OUT-060"));
    expect(matched.length).toBeGreaterThanOrEqual(1);
    expect(matched[0].severity).toBe("low");
  });

  test("no finding when helmet is used", () => {
    const skill = mockSkill(`
const app = express();
app.use(helmet());
app.get("/data", (req, res) => {
  res.json({ ok: true });
});
`);
    const findings = checkOutputHandling(skill);
    const matched = findings.filter((f) => f.id.startsWith("OUT-060"));
    expect(matched.length).toBe(0);
  });

  test("no finding when nosniff header is set", () => {
    const skill = mockSkill(`
const app = express();
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  next();
});
app.get("/data", (req, res) => {
  res.json({ ok: true });
});
`);
    const findings = checkOutputHandling(skill);
    const matched = findings.filter((f) => f.id.startsWith("OUT-060"));
    expect(matched.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Clean code negatives
// ---------------------------------------------------------------------------
describe("Output Handling: clean code produces no findings", () => {
  test("safe DOM manipulation with textContent", () => {
    const skill = mockSkill(`
element.textContent = userContent;
`);
    const findings = checkOutputHandling(skill);
    expect(findings.length).toBe(0);
  });

  test("parameterized query with no output issues", () => {
    const skill = mockSkill(`
const result = db.query("SELECT * FROM users WHERE id = ?", [userId]);
console.log(result);
`);
    const findings = checkOutputHandling(skill);
    expect(findings.length).toBe(0);
  });

  test("static file read with safe path", () => {
    const skill = mockSkill(`
const data = readFileSync("./config.json", "utf-8");
const config = JSON.parse(data);
`);
    const findings = checkOutputHandling(skill);
    expect(findings.length).toBe(0);
  });

  test("unsupported file extension is skipped", () => {
    const skill = mockSkill(`element.innerHTML = danger;`, "image.png");
    const findings = checkOutputHandling(skill);
    expect(findings.length).toBe(0);
  });

  test("code in block comments is ignored", () => {
    const skill = mockSkill(`
/*
  element.innerHTML = dangerousContent;
  document.write(stuff);
*/
const safe = 42;
`);
    const findings = checkOutputHandling(skill);
    const xss = findings.filter((f) => f.id.startsWith("OUT-001") || f.id.startsWith("OUT-004"));
    expect(xss.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Finding structure validation
// ---------------------------------------------------------------------------
describe("Output Handling: finding structure", () => {
  test("every finding has required fields", () => {
    const skill = mockSkill(`
element.innerHTML = data;
document.write(content);
res.send(userInput);
`);
    const findings = checkOutputHandling(skill);
    expect(findings.length).toBeGreaterThanOrEqual(1);

    for (const f of findings) {
      expect(f.id).toBeDefined();
      expect(f.rule).toBe("output-handling");
      expect(f.severity).toBeDefined();
      expect(f.category).toBe("insecure-output");
      expect(f.title).toBeDefined();
      expect(f.description).toBeDefined();
      expect(typeof f.title).toBe("string");
      expect(typeof f.description).toBe("string");
      expect(f.remediation).toBeDefined();
    }
  });

  test("findings have unique ids", () => {
    const skill = mockSkill(`
el1.innerHTML = a;
el2.innerHTML = b;
el3.innerHTML = c;
`);
    const findings = checkOutputHandling(skill);
    const ids = findings.map((f) => f.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  test("reports correct line numbers", () => {
    const skill = mockSkill(`const a = 1;
const b = 2;
element.innerHTML = danger;
const c = 3;
`);
    const findings = checkOutputHandling(skill);
    const matched = findings.filter((f) => f.id.startsWith("OUT-001"));
    expect(matched.length).toBeGreaterThanOrEqual(1);
    expect(matched[0].line).toBe(3);
    expect(matched[0].file).toBe("index.ts");
  });
});
