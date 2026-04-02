import type { AgentSkill, SecurityFinding, SkillFile } from "@agent-audit/shared";

/**
 * Rule: Denial of Service (AST-07)
 *
 * Detects denial of service vectors including unbounded loops,
 * ReDoS patterns, resource exhaustion, missing timeouts, and
 * uncontrolled recursion.
 */

interface DosPattern {
  pattern: RegExp;
  id: string;
  title: string;
  description: string;
  severity: SecurityFinding["severity"];
  remediation: string;
  /** If true, check nearby code for mitigation (break/return) */
  checkMitigation?: boolean;
}

const UNBOUNDED_LOOP_PATTERNS: DosPattern[] = [
  {
    pattern: /while\s*\(\s*true\s*\)/g,
    id: "DOS-001",
    title: "Infinite while(true) loop",
    description:
      "A while(true) loop can hang the process if the exit condition is never met. This is a denial-of-service vector if triggered by user input.",
    severity: "high",
    remediation:
      "Add a maximum iteration count or timeout. Use a for loop with a bounded upper limit.",
    checkMitigation: true,
  },
  {
    pattern: /for\s*\(\s*;\s*;\s*\)/g,
    id: "DOS-002",
    title: "Infinite for(;;) loop",
    description:
      "An infinite for loop without a termination condition. If reached with certain inputs, the process will hang indefinitely.",
    severity: "high",
    remediation: "Add explicit loop bounds and a maximum iteration count.",
    checkMitigation: true,
  },
  {
    pattern: /while\s*\(\s*(?:1|!0|!false)\s*\)/g,
    id: "DOS-003",
    title: "Infinite while loop (alternative form)",
    description:
      "An infinite loop using while(1), while(!0), or while(!false). Equivalent to while(true).",
    severity: "high",
    remediation: "Add a bounded termination condition.",
    checkMitigation: true,
  },
];

const REGEX_DOS_PATTERNS: DosPattern[] = [
  {
    pattern: /new\s+RegExp\s*\(\s*(?:user|input|query|req|data|param|arg|body)\b/gi,
    id: "DOS-010",
    title: "RegExp constructed from user input",
    description:
      "A regular expression is constructed from user input. An attacker can craft a pattern with catastrophic backtracking (ReDoS) that takes exponential time to evaluate.",
    severity: "high",
    remediation:
      "Never construct RegExp from user input. If pattern matching is needed, use string methods (includes, startsWith) or a safe regex library. If regex is unavoidable, set a timeout.",
  },
  {
    pattern: /(\.\*){2,}/g,
    id: "DOS-011",
    title: "Potentially vulnerable regex pattern",
    description:
      "A regex pattern contains multiple .* sequences that can cause catastrophic backtracking with certain inputs.",
    severity: "medium",
    remediation:
      "Simplify the regex. Use atomic groups or possessive quantifiers if available. Avoid nested quantifiers and overlapping alternatives.",
  },
  {
    pattern: /(\([^)]+[+*]\)){2,}/g,
    id: "DOS-012",
    title: "Nested quantifiers in regex",
    description:
      "The regex contains nested quantifiers (e.g., (a+)+) which is a classic ReDoS pattern. Processing time is exponential with input length.",
    severity: "high",
    remediation:
      "Remove nested quantifiers. Restructure the regex to avoid patterns like (a+)+, (a*)+, or (a+)*.",
  },
];

