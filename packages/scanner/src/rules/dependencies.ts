import type { AgentSkill, SecurityFinding } from "@agent-audit/shared";

/**
 * Rule: Dependency Vulnerabilities (AST-04)
 *
 * Analyzes dependency declarations for known vulnerabilities,
 * typosquatting risks, excessive dependency counts, and
 * use of deprecated or unmaintained packages.
 */

// Well-known typosquatting targets and their common misspellings
const TYPOSQUAT_TARGETS: Record<string, string[]> = {
  lodash: ["Iodash", "l0dash", "lodahs", "lodasb", "loddash", "lodassh"],
  express: ["expres", "expresss", "exppress", "exress", "expess"],
  react: ["raect", "recat", "reat", "reactt", "reacct"],
  axios: ["axois", "axiso", "axos", "axioss", "axious"],
  webpack: ["webpak", "webpck", "weback", "webpackk"],
  "node-fetch": ["node-fech", "node-fetcb", "nodefetch", "node_fetch"],
  chalk: ["chalks", "chlak", "chulk"],
  commander: ["comander", "commandr", "commader"],
  moment: ["momet", "momnet", "momennt"],
  underscore: ["undersore", "undescore", "uderscore"],
  "cross-env": ["cross-env.js", "crossenv", "cros-env"],
  dotenv: ["dot-env", "dontenv", "dotenvv"],
  jsonwebtoken: ["json-web-token", "jsonwebtokn", "jsonwebtken"],
  mongoose: ["mongose", "mongoosse", "mongosse"],
  "body-parser": ["bodyparser", "body-parsr", "bady-parser"],
  typescript: ["typescrip", "typscript", "typsecript"],
  eslint: ["eslit", "es-lint", "elint"],
  prettier: ["pretier", "prettir", "pretiier"],
};

// Packages with known security issues (simplified for static analysis)
const KNOWN_VULNERABLE_PACKAGES: Record<
  string,
  { severity: SecurityFinding["severity"]; description: string; remediation: string }
> = {
  "event-stream": {
    severity: "critical",
    description:
      "Event-stream was compromised in a supply chain attack (flatmap-stream incident). Malicious code was injected to steal cryptocurrency.",
    remediation: "Remove event-stream and use native Node.js streams or a maintained alternative.",
  },
  "ua-parser-js": {
    severity: "high",
    description:
      "ua-parser-js was hijacked to include cryptomining and credential-stealing malware in versions 0.7.29, 0.8.0, and 1.0.0.",
    remediation:
      "Ensure you are using a version after the compromised releases (>=0.7.30, >=0.8.1, >=1.0.1).",
  },
  coa: {
    severity: "high",
    description:
      "The coa package was compromised to inject malicious code targeting CI/CD environments.",
    remediation: "Verify you are using a non-compromised version. Pin to a known-safe version.",
  },
  rc: {
    severity: "high",
    description: "The rc package was compromised in a supply chain attack.",
    remediation: "Verify you are using a non-compromised version. Pin to a known-safe version.",
  },
  colors: {
    severity: "medium",
    description:
      "The colors package was sabotaged by its maintainer, introducing infinite loops in versions >1.4.0.",
    remediation: "Pin colors to version 1.4.0 or use chalk as an alternative.",
  },
  faker: {
    severity: "medium",
    description:
      "The faker package was sabotaged by its maintainer, removing all functionality. Use the community fork @faker-js/faker.",
    remediation: "Replace faker with @faker-js/faker.",
  },
  "node-ipc": {
    severity: "critical",
    description:
      "node-ipc was weaponized to include destructive code targeting specific geolocations (protestware).",
    remediation: "Remove node-ipc and use an alternative IPC mechanism.",
  },
  minimist: {
    severity: "medium",
    description: "Minimist has a prototype pollution vulnerability in versions <1.2.6.",
    remediation:
      "Update minimist to >=1.2.6 or switch to a maintained alternative like yargs-parser.",
  },
  qs: {
    severity: "medium",
    description: "Older versions of qs are vulnerable to prototype pollution.",
    remediation: "Update qs to the latest version.",
  },
  tar: {
    severity: "high",
    description:
      "Older versions of tar have path traversal vulnerabilities that allow arbitrary file writes.",
    remediation: "Update tar to >=6.1.9.",
  },
  "glob-parent": {
    severity: "medium",
    description:
      "glob-parent versions <5.1.2 are vulnerable to ReDoS (Regular Expression Denial of Service).",
    remediation: "Update glob-parent to >=5.1.2.",
  },
  "path-parse": {
    severity: "medium",
    description: "path-parse versions <1.0.7 are vulnerable to ReDoS.",
    remediation: "Update path-parse to >=1.0.7.",
  },
};

