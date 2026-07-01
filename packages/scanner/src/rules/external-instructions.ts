import type { AgentSkill, SecurityFinding, SkillFile } from "@agentsec/shared";
import { getEvidenceLine, getLineNumber } from "./utils";

/**
 * Rule: Untrusted External Instructions (AST-05)
 *
 * OWASP Agentic Skills Top 10 v1.0 renamed AST05 from "Unsafe Deserialization"
 * to "Untrusted External Instructions". The risk is that a skill's own
 * content — its `description`, metadata, or Markdown body — carries hidden
 * imperative instructions that hijack the agent when the skill is loaded into
 * context (indirect prompt injection / "tool poisoning"). Because the agent
 * reads this text as trusted guidance, an embedded "ignore previous
 * instructions" or a covert exfiltration directive executes silently.
 *
 * This rule scans the manifest `description`, string-valued metadata, and the
 * Markdown/text files that make up the skill for those instruction-override,
 * role-hijack, covert-action, and exfiltration patterns. It also flags the
 * Claude Code dynamic-context-injection surface (inline ``!`command` `` and
 * fenced ```` ```! ```` blocks), which executes shell commands at skill-load
 * time before the model sees the rendered content.
 */

interface InstructionPattern {
  pattern: RegExp;
  id: string;
  title: string;
  description: string;
  severity: SecurityFinding["severity"];
  remediation: string;
}

