import type { AgentSkill, SecurityFinding, SkillFile } from "@agent-audit/shared";
import { getEvidenceLine, getLineNumber, isInComment } from "./utils";

/**
 * Rule: Skill Injection (AST-01)
 *
 * Detects prompt injection vectors including eval/exec usage,
 * dynamic code generation, template injection, and unsanitized
 * interpolation of external inputs into prompts or commands.
 */

interface PatternDef {
  pattern: RegExp;
  id: string;
  title: string;
  description: string;
  severity: SecurityFinding["severity"];
  remediation: string;
}

const EVAL_EXEC_PATTERNS: PatternDef[] = [
  {
    pattern: /\beval\s*\(/g,
    id: "INJ-001",
    title: "Use of eval() detected",
    description:
      "eval() executes arbitrary code at runtime and is a primary injection vector. An attacker can craft input that escapes the intended context and executes arbitrary commands.",
    severity: "critical",
    remediation:
      "Replace eval() with a safe parser (e.g., JSON.parse for data, a sandboxed interpreter for expressions). Never pass user-controlled strings to eval.",
  },
  {
    pattern: /\bnew\s+Function\s*\(/g,
    id: "INJ-002",
    title: "Dynamic Function constructor detected",
    description:
      "The Function constructor creates functions from strings at runtime, equivalent to eval(). It can execute injected code if inputs are not strictly validated.",
    severity: "critical",
    remediation:
      "Avoid the Function constructor. Use pre-defined functions or a safe expression evaluator instead.",
  },
  {
    pattern: /\bexec\s*\(|child_process|\.exec\s*\(|\.execSync\s*\(/g,
    id: "INJ-003",
    title: "Shell command execution detected",
    description:
      "Direct shell execution functions are vulnerable to command injection. Untrusted input concatenated into shell commands can allow arbitrary command execution.",
    severity: "critical",
    remediation:
      "Use execFile/execFileSync with argument arrays instead of exec. Validate and sanitize all inputs. Consider using a purpose-built library for the specific task.",
  },
  {
    pattern: /\bspawn(?:Sync)?\s*\(|\.spawnSync\s*\(/g,
    id: "INJ-004",
    title: "Process spawn detected",
    description:
      "Process spawning can be exploited if command arguments are derived from untrusted input without validation.",
    severity: "high",
    remediation:
      "Ensure all arguments passed to spawn are from a validated allowlist. Never interpolate user input directly into command arguments.",
  },
  {
    pattern: /child_process\s*[.]\s*exec\s*\(\s*`/g,
    id: "INJ-005",
    title: "Template literal in shell execution",
    description:
      "Template literals used in shell commands are especially dangerous because they make string interpolation of untrusted input easy to introduce accidentally.",
    severity: "critical",
    remediation:
      "Never use template literals for shell commands. Use execFile with an explicit argument array.",
  },
];

const TEMPLATE_INJECTION_PATTERNS: PatternDef[] = [
  {
    pattern: /\$\{[^}]*\b(user|input|query|request|prompt|message|data|param|arg|body)\b[^}]*\}/gi,
    id: "INJ-010",
    title: "Untrusted variable interpolation in template",
    description:
      "User-controlled variables are interpolated into template literals without sanitization. This can allow prompt injection or command injection depending on context.",
    severity: "high",
    remediation:
      "Sanitize and validate all external inputs before interpolation. Use parameterized queries or structured data passing instead of string interpolation.",
  },
  {
    pattern: /`[^`]*\$\{[^}]*\}[^`]*`\s*(?:\.replace|\.replaceAll)\s*\(/g,
    id: "INJ-011",
    title: "Template with dynamic replacement",
    description:
      "Templates that combine interpolation with dynamic string replacements increase the attack surface for injection, especially when replacement values come from external sources.",
    severity: "medium",
    remediation:
      "Use a structured template engine with auto-escaping. Avoid chaining string manipulations on templates containing user data.",
  },
];

const PROMPT_INJECTION_PATTERNS: PatternDef[] = [
  {
    pattern:
      /(?:prompt|system_prompt|system_message|instruction)\s*[=+]\s*.*?\b(?:user|input|query|request|message|data)\b/gi,
    id: "INJ-020",
    title: "User input concatenated into prompt",
    description:
      "User-supplied data is concatenated directly into a prompt string. An attacker can inject instructions that override the system prompt, causing the agent to perform unintended actions.",
    severity: "critical",
    remediation:
      "Use a clear separation between system instructions and user input. Apply input validation, length limits, and prompt structure that distinguishes instructions from data.",
  },
  {
    pattern: /(?:system|prompt|instruction).*?\+\s*(?:user|input|query|req\.|request|body)\b/gi,
    id: "INJ-021",
    title: "String concatenation of user input into system prompt",
    description:
      "User input is appended to system prompts via string concatenation. This is a classic prompt injection vector.",
    severity: "critical",
    remediation:
      "Use structured message arrays with separate system/user roles. Never concatenate user data into the system prompt.",
  },
  {
    pattern:
      /(?:messages|conversation)\s*\.\s*(?:push|unshift|splice)\s*\([^)]*role\s*:\s*["']system["']/g,
    id: "INJ-022",
    title: "Dynamic system message injection",
    description:
      "System messages are dynamically added to the conversation, which could be exploited if the content is influenced by user input.",
    severity: "high",
    remediation:
      "Only allow system messages from a static, trusted configuration. Validate that no user-controlled data flows into system role messages.",
  },
];

const DYNAMIC_CODE_PATTERNS: PatternDef[] = [
  {
    pattern: /require\s*\(\s*(?:user|input|query|req|data|param|arg|body)\b/gi,
    id: "INJ-030",
    title: "Dynamic require with user input",
    description:
      "Using user-controlled values in require() allows an attacker to load arbitrary modules, potentially executing malicious code.",
    severity: "critical",
    remediation:
      "Use a static module map and validate the requested module against an explicit allowlist.",
  },
  {
    pattern: /import\s*\(\s*(?:user|input|query|req|data|param|arg|body)\b/gi,
    id: "INJ-031",
    title: "Dynamic import with user input",
    description:
      "Dynamic import() with user-controlled paths enables arbitrary code loading at runtime.",
    severity: "critical",
    remediation:
      "Validate import paths against a strict allowlist. Never pass user input directly to dynamic import().",
  },
  {
    pattern: /\bvm\s*\.\s*(?:runInNewContext|runInThisContext|createContext|Script)\s*\(/g,
    id: "INJ-032",
    title: "Node.js VM module usage detected",
    description:
      "The vm module does not provide a true security sandbox. Code running in a vm context can escape and access the host process.",
    severity: "high",
    remediation:
      "Use a hardened sandbox like isolated-vm or vm2 (with awareness of its CVEs). For untrusted code, run in a separate process with minimal privileges or use a WASM sandbox.",
  },
  {
    pattern: /(?:document|window)\s*\.\s*(?:write|writeln)\s*\(/g,
    id: "INJ-033",
    title: "document.write usage detected",
    description:
      "document.write injects raw HTML into the page and is a classic XSS vector when combined with user input.",
    severity: "high",
    remediation:
      "Use DOM manipulation methods (createElement, textContent) or a framework with auto-escaping.",
  },
  {
    pattern: /\.innerHTML\s*=\s*/g,
    id: "INJ-034",
    title: "innerHTML assignment detected",
    description:
      "Setting innerHTML with unsanitized data enables XSS. Script tags or event handlers in the assigned HTML will execute.",
    severity: "high",
    remediation:
      "Use textContent for plain text. If HTML is required, sanitize with DOMPurify or a similar library.",
  },
];

const SQL_NOSQL_INJECTION_PATTERNS: PatternDef[] = [
  {
    pattern: /(?:query|execute|raw|sql)\s*\(\s*(?:`[^`]*\$\{|['"][^'"]*['"]\s*\+)/g,
    id: "INJ-040",
    title: "SQL query with string interpolation",
    description:
      "SQL queries constructed via string interpolation or concatenation are vulnerable to SQL injection when user input is included.",
    severity: "critical",
    remediation:
      "Use parameterized queries or prepared statements. ORMs with parameter binding are also acceptable.",
  },
  {
    pattern: /\$where\s*:|\.find\s*\(\s*\{[^}]*\$(?:gt|lt|ne|in|nin|regex|where|or|and)\b/g,
    id: "INJ-041",
    title: "NoSQL injection pattern detected",
    description:
      "MongoDB query operators used with potentially untrusted input can enable NoSQL injection attacks.",
    severity: "high",
    remediation:
      "Validate and type-check all query parameters. Use mongo-sanitize or explicitly cast input types before use in queries.",
  },
];

const ALL_PATTERNS: PatternDef[] = [
  ...EVAL_EXEC_PATTERNS,
  ...TEMPLATE_INJECTION_PATTERNS,
  ...PROMPT_INJECTION_PATTERNS,
  ...DYNAMIC_CODE_PATTERNS,
  ...SQL_NOSQL_INJECTION_PATTERNS,
];

function isInString(content: string, index: number): boolean {
  // Check if "eval" etc. appear as part of a string like "don't use eval()"
  const lineStart = content.lastIndexOf("\n", index) + 1;
  const lineContent = content.slice(lineStart, content.indexOf("\n", index));
  // Simple heuristic: if the identifier appears inside a quoted string context
  // that looks like documentation rather than code
  if (/^\s*\*/.test(lineContent)) return true; // JSDoc line
  if (/^\s*#/.test(lineContent)) return true; // Python comment
  return false;
}

const SCANNABLE_EXTENSIONS = new Set([
  "ts",
  "tsx",
  "js",
  "jsx",
  "mjs",
  "cjs",
  "py",
  "rb",
  "go",
  "rs",
  "java",
  "kt",
  "sh",
  "bash",
  "zsh",
  "fish",
  "yaml",
  "yml",
  "json",
  "toml",
  "md",
  "mdx",
]);

function shouldScanFile(file: SkillFile): boolean {
  const ext = file.relativePath.split(".").pop()?.toLowerCase() ?? "";
  return SCANNABLE_EXTENSIONS.has(ext);
}

export function checkInjection(skill: AgentSkill): SecurityFinding[] {
  const findings: SecurityFinding[] = [];
  let counter = 0;

  for (const file of skill.files) {
    if (!shouldScanFile(file)) continue;

    for (const def of ALL_PATTERNS) {
      // Reset regex lastIndex for global patterns
      def.pattern.lastIndex = 0;
      let match: RegExpExecArray | null;

      // biome-ignore lint/suspicious/noAssignInExpressions: idiomatic regex iteration
      while ((match = def.pattern.exec(file.content)) !== null) {
        if (isInComment(file.content, match.index)) continue;
        if (isInString(file.content, match.index)) continue;

        counter++;
        findings.push({
          id: `${def.id}-${counter}`,
          rule: "injection",
          severity: def.severity,
          category: "skill-injection",
          title: def.title,
          description: def.description,
          file: file.relativePath,
          line: getLineNumber(file.content, match.index),
          evidence: getEvidenceLine(file.content, match.index),
          remediation: def.remediation,
        });
      }
    }

    // Additional heuristic: look for unsanitized user input flowing into
    // dangerous sinks without validation
    checkDataFlowPatterns(file, findings, counter);
  }

  return findings;
}

function checkDataFlowPatterns(
  file: SkillFile,
  findings: SecurityFinding[],
  _counter: number,
): void {
  const lines = file.content.split("\n");
  let findingCount = _counter;

  // Track variables assigned from user input
  const taintedVars = new Set<string>();
  const inputPatterns =
    /(?:const|let|var)\s+(\w+)\s*=\s*(?:req\.(?:body|query|params|headers)|process\.env|input|args|argv|userInput|request\.|ctx\.(?:body|query|params))/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Track tainted variables
    const inputMatch = line.match(inputPatterns);
    if (inputMatch) {
      taintedVars.add(inputMatch[1]);
    }

    // Check if tainted vars flow into dangerous sinks
    for (const varName of taintedVars) {
      const sinkPatterns = [
        new RegExp(`eval\\s*\\(.*\\b${varName}\\b`),
        new RegExp(`exec\\s*\\(.*\\b${varName}\\b`),
        new RegExp(`\\.query\\s*\\(.*\\b${varName}\\b`),
        new RegExp(`\\.execute\\s*\\(.*\\b${varName}\\b`),
        new RegExp(`innerHTML\\s*=.*\\b${varName}\\b`),
      ];

      for (const sink of sinkPatterns) {
        if (sink.test(line)) {
          findingCount++;
          findings.push({
            id: `INJ-050-${findingCount}`,
            rule: "injection",
            severity: "critical",
            category: "skill-injection",
            title: "Tainted input flows into dangerous sink",
            description: `Variable '${varName}' is assigned from user input and flows into a dangerous function without sanitization. This is a confirmed injection vulnerability.`,
            file: file.relativePath,
            line: i + 1,
            evidence: line.trim(),
            remediation:
              "Validate and sanitize the input before passing it to this function. Use parameterized APIs when available.",
          });
        }
      }
    }
  }
}