// Deprecated packages with better alternatives
const DEPRECATED_PACKAGES: Record<string, string> = {
  request: "Use node-fetch, axios, or got instead.",
  "node-uuid": "Use the uuid package instead.",
  mkdirp: "Use fs.mkdir with { recursive: true } (Node 10+).",
  rimraf: "Use fs.rm with { recursive: true } (Node 14.14+).",
  "left-pad": "Use String.prototype.padStart().",
  querystring: "Use URLSearchParams instead.",
  nomnom: "Use commander, yargs, or meow instead.",
  optimist: "Use yargs or commander instead.",
  "coffee-script": "Use CoffeeScript 2+ or migrate to TypeScript.",
  natives: "This package is deprecated and should not be used.",
};

export function checkDependencies(skill: AgentSkill): SecurityFinding[] {
  const findings: SecurityFinding[] = [];
  const deps = skill.manifest.dependencies ?? {};
  const depNames = Object.keys(deps);

  if (depNames.length === 0) return findings;

  // Check each dependency
  for (const [name, version] of Object.entries(deps)) {
    // 1. Check for known vulnerable packages
    if (name in KNOWN_VULNERABLE_PACKAGES) {
      const vuln = KNOWN_VULNERABLE_PACKAGES[name];
      findings.push({
        id: `DEP-VULN-${name}`,
        rule: "dependencies",
        severity: vuln.severity,
        category: "dependency-vulnerability",
        title: `Known vulnerable package: ${name}`,
        description: vuln.description,
        file: "package.json",
        evidence: `"${name}": "${version}"`,
        remediation: vuln.remediation,
      });
    }

    // 2. Check for typosquatting
    checkTyposquatting(name, version, findings);

    // 3. Check for deprecated packages
    if (name in DEPRECATED_PACKAGES) {
      findings.push({
        id: `DEP-DEPR-${name}`,
        rule: "dependencies",
        severity: "low",
        category: "dependency-vulnerability",
        title: `Deprecated package: ${name}`,
        description: `The package '${name}' is deprecated and may not receive security updates.`,
        file: "package.json",
        evidence: `"${name}": "${version}"`,
        remediation: DEPRECATED_PACKAGES[name],
      });
    }

    // 4. Check for wildcard/unpinned versions (also in supply-chain, but relevant here)
    if (version === "*" || version === "latest" || version === "") {
      findings.push({
        id: `DEP-WILD-${name}`,
        rule: "dependencies",
        severity: "high",
        category: "dependency-vulnerability",
        title: `Unpinned dependency version: ${name}`,
        description: `The dependency '${name}' uses '${version}' which will install whatever the latest version is. This is unpredictable and could pull in a compromised version.`,
        file: "package.json",
        evidence: `"${name}": "${version}"`,
        remediation:
          "Pin to a specific version or use a version range with upper bound (e.g., ^1.2.3).",
      });
    }

    // 5. Check for git/URL dependencies
    if (
      version.startsWith("git") ||
      version.startsWith("http") ||
      version.startsWith("github:") ||
      version.includes("://")
    ) {
      findings.push({
        id: `DEP-GIT-${name}`,
        rule: "dependencies",
        severity: "high",
        category: "dependency-vulnerability",
        title: `Git/URL dependency: ${name}`,
        description: `The dependency '${name}' is installed from a URL/git repository ('${version}'). This bypasses the registry's malware scanning and integrity checks.`,
        file: "package.json",
        evidence: `"${name}": "${version}"`,
        remediation:
          "Publish the dependency to a registry and install it normally. If a fork is needed, publish it under a scoped name.",
      });
    }
  }

  // 6. Excessive dependency count
  if (depNames.length > 30) {
    findings.push({
      id: "DEP-COUNT",
      rule: "dependencies",
      severity: "medium",
      category: "dependency-vulnerability",
      title: `Excessive dependency count (${depNames.length})`,
      description: `The skill declares ${depNames.length} dependencies. Each dependency expands the attack surface and increases the risk of a supply chain compromise.`,
      file: "package.json",
      evidence: `${depNames.length} dependencies declared`,
      remediation:
        "Audit dependencies and remove any that are not strictly necessary. Consider using native APIs or lighter alternatives.",
    });
  }

  // 7. Check for suspicious package names in code (require/import of unexpected packages)
  checkCodeImports(skill, findings);

  return findings;
}

