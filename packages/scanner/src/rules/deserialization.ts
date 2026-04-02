import type { AgentSkill, SecurityFinding } from "@agent-audit/shared";
import { getLineNumber, getEvidenceLine, isInComment } from "./utils";

/**
 * Rule: Unsafe Deserialization (AST-10)
 *
 * Detects unsafe deserialization patterns including JSON.parse with
 * untrusted input, YAML/pickle/Marshal deserialization, prototype
 * pollution, and other object injection vectors.
 */

interface DeserPattern {
  pattern: RegExp;
  id: string;
  title: string;
  description: string;
  severity: SecurityFinding["severity"];
  remediation: string;
}

const DESERIALIZATION_PATTERNS: DeserPattern[] = [
  {
    pattern:
      /JSON\s*\.\s*parse\s*\(\s*(?:req|request|body|input|data|user|query|params|message|payload)\b/gi,
    id: "DES-001",
    title: "JSON.parse with untrusted input",
    description:
      "JSON.parse is called on potentially untrusted input. While JSON.parse itself is safe from code execution, the resulting object may contain unexpected properties that can cause prototype pollution or logic bugs.",
    severity: "medium",
    remediation:
      "Validate the parsed JSON against a schema (e.g., zod, ajv, joi). Use a reviver function to filter unexpected properties.",
  },
  {
    pattern: /yaml\s*\.\s*(?:load|safeLoad)\s*\(/g,
    id: "DES-002",
    title: "YAML deserialization detected",
    description:
      "YAML deserialization can execute arbitrary code through custom tags (!!python/object, !!js/function). The safeLoad function is deprecated in newer yaml versions.",
    severity: "high",
    remediation:
      "Use yaml.parse() with the FAILSAFE or JSON schema. Never use yaml.load() with untrusted input.",
  },
  {
    pattern: /pickle\s*\.\s*loads?\s*\(/g,
    id: "DES-003",
    title: "Python pickle deserialization",
    description:
      "Python's pickle module can execute arbitrary code during deserialization. The pickle docs explicitly warn: 'Never unpickle data received from an untrusted source.'",
    severity: "critical",
    remediation:
      "Use JSON or a safe serialization format. If pickle is necessary, use hmac-signed data and restrict allowed classes via a custom Unpickler.",
  },
  {
    pattern: /Marshal\s*\.\s*load/g,
    id: "DES-004",
    title: "Ruby Marshal deserialization",
    description:
      "Ruby's Marshal can execute arbitrary code during deserialization. It should never be used with untrusted data.",
    severity: "high",
    remediation: "Use JSON or a safe serialization format for untrusted data.",
  },
  {
    pattern: /ObjectInputStream|readObject\s*\(\s*\)/g,
    id: "DES-005",
    title: "Java object deserialization",
    description:
      "Java object deserialization (ObjectInputStream) is a well-known RCE vector. Many CVEs exist for gadget chains in common Java libraries.",
    severity: "high",
    remediation:
      "Use JSON or Protocol Buffers instead. If Java serialization is required, use ObjectInputFilter to restrict allowed classes.",
  },
  {
    pattern: /unserialize\s*\(\s*(?:\$_|request|input|data|user|query|param)\b/gi,
    id: "DES-006",
    title: "PHP unserialize with untrusted input",
    description:
      "PHP's unserialize() with untrusted input can trigger object injection attacks through __wakeup and __destruct magic methods.",
    severity: "critical",
    remediation:
      "Use json_decode() instead of unserialize() for untrusted data. If unserialize is necessary, use the allowed_classes option.",
  },
  {
    pattern: /eval\s*\(\s*JSON\s*\.\s*stringify/g,
    id: "DES-007",
    title: "eval() used for JSON processing",
    description:
      "Using eval() to process JSON data is extremely dangerous. Use JSON.parse/JSON.stringify without eval.",
    severity: "critical",
    remediation:
      "Use JSON.parse() and JSON.stringify() directly. Never combine eval() with JSON processing.",
  },
  {
    pattern: /vm\s*\.\s*(?:runInNewContext|runInThisContext|runInContext|createScript)\s*\(/g,
    id: "DES-008",
    title: "Node.js VM module used for deserialization",
    description:
      "The Node.js vm module is used to execute serialized code. The vm module is not a security boundary and can be escaped.",
    severity: "critical",
    remediation:
      "Use a safe parser (JSON.parse, a schema-validated YAML parser). If code evaluation is necessary, use isolated-vm or a separate process.",
  },
  {
    pattern: /new\s+Function\s*\(\s*(?:data|input|body|user|request|payload)\b/gi,
    id: "DES-009",
    title: "Function constructor with untrusted input",
    description:
      "The Function constructor creates executable code from strings. With untrusted input, this enables arbitrary code execution.",
    severity: "critical",
    remediation:
      "Never create functions from untrusted strings. Use a safe expression evaluator or predefined function lookup.",
  },
  {
    pattern:
      /(?:msgpack|protobuf|avro|thrift)\s*\.\s*(?:decode|unpack|deserialize)\s*\(\s*(?:req|request|body|input|data|user)\b/gi,
    id: "DES-010",
    title: "Binary deserialization with untrusted input",
    description:
      "Binary serialization formats (msgpack, protobuf, avro) are being deserialized from untrusted input. While generally safer than pickle/Marshal, malformed input can cause crashes or unexpected behavior.",
    severity: "medium",
    remediation:
      "Validate deserialized data against a schema. Set size limits on input buffers. Handle deserialization errors gracefully.",
  },
];

const PROTOTYPE_POLLUTION_PATTERNS: DeserPattern[] = [
  {
    pattern: /\[\s*["']__proto__["']\s*\]/g,
    id: "DES-020",
    title: "__proto__ property access",
    description:
      "Direct __proto__ property access can be used for prototype pollution attacks. An attacker can inject __proto__ as a key in user input to modify the Object prototype.",
    severity: "high",
    remediation:
      "Use Object.create(null) for dictionary objects. Filter out __proto__, constructor, and prototype keys from user input.",
  },
  {
    pattern: /\.constructor\s*\.\s*prototype/g,
    id: "DES-021",
    title: "Constructor prototype manipulation",
    description:
      "Accessing constructor.prototype allows modification of the prototype chain. If reachable from user input, this enables prototype pollution.",
    severity: "high",
    remediation:
      "Validate object keys against an allowlist. Never allow user input to navigate the prototype chain.",
  },
  {
    pattern:
      /Object\s*\.\s*assign\s*\(\s*(?:target|dest|obj|result|\{\})\s*,\s*(?:req|request|body|input|data|user|query|params)\b/gi,
    id: "DES-022",
    title: "Object.assign with untrusted source",
    description:
      "Object.assign copies all enumerable properties from the source to the target. If the source is untrusted, __proto__ and constructor properties can pollute the target's prototype.",
    severity: "high",
    remediation:
      "Filter dangerous keys (__proto__, constructor, prototype) from the source object before Object.assign. Use a deep-clone library that sanitizes keys.",
  },
  {
    pattern: /(?:lodash|_)\s*\.\s*(?:merge|defaultsDeep|assign)\s*\(/g,
    id: "DES-023",
    title: "Deep merge operation (prototype pollution risk)",
    description:
      "Deep merge functions (lodash.merge, _.defaultsDeep) are known prototype pollution vectors. Older lodash versions have confirmed CVEs for this.",
    severity: "high",
    remediation:
      "Update lodash to the latest version. Consider using structuredClone() or a merge library with prototype pollution protection.",
  },
  {
    pattern:
      /(?:for\s*\(\s*(?:const|let|var)\s+\w+\s+in\s+)(?:req|request|body|input|data|user|query|params)\b/gi,
    id: "DES-024",
    title: "for...in loop over untrusted object",
    description:
      "Using for...in to iterate over untrusted objects includes inherited properties, which can lead to unexpected behavior if the prototype has been polluted.",
    severity: "medium",
    remediation:
      "Use Object.keys() or Object.entries() instead of for...in. Add a hasOwnProperty check if for...in is necessary.",
  },
];

const ALL_PATTERNS: DeserPattern[] = [...DESERIALIZATION_PATTERNS, ...PROTOTYPE_POLLUTION_PATTERNS];

export function checkUnsafeDeserialization(skill: AgentSkill): SecurityFinding[] {
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

        counter++;
        findings.push({
          id: `${def.id}-${counter}`,
          rule: "deserialization",
          severity: def.severity,
          category: "unsafe-deserialization",
          title: def.title,
          description: def.description,
          file: file.relativePath,
          line: getLineNumber(file.content, match.index),
          evidence: getEvidenceLine(file.content, match.index),
          remediation: def.remediation,
        });
      }
    }

    // Check for schema validation after deserialization
    checkSchemaValidation(file, findings);
  }

  return findings;
}

function checkSchemaValidation(
  file: { relativePath: string; content: string },
  findings: SecurityFinding[],
): void {
  // If the file uses JSON.parse, check if any schema validation library is present
  const hasJsonParse = /JSON\.parse/.test(file.content);
  if (!hasJsonParse) return;

  const hasValidation =
    /(?:zod|yup|joi|ajv|superstruct|io-ts|typebox|valibot)\b/.test(file.content) ||
    /\.validate\s*\(|\.parse\s*\(|\.safeParse\s*\(|\.assert\s*\(/.test(file.content) ||
    /typeof\s+\w+\s*(?:===|!==)\s*["'](?:string|number|boolean|object)["']/.test(file.content);

  if (!hasValidation) {
    // Count how many JSON.parse calls there are
    const parseCount = (file.content.match(/JSON\.parse/g) ?? []).length;
    if (parseCount > 1) {
      findings.push({
        id: `DES-NOSCHEMA-${file.relativePath}`,
        rule: "deserialization",
        severity: "low",
        category: "unsafe-deserialization",
        title: "JSON parsing without schema validation",
        description: `The file has ${parseCount} JSON.parse calls but no apparent schema validation. Parsed data should be validated against an expected shape to prevent injection of unexpected properties.`,
        file: file.relativePath,
        remediation:
          "Use a schema validation library (zod, ajv, joi) to validate parsed JSON against an expected structure.",
      });
    }
  }
}

function isCodeFile(ext: string): boolean {
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
    "php",
  ].includes(ext);
}