const RESOURCE_EXHAUSTION_PATTERNS: DosPattern[] = [
  {
    pattern: /readFileSync\s*\(\s*(?:user|input|query|req|data|param|arg|body|path)\b/gi,
    id: "DOS-020",
    title: "Unbounded file read with user-controlled path",
    description:
      "A file is read synchronously with a user-controlled path. An attacker could point to a very large file (e.g., /dev/urandom on Linux) to exhaust memory.",
    severity: "high",
    remediation:
      "Validate file paths and check file size before reading. Set a maximum file size limit. Use streaming for large files.",
  },
  {
    pattern:
      /Buffer\s*\.\s*alloc\s*\(\s*(?:user|input|query|req|data|param|arg|body|size|len|length)\b/gi,
    id: "DOS-021",
    title: "Buffer allocation with user-controlled size",
    description:
      "A buffer is allocated with a size from user input. An attacker can specify a very large size to exhaust available memory (OOM).",
    severity: "high",
    remediation: "Validate and cap the buffer size. Set a maximum allocation limit (e.g., 10MB).",
  },
  {
    pattern:
      /new\s+Array\s*\(\s*(?:user|input|query|req|data|param|arg|body|size|len|length|count|num)\b/gi,
    id: "DOS-022",
    title: "Array allocation with user-controlled size",
    description:
      "An array is allocated with a size derived from user input. Very large values can exhaust memory.",
    severity: "medium",
    remediation: "Validate and cap the array size before allocation. Set reasonable limits.",
  },
  {
    pattern: /\.repeat\s*\(\s*(?:user|input|query|req|data|param|arg|body|count|num|times)\b/gi,
    id: "DOS-023",
    title: "String repeat with user-controlled count",
    description:
      "String.prototype.repeat with a user-controlled count can create extremely large strings that exhaust memory.",
    severity: "high",
    remediation: "Validate and cap the repeat count. Set a maximum output length.",
  },
  {
    pattern: /setInterval\s*\([^,]+,\s*(?:0|1)\s*\)/g,
    id: "DOS-024",
    title: "setInterval with near-zero delay",
    description:
      "setInterval with a 0 or 1ms delay creates a tight loop that can exhaust CPU resources and starve other operations.",
    severity: "medium",
    remediation:
      "Use a reasonable interval (at least 100ms for most use cases). Consider whether setInterval is the right approach.",
  },
];

const TIMEOUT_PATTERNS: DosPattern[] = [
  {
    pattern: /(?:fetch|axios|got|request|http\.(?:get|request)|https\.(?:get|request))\s*\(/g,
    id: "DOS-030",
    title: "Network request detected (check for timeout)",
    description:
      "Network requests without timeouts can hang indefinitely if the remote server is slow or unresponsive, effectively creating a denial of service.",
    severity: "low",
    remediation:
      "Set explicit timeouts on all network requests. Use AbortController with a timeout signal for fetch().",
  },
];

const RECURSION_PATTERNS: DosPattern[] = [
  {
    pattern: /function\s+(\w+)\s*\([^)]*\)\s*\{[^}]*\b\1\s*\(/gs,
    id: "DOS-040",
    title: "Potentially unbounded recursion",
    description:
      "A function calls itself recursively. Without proper base cases and depth limits, recursive functions can exhaust the call stack.",
    severity: "medium",
    remediation:
      "Add a maximum recursion depth parameter. Ensure base cases are comprehensive. Consider an iterative approach.",
  },
];

const ALL_PATTERNS: DosPattern[] = [
  ...UNBOUNDED_LOOP_PATTERNS,
  ...REGEX_DOS_PATTERNS,
  ...RESOURCE_EXHAUSTION_PATTERNS,
  ...TIMEOUT_PATTERNS,
  ...RECURSION_PATTERNS,
];

export function checkDenialOfService(skill: AgentSkill): SecurityFinding[] {
  const findings: SecurityFinding[] = [];
  let counter = 0;

  for (const file of skill.files) {
    const ext = file.relativePath.split(".").pop()?.toLowerCase() ?? "";
    if (!isCodeFile(ext)) continue;

    for (const def of ALL_PATTERNS) {
      def.pattern.lastIndex = 0;
      let match: RegExpExecArray | null;

      while ((match = def.pattern.exec(file.content)) !== null) {
        if (isInComment(file.content, match.index)) continue;

        // Check if there's a mitigation nearby (break/return/throw)
        if (def.checkMitigation) {
          const afterMatch = file.content.substring(match.index, match.index + 500);
          if (/break\s*;|return\s|throw\s/.test(afterMatch)) continue;
        }

        counter++;
        findings.push({
          id: `${def.id}-${counter}`,
          rule: "dos",
          severity: def.severity,
          category: "denial-of-service",
          title: def.title,
          description: def.description,
          file: file.relativePath,
          line: getLineNumber(file.content, match.index),
          evidence: getEvidenceLine(file.content, match.index),
          remediation: def.remediation,
        });
      }
    }

    // Check for missing timeouts on fetch calls specifically
    checkMissingFetchTimeout(file, findings);
  }

  return findings;
}

function checkMissingFetchTimeout(file: SkillFile, findings: SecurityFinding[]): void {
  const hasFetch = /\bfetch\s*\(/.test(file.content);
  if (!hasFetch) return;

  const hasTimeout = /AbortController|signal\s*:|timeout\s*:/i.test(file.content);

  if (!hasTimeout) {
    findings.push({
      id: `DOS-TIMEOUT-${file.relativePath}`,
      rule: "dos",
      severity: "low",
      category: "denial-of-service",
      title: "fetch() calls without timeout configuration",
      description:
        "The file contains fetch() calls but no AbortController or timeout configuration. Network requests can hang indefinitely.",
      file: file.relativePath,
      remediation:
        "Use AbortController with AbortSignal.timeout() for all fetch calls. Example: fetch(url, { signal: AbortSignal.timeout(5000) }).",
    });
  }
}

function isCodeFile(ext: string): boolean {
  return ["ts", "tsx", "js", "jsx", "mjs", "cjs", "py", "rb", "go", "rs", "java", "kt"].includes(
    ext,
  );
}

function getLineNumber(content: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index && i < content.length; i++) {
    if (content[i] === "\n") line++;
  }
  return line;
}

function getEvidenceLine(content: string, index: number): string {
  const lineStart = content.lastIndexOf("\n", index) + 1;
  let lineEnd = content.indexOf("\n", index);
  if (lineEnd === -1) lineEnd = content.length;
  return content.slice(lineStart, lineEnd).trim();
}

function isInComment(content: string, index: number): boolean {
  const lineStart = content.lastIndexOf("\n", index) + 1;
  const lineUpToMatch = content.slice(lineStart, index);
  if (/\/\//.test(lineUpToMatch)) return true;
  if (/^\s*#/.test(content.slice(lineStart, index + 10))) return true;
  const before = content.slice(Math.max(0, index - 500), index);
  const lastBlockOpen = before.lastIndexOf("/*");
  const lastBlockClose = before.lastIndexOf("*/");
  if (lastBlockOpen > lastBlockClose) return true;
  return false;
}
