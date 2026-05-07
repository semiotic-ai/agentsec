import type { AgentSkill, SecurityFinding, SkillFile } from "@agentsec/shared";
import { getEvidenceLine, getLineNumber, isInComment } from "../primitives/eth";

/**
 * Rule: AST-W12 sub-rule — Skill explicitly bypasses user confirmation
 *
 * Routers and execution skills that ship a "fast path" which broadcasts
 * state-changing transactions without prompting the user (e.g.
 * KyberSwap's `*-fast` variants, 1inch's `--auto-approve`) defeat the
 * human-in-the-loop guarantee that AST-W12 requires for value-moving
 * actions. This rule fires high-severity for those patterns.
 *
 * The rule lives under the existing `web3-no-audit-killswitch` (AST-W12)
 * category — a sub-rule rather than a new top-level annex ID — so the
 * AST-W## namespace does not grow on every coverage gap we close.
 *
 * Detections:
 *  - Manifest `name` ending in `-fast` (case-insensitive).
 *  - Scanned file content matching any of: `--auto-approve`, `--no-confirm`,
 *    `--yes`, `-y` (word-bounded), or English phrases like
 *    "skip (user) confirmation", "do not / don't / no prompt",
 *    "broadcast immediately", "broadcast without confirmation",
 *    "bypass(es) user".
 *
 * Suppressor: when the same SKILL.md / README body that earned a hit
 * also carries an explicit danger warning ("EXTREMELY DANGEROUS",
 * "use only after audit", "in CI only"), the finding is downgraded
 * to `medium`. The downgrade still fires — operators must still see
 * the bypass — but it acknowledges the skill author was forthright
 * about the risk.
 */

const RULE = "web3-no-user-confirmation";
const CATEGORY = "web3-no-audit-killswitch" as const;

/** Skill names ending in `-fast` are the most common bypass shape. */
const FAST_NAME_RE = /-fast$/i;

/** CLI-flag style bypass markers. `-y` is matched word-bounded to avoid `key`. */
const FLAG_BYPASS_RE = /(?:--auto-approve|--no-confirm|--yes\b|(?<![\w-])-y\b)/i;

