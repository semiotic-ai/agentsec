import type { AgentSkill, SecurityFinding, SkillFile } from "@agentsec/shared";
import {
  getEvidenceLine,
  getLineNumber,
  isInComment,
  PERSONAL_SIGN_RE,
  shouldScanFile,
} from "../primitives/eth";

/**
 * Rule: AST-W04 — Blind / Opaque Signing Surface
 *
 * Detects skills that funnel EIP-712 (or raw `eth_sign`) payloads to the
 * user without rendering typed fields, build typed-data payloads from
 * untrusted JSON.stringify of model output, omit canonical EIP-712
 * domain fields (chainId, verifyingContract), or downgrade to
 * `personal_sign` when `signTypedData_v4` would suffice.
 */

const CODE_EXTENSIONS = new Set(["ts", "tsx", "js", "jsx", "mjs", "cjs", "py", "go", "rs", "sol"]);
const DOC_EXTENSIONS = new Set(["md", "mdx"]);

function fileExt(file: SkillFile): string {
  return file.relativePath.split(".").pop()?.toLowerCase() ?? "";
}

function isCodeFile(file: SkillFile): boolean {
  return CODE_EXTENSIONS.has(fileExt(file));
}

function isDocFile(file: SkillFile): boolean {
  return DOC_EXTENSIONS.has(fileExt(file));
}