function checkTyposquatting(name: string, version: string, findings: SecurityFinding[]): void {
  // Check against known typosquatting variants
  for (const [legitimate, typos] of Object.entries(TYPOSQUAT_TARGETS)) {
    for (const typo of typos) {
      if (name.toLowerCase() === typo.toLowerCase()) {
        findings.push({
          id: `DEP-TYPO-${name}`,
          rule: "dependencies",
          severity: "critical",
          category: "dependency-vulnerability",
          title: `Potential typosquatting: ${name}`,
          description: `The package '${name}' looks like a typosquat of the popular package '${legitimate}'. Typosquatting packages often contain malware.`,
          file: "package.json",
          evidence: `"${name}": "${version}"`,
          remediation: `Verify you intended to install '${name}' and not '${legitimate}'.`,
        });
        return;
      }
    }
  }

  // Heuristic: check for suspicious name patterns
  const suspiciousPatterns = [
    /^[a-z]+-[a-z]+-[a-z]+-[a-z]+$/, // Many-segment generic names
    /^[a-z]{1,2}-\w+/, // Very short prefix
    /\d{3,}/, // Contains many digits
  ];

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(name) && !name.startsWith("@")) {
      findings.push({
        id: `DEP-SUSP-${name}`,
        rule: "dependencies",
        severity: "low",
        category: "dependency-vulnerability",
        title: `Suspicious package name pattern: ${name}`,
        description: `The package name '${name}' matches a pattern commonly used by malicious packages. This may be legitimate but warrants manual review.`,
        file: "package.json",
        evidence: `"${name}": "${version}"`,
        remediation:
          "Verify the package is legitimate by checking its npm page, GitHub repository, and download statistics.",
      });
      break;
    }
  }
}

function checkCodeImports(skill: AgentSkill, findings: SecurityFinding[]): void {
  const declaredDeps = new Set(Object.keys(skill.manifest.dependencies ?? {}));
  const importPattern = /(?:require\s*\(\s*["']|from\s+["']|import\s+["'])([^"'./][^"']*?)["']/g;

  for (const file of skill.files) {
    const ext = file.relativePath.split(".").pop()?.toLowerCase() ?? "";
    if (!["ts", "tsx", "js", "jsx", "mjs", "cjs"].includes(ext)) continue;

    importPattern.lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = importPattern.exec(file.content)) !== null) {
      const importedPkg = match[1].split("/")[0]; // Handle scoped packages

      // If the imported package starts with @, include the scope
      let fullPkg = importedPkg;
      if (importedPkg === "@" || importedPkg.startsWith("@")) {
        const parts = match[1].split("/");
        fullPkg = parts.length >= 2 ? `${parts[0]}/${parts[1]}` : parts[0];
      }

      // Skip node built-ins
      if (isNodeBuiltin(fullPkg)) continue;

      // Flag imports that don't appear in declared dependencies
      if (!declaredDeps.has(fullPkg) && !isNodeBuiltin(fullPkg)) {
        const line = getLineNumber(file.content, match.index);
        findings.push({
          id: `DEP-UNDECL-${fullPkg}-${file.relativePath}-${line}`,
          rule: "dependencies",
          severity: "medium",
          category: "dependency-vulnerability",
          title: `Undeclared dependency import: ${fullPkg}`,
          description: `The code imports '${fullPkg}' which is not listed in the manifest dependencies. This could indicate a phantom dependency that works now but may break or be hijacked.`,
          file: file.relativePath,
          line,
          evidence: getEvidenceLine(file.content, match.index),
          remediation: `Add '${fullPkg}' to the skill's declared dependencies or remove the import.`,
        });
      }
    }
  }
}

function isNodeBuiltin(name: string): boolean {
  const builtins = new Set([
    "assert",
    "buffer",
    "child_process",
    "cluster",
    "console",
    "constants",
    "crypto",
    "dgram",
    "dns",
    "domain",
    "events",
    "fs",
    "http",
    "https",
    "module",
    "net",
    "os",
    "path",
    "punycode",
    "querystring",
    "readline",
    "repl",
    "stream",
    "string_decoder",
    "sys",
    "timers",
    "tls",
    "tty",
    "url",
    "util",
    "v8",
    "vm",
    "worker_threads",
    "zlib",
    "node:assert",
    "node:buffer",
    "node:child_process",
    "node:cluster",
    "node:console",
    "node:constants",
    "node:crypto",
    "node:dgram",
    "node:dns",
    "node:domain",
    "node:events",
    "node:fs",
    "node:http",
    "node:https",
    "node:module",
    "node:net",
    "node:os",
    "node:path",
    "node:punycode",
    "node:querystring",
    "node:readline",
    "node:repl",
    "node:stream",
    "node:string_decoder",
    "node:sys",
    "node:timers",
    "node:tls",
    "node:tty",
    "node:url",
    "node:util",
    "node:v8",
    "node:vm",
    "node:worker_threads",
    "node:zlib",
    "bun",
    "bun:test",
    "bun:ffi",
    "bun:sqlite",
  ]);
  return builtins.has(name);
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