/** English phrases describing an unattended broadcast. */
const PHRASE_BYPASS_RE =
  /\bskip(?:s|ping)?\s+(?:(?:user|the)\s+)?confirmation\b|\bwithout\s+confirming\b|\b(?:do\s+not|don'?t|no)\s+prompt\b|\bbroadcast(?:s|ing)?\s+(?:immediately|without\s+confirmation)\b|\bbypass(?:es)?\s+user\b/i;

/** Warnings that downgrade severity but do not suppress the finding. */
const DANGER_WARNING_RE =
  /\bEXTREMELY\s+DANGEROUS\b|\buse\s+only\s+after\s+audit\b|\bin\s+CI\s+only\b/i;

/**
 * Files to inspect for bypass patterns. We deliberately accept more
 * extensions than the global {@link shouldScanFile} list: shell scripts
 * and README/CHANGELOG plain text are common carriers of bypass flags
 * in router skills (`run.sh --auto-approve`, "the fast path skips
 * confirmation"), and the rest of the annex would otherwise miss them.
 */
const SCANNABLE_EXTENSIONS = new Set([
  "ts",
  "tsx",
  "js",
  "jsx",
  "mjs",
  "cjs",
  "py",
  "go",
  "rs",
  "sol",
  "json",
  "yaml",
  "yml",
  "md",
  "mdx",
  "toml",
  "sh",
  "bash",
  "zsh",
  "txt",
]);

/** Files that are conventionally extension-less but plain-text. */
const EXTENSIONLESS_TEXT_BASENAMES = new Set(["readme", "changelog", "dockerfile"]);

function basename(relativePath: string): string {
  return (relativePath.split("/").pop() ?? "").toLowerCase();
}

function extensionOf(relativePath: string): string {
  const base = basename(relativePath);
  const dot = base.lastIndexOf(".");
  return dot === -1 ? "" : base.slice(dot + 1);
}

function shouldScan(relativePath: string): boolean {
  if (EXTENSIONLESS_TEXT_BASENAMES.has(basename(relativePath))) return true;
  return SCANNABLE_EXTENSIONS.has(extensionOf(relativePath));
}

function isProseFile(relativePath: string): boolean {
  const ext = extensionOf(relativePath);
  if (ext === "md" || ext === "mdx" || ext === "txt") return true;
  return basename(relativePath) === "readme";
}

/** Find the first regex match outside of code comments. */
function findMatch(file: SkillFile, pattern: RegExp): RegExpExecArray | null {
  const re = new RegExp(
    pattern.source,
    pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`,
  );
  let match: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: idiomatic regex iteration
  while ((match = re.exec(file.content)) !== null) {
    if (!isInComment(file.content, match.index)) return match;
  }
  return null;
}

const REMEDIATION =
  "Require explicit user confirmation before broadcasting. If a fast-path is necessary, gate it behind an explicit `--i-understand-the-risks` flag AND require a kill-switch contract.";

const TITLE = "Skill explicitly bypasses user confirmation for state-changing transactions";

/**
 * Build a description that references AST-W12 and notes the danger
 * warning if the rule downgraded the severity.
 */
function buildDescription(downgraded: boolean): string {
  const base =
    "The skill ships a fast path that broadcasts state-changing transactions without prompting the user. Human-in-the-loop is required for value-moving transactions per AST-W12; routers like KyberSwap (`*-fast`) and 1inch (`--auto-approve`) demonstrate the same anti-pattern.";
  if (!downgraded) return base;
  return `${base} The skill body acknowledges the risk with an "EXTREMELY DANGEROUS" / "use only after audit" / "in CI only" warning, so this finding is downgraded to medium severity — but the bypass remains a reportable AST-W12 issue.`;
}

export function checkConfirmationSkip(skill: AgentSkill): SecurityFinding[] {
  const findings: SecurityFinding[] = [];
  let counter = 0;

  const downgrade = skill.files.some(
    (f) => isProseFile(f.relativePath) && DANGER_WARNING_RE.test(f.content),
  );
  const severity: SecurityFinding["severity"] = downgrade ? "medium" : "high";
  const description = buildDescription(downgrade);

  const manifestName = skill.manifest.name;
  if (typeof manifestName === "string" && FAST_NAME_RE.test(manifestName)) {
    counter++;
    findings.push({
      id: `W12-040-${counter}`,
      rule: RULE,
      severity,
      category: CATEGORY,
      title: TITLE,
      description,
      evidence: `manifest.name = ${JSON.stringify(manifestName)}`,
      remediation: REMEDIATION,
    });
  }

  for (const file of skill.files) {
    if (!shouldScan(file.relativePath)) continue;

    const flagMatch = findMatch(file, FLAG_BYPASS_RE);
    if (flagMatch) {
      counter++;
      findings.push({
        id: `W12-041-${counter}`,
        rule: RULE,
        severity,
        category: CATEGORY,
        title: TITLE,
        description,
        file: file.relativePath,
        line: getLineNumber(file.content, flagMatch.index),
        evidence: getEvidenceLine(file.content, flagMatch.index),
        remediation: REMEDIATION,
      });
    }

    const phraseMatch = findMatch(file, PHRASE_BYPASS_RE);
    if (phraseMatch) {
      counter++;
      findings.push({
        id: `W12-042-${counter}`,
        rule: RULE,
        severity,
        category: CATEGORY,
        title: TITLE,
        description,
        file: file.relativePath,
        line: getLineNumber(file.content, phraseMatch.index),
        evidence: getEvidenceLine(file.content, phraseMatch.index),
        remediation: REMEDIATION,
      });
    }
  }

  return findings;
}