const TYPED_DATA_FROM_JSON_STRINGIFY_RE =
  /signTypedData[^(]*\(\s*[^,)]*JSON\.stringify\b|signTypedData[^(]*\([^)]*?\$\{\s*(?:input|user|response|message|completion|prompt)/g;

const SIGN_TYPED_DATA_CALL_RE = /\bsignTypedData\b/;

const DOMAIN_OPEN_RE = /domain\s*:\s*\{|EIP712Domain/g;

const TYPED_DATA_HELPER_IMPORT_RE =
  /(?:from\s+["']|require\s*\(\s*["'])(?:viem(?:\/[^"']*)?|ethers(?:\/utils)?|@metamask\/eth-sig-util)["']/;

const SIGN_PROMPT_LANGUAGE_RE =
  /\b(?:sign\s+this\s+message|approve\s+this\s+transaction|please\s+sign|sign\s+the\s+(?:message|transaction)|approve\s+the\s+(?:transaction|message))\b/i;

function pushFinding(
  findings: SecurityFinding[],
  partial: Omit<SecurityFinding, "rule" | "category">,
): void {
  findings.push({
    ...partial,
    rule: "web3-blind-signing",
    category: "web3-blind-signing",
  });
}

function checkPersonalSign(file: SkillFile, findings: SecurityFinding[], counter: () => number) {
  PERSONAL_SIGN_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: idiomatic regex iteration
  while ((match = PERSONAL_SIGN_RE.exec(file.content)) !== null) {
    if (isInComment(file.content, match.index)) continue;
    const n = counter();
    pushFinding(findings, {
      id: `W04-001-${n}`,
      severity: "high",
      title: "personal_sign exposed — prefer signTypedData_v4",
      description:
        "The skill calls personal_sign / eth_sign, which produces an opaque signature over a raw byte string. Users cannot verify what they are signing, and the signature can be replayed in any context. Use signTypedData_v4 with a structured domain so wallets render typed fields.",
      file: file.relativePath,
      line: getLineNumber(file.content, match.index),
      evidence: getEvidenceLine(file.content, match.index),
      remediation:
        "Replace personal_sign / eth_sign with EIP-712 signTypedData_v4. Define a typed domain (name, version, chainId, verifyingContract) and message schema so wallets can render the signing intent.",
    });
  }
}

function checkTypedDataFromUntrusted(
  file: SkillFile,
  findings: SecurityFinding[],
  counter: () => number,
) {
  TYPED_DATA_FROM_JSON_STRINGIFY_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: idiomatic regex iteration
  while ((match = TYPED_DATA_FROM_JSON_STRINGIFY_RE.exec(file.content)) !== null) {
    if (isInComment(file.content, match.index)) continue;
    const n = counter();
    pushFinding(findings, {
      id: `W04-002-${n}`,
      severity: "high",
      title: "signTypedData payload built from untrusted JSON.stringify",
      description:
        "The signTypedData call assembles its payload via JSON.stringify of a model- or user-supplied variable. The signed bytes can diverge from any preview shown to the user, enabling a model-controlled blind-signing attack.",
      file: file.relativePath,
      line: getLineNumber(file.content, match.index),
      evidence: getEvidenceLine(file.content, match.index),
      remediation:
        "Construct typed-data payloads from a fixed schema with explicitly validated fields. Render the same canonical hash the wallet will sign (e.g. via viem's hashTypedData) and present each field to the user before requesting signature.",
    });
  }
}

function checkDomainFields(file: SkillFile, findings: SecurityFinding[], counter: () => number) {
  DOMAIN_OPEN_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: idiomatic regex iteration
  while ((match = DOMAIN_OPEN_RE.exec(file.content)) !== null) {
    if (isInComment(file.content, match.index)) continue;
    const window = file.content.slice(match.index, match.index + 300);

    if (!/\bchainId\b/.test(window)) {
      const n = counter();
      pushFinding(findings, {
        id: `W04-003-${n}`,
        severity: "high",
        title: "EIP-712 domain missing chainId",
        description:
          "The EIP-712 domain object does not include a chainId field. Without chainId binding, a signature produced for one chain can be replayed on any other chain that shares the verifying contract address (e.g. counterfactual deployments or forks).",
        file: file.relativePath,
        line: getLineNumber(file.content, match.index),
        evidence: getEvidenceLine(file.content, match.index),
        remediation:
          "Always set domain.chainId to the connected wallet's current chainId. Include it in the EIP712Domain types array so the canonical hash binds the signature to a specific chain.",
      });
    }

    if (!/\bverifyingContract\b/.test(window)) {
      const n = counter();
      pushFinding(findings, {
        id: `W04-004-${n}`,
        severity: "medium",
        title: "EIP-712 domain missing verifyingContract",
        description:
          "The EIP-712 domain object does not declare a verifyingContract. Wallets and relayers cannot scope the signature to a specific deployment, increasing the chance of cross-contract replay or phishing where any contract that mirrors the type schema accepts the signature.",
        file: file.relativePath,
        line: getLineNumber(file.content, match.index),
        evidence: getEvidenceLine(file.content, match.index),
        remediation:
          "Set domain.verifyingContract to the exact address that will recover the signer. Include it in the EIP712Domain type definition so the signature is bound to that contract.",
      });
    }
  }
}

function checkMissingHelperImport(
  file: SkillFile,
  findings: SecurityFinding[],
  counter: () => number,
) {
  if (!SIGN_TYPED_DATA_CALL_RE.test(file.content)) return;
  if (TYPED_DATA_HELPER_IMPORT_RE.test(file.content)) return;

  const idx = file.content.search(SIGN_TYPED_DATA_CALL_RE);
  if (idx < 0) return;
  if (isInComment(file.content, idx)) return;

  const n = counter();
  pushFinding(findings, {
    id: `W04-005-${n}`,
    severity: "medium",
    title: "no canonical EIP-712 hasher — preview/payload may diverge",
    description:
      "The file calls signTypedData but does not import a canonical EIP-712 helper (viem, ethers/utils, or @metamask/eth-sig-util). Hand-rolled hashing routinely disagrees with the wallet's canonicalization, so any preview the skill renders will not match the bytes the user actually signs.",
    file: file.relativePath,
    line: getLineNumber(file.content, idx),
    evidence: getEvidenceLine(file.content, idx),
    remediation:
      "Compute the typed-data hash with a vetted helper (viem's hashTypedData, ethers' TypedDataEncoder, or @metamask/eth-sig-util's TypedDataUtils.eip712Hash) and display the same hash/fields the wallet will sign.",
  });
}

function checkCrossFileBlindSign(
  skill: AgentSkill,
  findings: SecurityFinding[],
  counter: () => number,
) {
  const codeWithRawSign: SkillFile[] = [];
  const docsWithSignLanguage: SkillFile[] = [];

  for (const file of skill.files) {
    if (isCodeFile(file)) {
      PERSONAL_SIGN_RE.lastIndex = 0;
      if (PERSONAL_SIGN_RE.test(file.content)) {
        codeWithRawSign.push(file);
      }
    } else if (isDocFile(file)) {
      if (SIGN_PROMPT_LANGUAGE_RE.test(file.content)) {
        docsWithSignLanguage.push(file);
      }
    }
  }

  if (codeWithRawSign.length === 0 || docsWithSignLanguage.length === 0) return;

  for (const docFile of docsWithSignLanguage) {
    const langMatch = SIGN_PROMPT_LANGUAGE_RE.exec(docFile.content);
    const idx = langMatch ? langMatch.index : 0;
    SIGN_PROMPT_LANGUAGE_RE.lastIndex = 0;
    const n = counter();
    pushFinding(findings, {
      id: `W04-006-${n}`,
      severity: "medium",
      title: "Skill prompts user to sign while code uses raw eth_sign / personal_sign",
      description:
        "The skill's documentation tells the user to 'sign this message' or 'approve this transaction', but the signing path in code goes through eth_sign / personal_sign rather than signTypedData. The user therefore approves an opaque blob and cannot verify the action description matches the signed bytes.",
      file: docFile.relativePath,
      line: getLineNumber(docFile.content, idx),
      evidence: getEvidenceLine(docFile.content, idx),
      remediation:
        "Either downgrade the prompt language to reflect that an opaque signature is being requested, or upgrade the signing path to signTypedData_v4 with a domain and message that match the user-facing description.",
    });
  }
}

export function checkTypedData(skill: AgentSkill): SecurityFinding[] {
  const findings: SecurityFinding[] = [];
  let counter = 0;
  const next = () => ++counter;

  for (const file of skill.files) {
    if (!shouldScanFile(file.relativePath)) continue;
    if (!isCodeFile(file)) continue;

    checkPersonalSign(file, findings, next);
    checkTypedDataFromUntrusted(file, findings, next);
    checkDomainFields(file, findings, next);
    checkMissingHelperImport(file, findings, next);
  }

  checkCrossFileBlindSign(skill, findings, next);

  return findings;
}
