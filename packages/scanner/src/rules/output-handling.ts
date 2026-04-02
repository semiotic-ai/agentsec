import type { AgentSkill, SecurityFinding, SkillFile } from "@agent-audit/shared";
import { getEvidenceLine, getLineNumber, isInComment } from "./utils";

/**
 * Rule: Insecure Output Handling (AST-03)
 *
 * Checks for XSS vectors, path traversal in outputs, unsafe content
 * rendering, and missing output encoding/escaping when skill output
 * is rendered in a UI or written to files.
 */

interface OutputPattern {
  pattern: RegExp;
  id: string;
  title: string;
  description: string;
  severity: SecurityFinding["severity"];
  remediation: string;
}

const XSS_PATTERNS: OutputPattern[] = [
  {
    pattern: /\.innerHTML\s*=\s*(?!['"]<\w+\s*\/?>['"])/g,
    id: "OUT-001",
    title: "innerHTML assignment without sanitization",
    description:
      "Setting innerHTML with dynamic content enables XSS. If the content comes from an agent's response or external source, injected scripts will execute.",
    severity: "high",
    remediation:
      "Use textContent for plain text. If HTML rendering is required, sanitize with DOMPurify: element.innerHTML = DOMPurify.sanitize(content).",
  },
  {
    pattern: /\.outerHTML\s*=\s*/g,
    id: "OUT-002",
    title: "outerHTML assignment detected",
    description:
      "outerHTML replacement with dynamic content is an XSS vector similar to innerHTML.",
    severity: "high",
    remediation: "Avoid outerHTML assignment with dynamic data. Use safe DOM APIs.",
  },
  {
    pattern: /\.insertAdjacentHTML\s*\(/g,
    id: "OUT-003",
    title: "insertAdjacentHTML usage detected",
    description:
      "insertAdjacentHTML parses and inserts raw HTML. Without sanitization, it is an XSS vector.",
    severity: "high",
    remediation:
      "Sanitize HTML content before passing to insertAdjacentHTML. Use DOMPurify or equivalent.",
  },
  {
    pattern: /document\.write\s*\(|document\.writeln\s*\(/g,
    id: "OUT-004",
    title: "document.write/writeln detected",
    description: "document.write injects raw HTML into the page and is a classic XSS vector.",
    severity: "high",
    remediation: "Replace document.write with DOM manipulation methods.",
  },
  {
    pattern: /dangerouslySetInnerHTML\s*=\s*\{/g,
    id: "OUT-005",
    title: "React dangerouslySetInnerHTML usage",
    description:
      "dangerouslySetInnerHTML bypasses React's built-in XSS protection and renders raw HTML. If the content includes agent output, it can lead to XSS.",
    severity: "high",
    remediation:
      "Avoid dangerouslySetInnerHTML. If unavoidable, sanitize with DOMPurify before rendering.",
  },
  {
    pattern: /\bv-html\s*=/g,
    id: "OUT-006",
    title: "Vue v-html directive usage",
    description:
      "Vue's v-html directive renders raw HTML without escaping, creating an XSS risk when used with dynamic data.",
    severity: "high",
    remediation:
      "Use v-text or {{ }} interpolation for text. If HTML is needed, sanitize the content first.",
  },
  {
    pattern: /\[innerHTML\]\s*=\s*/g,
    id: "OUT-007",
    title: "Angular innerHTML binding",
    description:
      "Angular's [innerHTML] binding renders HTML content. While Angular sanitizes by default, it can be bypassed with bypassSecurityTrustHtml.",
    severity: "medium",
    remediation:
      "Rely on Angular's built-in sanitization. Never use bypassSecurityTrustHtml with untrusted data.",
  },
  {
    pattern: /bypassSecurityTrust(?:Html|Script|Style|Url|ResourceUrl)\s*\(/g,
    id: "OUT-008",
    title: "Angular security bypass detected",
    description:
      "bypassSecurityTrust* methods explicitly disable Angular's built-in XSS protection. Using these with agent output is extremely dangerous.",
    severity: "critical",
    remediation:
      "Remove bypassSecurityTrust calls. Restructure to work within Angular's default sanitization.",
  },
];

const PATH_TRAVERSAL_PATTERNS: OutputPattern[] = [
  {
    pattern:
      /(?:writeFile|writeFileSync|createWriteStream|appendFile|appendFileSync)\s*\(\s*(?:`[^`]*\$\{|[^,)]*\+)/g,
    id: "OUT-020",
    title: "Dynamic file path in write operation",
    description:
      "File write operations with dynamically constructed paths are vulnerable to path traversal. An attacker could write to arbitrary locations using '../' sequences.",
    severity: "high",
    remediation:
      "Use path.resolve() and verify the resolved path is within the intended directory. Reject paths containing '..' components.",
  },
  {
    pattern: /path\s*\.\s*join\s*\([^)]*(?:user|input|query|req|data|param|arg|body|name)\b/gi,
    id: "OUT-021",
    title: "User input in path.join",
    description:
      "User-controlled input in path.join can introduce path traversal sequences. path.join does not prevent '..' from escaping the base directory.",
    severity: "high",
    remediation:
      "After path.join, use path.resolve() and verify the result starts with the intended base directory. Use path.normalize() and reject '..' sequences.",
  },
  {
    pattern:
      /(?:Content-Disposition|filename)\s*[=:]\s*(?:`[^`]*\$\{|[^;,\n]*\+\s*(?:user|input|query|req|data|param|arg|body|name)\b)/gi,
    id: "OUT-022",
    title: "User input in Content-Disposition filename",
    description:
      "User-controlled data in Content-Disposition headers can cause file writes to unexpected locations or overwrite important files on the client side.",
    severity: "medium",
    remediation:
      "Sanitize filenames by removing path separators and special characters. Use a library like sanitize-filename.",
  },
];

const RESPONSE_INJECTION_PATTERNS: OutputPattern[] = [
  {
    pattern:
      /res\.(?:send|json|write|end)\s*\(\s*(?:user|input|query|req|data|param|arg|body|err|error)\b/gi,
    id: "OUT-030",
    title: "Unsanitized data in HTTP response",
    description:
      "User input or error objects are sent directly in HTTP responses without sanitization. This can leak sensitive information or enable response injection.",
    severity: "medium",
    remediation:
      "Sanitize all response data. Remove internal error details, stack traces, and system information before sending responses.",
  },
  {
    pattern:
      /res\.setHeader\s*\(\s*(?:`[^`]*\$\{|[^,)]*\+\s*(?:user|input|query|req|data|param)\b)/gi,
    id: "OUT-031",
    title: "User input in HTTP response headers",
    description:
      "User-controlled data in response headers can enable HTTP header injection, leading to response splitting, cache poisoning, or XSS via headers.",
    severity: "high",
    remediation:
      "Never include user input in response headers. If necessary, strictly validate and sanitize the value. Remove newline characters to prevent response splitting.",
  },
  {
    pattern: /res\.redirect\s*\(\s*(?:user|input|query|req|data|param|arg|body|url)\b/gi,
    id: "OUT-032",
    title: "Open redirect vulnerability",
    description:
      "Redirecting to a user-controlled URL without validation enables phishing attacks. An attacker can craft a URL that redirects to a malicious site.",
    severity: "high",
    remediation:
      "Validate redirect URLs against an allowlist of permitted domains. Use relative redirects when possible. Never redirect to user-provided URLs without validation.",
  },
];

const TEMPLATE_OUTPUT_PATTERNS: OutputPattern[] = [
  {
    pattern: /(?:<%=|<%-)\s*(?:user|input|query|req|data|param|arg|body)\b/gi,
    id: "OUT-040",
    title: "Unescaped EJS template output",
    description:
      "EJS templates using <%- %> output raw HTML without escaping. If the data contains user input or agent output, this is an XSS vulnerability.",
    severity: "high",
    remediation: "Use <%= %> (with escaping) instead of <%- %> for all user-controlled data.",
  },
  {
    pattern: /\|\s*safe\b|\{\{.*?\|safe\s*\}\}/g,
    id: "OUT-041",
    title: "Template safe filter bypasses escaping",
    description:
      "The 'safe' filter in template engines (Jinja2, Nunjucks) marks content as safe HTML, bypassing auto-escaping.",
    severity: "high",
    remediation:
      "Remove the |safe filter from any content that may contain user input or agent output.",
  },
  {
    pattern: /\{!!\s*.*?\s*!!\}/g,
    id: "OUT-042",
    title: "Laravel/Blade unescaped output",
    description:
      "Blade's {!! !!} syntax outputs raw HTML without escaping. Use {{ }} for auto-escaping.",
    severity: "high",
    remediation: "Use {{ }} instead of {!! !!} for all user-controlled data.",
  },
];

const ALL_PATTERNS: OutputPattern[] = [
  ...XSS_PATTERNS,
  ...PATH_TRAVERSAL_PATTERNS,
  ...RESPONSE_INJECTION_PATTERNS,
  ...TEMPLATE_OUTPUT_PATTERNS,
];

export function checkOutputHandling(skill: AgentSkill): SecurityFinding[] {
  const findings: SecurityFinding[] = [];
  let counter = 0;

  for (const file of skill.files) {
    const ext = file.relativePath.split(".").pop()?.toLowerCase() ?? "";
    if (!isScannableFile(ext)) continue;

    for (const def of ALL_PATTERNS) {
      def.pattern.lastIndex = 0;
      let match: RegExpExecArray | null;

      while ((match = def.pattern.exec(file.content)) !== null) {
        if (isInComment(file.content, match.index)) continue;

        counter++;
        findings.push({
          id: `${def.id}-${counter}`,
          rule: "output-handling",
          severity: def.severity,
          category: "insecure-output",
          title: def.title,
          description: def.description,
          file: file.relativePath,
          line: getLineNumber(file.content, match.index),
          evidence: getEvidenceLine(file.content, match.index),
          remediation: def.remediation,
        });
      }
    }

    // Check for missing Content-Security-Policy
    checkCSPHeaders(file, findings);

    // Check for unsafe content type handling
    checkContentTypeHandling(file, findings);
  }

  return findings;
}

function checkCSPHeaders(file: SkillFile, findings: SecurityFinding[]): void {
  // Only check server-like files
  if (!/\b(?:createServer|express|koa|fastify|hono)\b/.test(file.content)) return;

  // Check for unsafe-inline or unsafe-eval in CSP
  const cspPattern = /(?:Content-Security-Policy|CSP)[^;]*(?:unsafe-inline|unsafe-eval)/gi;
  cspPattern.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = cspPattern.exec(file.content)) !== null) {
    findings.push({
      id: `OUT-050-${getLineNumber(file.content, match.index)}`,
      rule: "output-handling",
      severity: "medium",
      category: "insecure-output",
      title: "Unsafe Content-Security-Policy directive",
      description: "'unsafe-inline' or 'unsafe-eval' in CSP weakens XSS protection significantly.",
      file: file.relativePath,
      line: getLineNumber(file.content, match.index),
      evidence: getEvidenceLine(file.content, match.index),
      remediation:
        "Remove 'unsafe-inline' and 'unsafe-eval' from CSP. Use nonces or hashes for inline scripts.",
    });
  }
}

function checkContentTypeHandling(file: SkillFile, findings: SecurityFinding[]): void {
  // Check for MIME sniffing vulnerability
  if (
    /(?:createServer|express|app\.)/.test(file.content) &&
    !/X-Content-Type-Options/.test(file.content) &&
    !/nosniff/.test(file.content) &&
    !/helmet/.test(file.content)
  ) {
    // Only flag in files that set up servers or route handlers
    if (/\b(?:app\.(?:get|post|put|delete|use)|router\.)\s*\(/.test(file.content)) {
      findings.push({
        id: `OUT-060-${file.relativePath}`,
        rule: "output-handling",
        severity: "low",
        category: "insecure-output",
        title: "Missing X-Content-Type-Options header",
        description:
          "The server does not set X-Content-Type-Options: nosniff. This allows MIME type sniffing which can lead to XSS when serving user-uploaded content.",
        file: file.relativePath,
        evidence: "No X-Content-Type-Options header found",
        remediation:
          "Add the X-Content-Type-Options: nosniff header. Consider using the helmet middleware for Express.",
      });
    }
  }
}

function isScannableFile(ext: string): boolean {
  return [
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
    "html",
    "htm",
    "ejs",
    "pug",
    "hbs",
    "vue",
    "svelte",
  ].includes(ext);
}