const INSTRUCTION_PATTERNS: InstructionPattern[] = [
  {
    pattern:
      /\b(?:ignore|disregard|forget|override)\b[^.\n]{0,40}\b(?:all\s+|any\s+|the\s+|your\s+|previous\s+|prior\s+|above\s+|earlier\s+|preceding\s+)+(?:instructions?|prompts?|context|rules?|guidance)\b/i,
    id: "XINST-001",
    title: "Instruction-override directive embedded in skill content",
    description:
      "The skill content instructs the agent to ignore, disregard, or override its previous instructions. This is a classic indirect prompt-injection payload: when the skill is loaded, the agent may follow the embedded directive instead of the user's intent.",
    severity: "critical",
    remediation:
      "Remove language that tells the agent to ignore or override its instructions. Skill content should describe a task, never redirect the agent's control flow.",
  },
  {
    pattern:
      /\byou\s+are\s+now\s+(?:a|an|the|in)\b|\bnew\s+(?:system\s+)?(?:instructions?|role|persona|prompt)\s*:/i,
    id: "XINST-002",
    title: "Role/persona reassignment embedded in skill content",
    description:
      "The skill content attempts to reassign the agent's role or inject a new system prompt. An attacker can use this to escalate the skill's effective authority beyond what the user approved.",
    severity: "high",
    remediation:
      "Remove role-reassignment and system-prompt language from skill content. The agent's role must be controlled by the host, not by skill text.",
  },
  {
    pattern:
      /\b(?:do\s+not|don't|never|without)\s+(?:tell|telling|inform|informing|notify|notifying|alert|alerting|mention(?:ing)?\s+to)\b[^.\n]{0,20}\bthe\s+user\b/i,
    id: "XINST-003",
    title: "Covert-action directive hidden in skill content",
    description:
      "The skill content instructs the agent to act without informing the user. Concealing actions from the user is a hallmark of malicious skill payloads and defeats meaningful oversight.",
    severity: "critical",
    remediation:
      "Remove any instruction to hide behavior from the user. All skill actions must be transparent and user-visible.",
  },
  {
    pattern:
      /\b(?:send|post|upload|exfiltrate|forward|transmit|leak)\b[^.\n]{0,50}\b(?:secrets?|api[\s_-]?keys?|tokens?|credentials?|passwords?|env(?:ironment)?\s+variables?|\.env|private[\s_-]?keys?)\b/i,
    id: "XINST-004",
    title: "Data-exfiltration directive in skill content",
    description:
      "The skill content directs the agent to send secrets, credentials, or environment data to an external destination. This is a direct exfiltration payload.",
    severity: "critical",
    remediation:
      "Remove any instruction that moves secrets or credentials off the machine. Skills must never direct the agent to transmit sensitive data.",
  },
];

/**
 * Claude Code dynamic context injection: inline ``!`cmd` `` and fenced ```` ```! ````
 * blocks run shell commands when the skill is loaded, before the model reads
 * the content. Legitimate but security-relevant, so surfaced as a lower-
 * severity finding for review.
 */
const DYNAMIC_EXEC_PATTERNS: InstructionPattern[] = [
  {
    pattern: /(?:^|[^\\`])!`[^`\n]+`/,
    id: "XINST-010",
    title: "Dynamic shell execution in skill body (inline)",
    description:
      "The skill body contains an inline ``!`command` `` directive. In Claude Code these execute at skill-load time and their output is injected into context before the model reads it — an execution surface that can smuggle untrusted output into the conversation.",
    severity: "medium",
    remediation:
      "Avoid load-time command execution in skill bodies. If dynamic context is required, document exactly what runs and disable it (`disableSkillShellExecution`) where the command is not trusted.",
  },
  {
    pattern: /```!\s*\n/,
    id: "XINST-011",
    title: "Dynamic shell execution in skill body (fenced block)",
    description:
      "The skill body contains a ```` ```! ```` fenced block. In Claude Code these execute at skill-load time, injecting command output into context before the model reads it.",
    severity: "medium",
    remediation:
      "Avoid load-time command execution in skill bodies. Prefer static content, or gate execution behind explicit user approval.",
  },
];

/** Extensions whose full content is scanned as agent-facing instructions. */
const INSTRUCTION_TEXT_EXTENSIONS = new Set(["md", "mdx", "txt", "markdown"]);

function isInstructionText(file: SkillFile): boolean {
  const ext = file.relativePath.split(".").pop()?.toLowerCase() ?? "";
  return INSTRUCTION_TEXT_EXTENSIONS.has(ext);
}

/** Collect the manifest string fields that are surfaced to the agent as guidance. */
function manifestText(skill: AgentSkill): string {
  const parts: string[] = [];
  if (skill.manifest.description) parts.push(skill.manifest.description);
  const metadata = skill.manifest.metadata;
  if (metadata && typeof metadata === "object") {
    collectStrings(metadata as Record<string, unknown>, parts);
  }
  return parts.join("\n");
}

function collectStrings(obj: Record<string, unknown>, out: string[]): void {
  for (const value of Object.values(obj)) {
    if (typeof value === "string") out.push(value);
    else if (value && typeof value === "object" && !Array.isArray(value)) {
      collectStrings(value as Record<string, unknown>, out);
    }
  }
}

export function checkExternalInstructions(skill: AgentSkill): SecurityFinding[] {
  const findings: SecurityFinding[] = [];
  let counter = 0;

  // 1. Manifest description + metadata — the highest-signal surface, since the
  //    `description` is loaded into every agent's context at startup.
  const metaText = manifestText(skill);
  for (const def of INSTRUCTION_PATTERNS) {
    if (def.pattern.test(metaText)) {
      counter++;
      findings.push({
        id: `${def.id}-meta-${counter}`,
        rule: "external-instructions",
        severity: def.severity,
        category: "untrusted-external-instructions",
        title: `${def.title} (manifest metadata)`,
        description: def.description,
        file: "SKILL.md",
        evidence: firstMatchLine(metaText, def.pattern),
        remediation: def.remediation,
      });
    }
  }

  // 2. Markdown / text files that the agent reads as instructions.
  for (const file of skill.files) {
    if (!isInstructionText(file)) continue;
    const allPatterns = [...INSTRUCTION_PATTERNS, ...DYNAMIC_EXEC_PATTERNS];

    for (const def of allPatterns) {
      const match = def.pattern.exec(file.content);
      // Reset lastIndex defensively (patterns are non-global, but guard anyway).
      def.pattern.lastIndex = 0;
      if (!match) continue;

      counter++;
      findings.push({
        id: `${def.id}-${counter}`,
        rule: "external-instructions",
        severity: def.severity,
        category: "untrusted-external-instructions",
        title: def.title,
        description: def.description,
        file: file.relativePath,
        line: getLineNumber(file.content, match.index),
        evidence: getEvidenceLine(file.content, match.index),
        remediation: def.remediation,
      });
    }
  }

  return findings;
}

/** Return the trimmed line containing the first match, for evidence display. */
function firstMatchLine(text: string, pattern: RegExp): string {
  const match = pattern.exec(text);
  pattern.lastIndex = 0;
  if (!match) return "";
  return getEvidenceLine(text, match.index);
}
