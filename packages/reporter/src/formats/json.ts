/**
 * JSON report formatter.
 *
 * Outputs the full AuditReport as pretty-printed JSON, suitable for
 * piping into other tools or storing as an artifact.
 *
 * Privacy contract: the JSON output regularly gets checked into CI artifact
 * storage, posted to issue trackers, or forwarded into Slack — the same
 * exfiltration channels that motivate AST-W11 (Key Material in Memory/Logs).
 * Before serializing, we redact key-shaped substrings inside each file's raw
 * `content` field. The audit *findings* already store redacted evidence; this
 * pass closes the gap for the file-content blob the report includes for
 * provenance.
 */

import type { AuditReport, SkillFile } from "@agentsec/shared";

const HEX_PREFIXED_RE = /0x[a-fA-F0-9]{64}\b/g;
const HEX_BARE_RE = /\b[a-fA-F0-9]{64}\b/g;
const MNEMONIC_RE = /\b(?:[a-z]+\s){11,23}[a-z]+\b/g;

const redactContent = (content: string): string => {
  if (!content) return content;
  let out = content;
  out = out.replace(HEX_PREFIXED_RE, "0x[REDACTED-32B]");
  out = out.replace(HEX_BARE_RE, "[REDACTED-32B]");
  out = out.replace(MNEMONIC_RE, "[REDACTED-MNEMONIC]");
  return out;
};

const redactFile = (f: SkillFile): SkillFile => ({
  ...f,
  content: redactContent(f.content),
});

export const formatJson = (report: AuditReport): string => {
  const sanitized: AuditReport = {
    ...report,
    skills: report.skills.map((r) => ({
      ...r,
      skill: { ...r.skill, files: r.skill.files.map(redactFile) },
    })),
  };
  return JSON.stringify(sanitized, null, 2);
};
