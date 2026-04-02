import type { AgentSkill, SecurityFinding } from "@agent-audit/shared";

/**
 * Rule: Supply Chain Risks (AST-08)
 *
 * Checks for supply chain attack vectors including unpinned dependencies,
 * suspicious registries, install scripts, and integrity verification gaps.
 */

export function checkSupplyChain(skill: AgentSkill): SecurityFinding[] {
  const findings: SecurityFinding[] = [];
  const deps = skill.manifest.dependencies ?? {};

  checkVersionPinning(deps, findings);
  checkInstallScripts(skill, findings);
  checkRegistryConfig(skill, findings);
  checkLockfilePresence(skill, findings);
  checkIntegrityVerification(skill, findings);
  checkDynamicLoading(skill, findings);
  checkVendoredDeps(skill, findings);

  return findings;
}

function checkVersionPinning(deps: Record<string, string>, findings: SecurityFinding[]): void {
  for (const [name, version] of Object.entries(deps)) {
    if (version === "*" || version === "latest" || version === "next") {
      findings.push({
        id: `SC-PIN-${name}`,
        rule: "supply-chain",
        severity: "high",
        category: "supply-chain",
        title: `Unpinned dependency: ${name}@${version}`,
        description: `The dependency '${name}' uses '${version}' which accepts any version. A compromised future version will be automatically installed.`,
        file: "package.json",
        evidence: `"${name}": "${version}"`,
        remediation:
          "Pin to a specific version (e.g., '1.2.3') or a caret range ('^1.2.3') with a lockfile.",
      });
    }

    if (/^>=?\s*0(?:\.0(?:\.0)?)?$/.test(version)) {
      findings.push({
        id: `SC-WIDE-${name}`,
        rule: "supply-chain",
        severity: "high",
        category: "supply-chain",
        title: `Overly broad version range: ${name}@${version}`,
        description: `The dependency '${name}' uses '${version}' which accepts virtually any version, including potentially malicious future releases.`,
        file: "package.json",
        evidence: `"${name}": "${version}"`,
        remediation:
          "Narrow the version range to the minimum needed. Use a caret (^) or tilde (~) with a specific version.",
      });
    }

    if (/^\d+\.x/.test(version) || /\|\|/.test(version)) {
      findings.push({
        id: `SC-RANGE-${name}`,
        rule: "supply-chain",
        severity: "medium",
        category: "supply-chain",
        title: `Broad version range: ${name}@${version}`,
        description: `The dependency '${name}' uses a broad version range '${version}' that may accept multiple major versions.`,
        file: "package.json",
        evidence: `"${name}": "${version}"`,
        remediation:
          "Use a more specific version range. The caret (^) prefix with a lockfile is the recommended approach.",
      });
    }

    if (version.startsWith("git") || version.includes("://") || version.startsWith("github:")) {
      findings.push({
        id: `SC-GIT-${name}`,
        rule: "supply-chain",
        severity: "high",
        category: "supply-chain",
        title: `Dependency from git/URL source: ${name}`,
        description: `The dependency '${name}' is installed from '${version}'. Git/URL sources bypass registry integrity checks and can be changed without version bumps.`,
        file: "package.json",
        evidence: `"${name}": "${version}"`,
        remediation:
          "If a specific commit is needed, pin to a commit hash. Prefer publishing to a registry for integrity verification.",
      });

      if (!/#[a-f0-9]{7,}/.test(version)) {
        findings.push({
          id: `SC-GIT-NOPIN-${name}`,
          rule: "supply-chain",
          severity: "high",
          category: "supply-chain",
          title: `Git dependency without commit pin: ${name}`,
          description: `The git dependency '${name}' does not pin to a specific commit hash. The branch HEAD can be changed to inject malicious code.`,
          file: "package.json",
          evidence: `"${name}": "${version}"`,
          remediation: "Pin to a specific commit hash (e.g., 'github:user/repo#abc1234').",
        });
      }
    }

    if (version.startsWith("file:") || version.startsWith("link:")) {
      findings.push({
        id: `SC-LOCAL-${name}`,
        rule: "supply-chain",
        severity: "low",
        category: "supply-chain",
        title: `Local file dependency: ${name}`,
        description: `The dependency '${name}' references a local path '${version}'. This is not reproducible across environments and bypasses integrity verification.`,
        file: "package.json",
        evidence: `"${name}": "${version}"`,
        remediation:
          "Publish the local package to a registry (private if needed) for reproducible builds.",
      });
    }
  }
}

function checkInstallScripts(skill: AgentSkill, findings: SecurityFinding[]): void {
  for (const file of skill.files) {
    if (!file.relativePath.endsWith("package.json")) continue;

    const dangerousScripts = ["preinstall", "postinstall", "install", "prepare"];
    for (const scriptName of dangerousScripts) {
      const scriptPattern = new RegExp(`"${scriptName}"\\s*:\\s*"([^"]*)"`, "g");
      scriptPattern.lastIndex = 0;
      let match: RegExpExecArray | null;

      while ((match = scriptPattern.exec(file.content)) !== null) {
        const scriptContent = match[1];
        const isSuspicious =
          /\b(?:curl|wget|bash|sh|node\s+-e|eval|exec|powershell)\b/.test(scriptContent) ||
          /https?:\/\//.test(scriptContent);

        findings.push({
          id: `SC-SCRIPT-${scriptName}-${file.relativePath}`,
          rule: "supply-chain",
          severity: isSuspicious ? "critical" : "medium",
          category: "supply-chain",
          title: `${isSuspicious ? "Suspicious " : ""}${scriptName} script detected`,
          description: isSuspicious
            ? `The ${scriptName} script executes potentially dangerous operations: "${scriptContent}". Install scripts that download and execute code are a primary supply chain attack vector.`
            : `The package defines a '${scriptName}' lifecycle script. While sometimes necessary, install scripts run with full user privileges and are a common attack vector.`,
          file: file.relativePath,
          evidence: `"${scriptName}": "${scriptContent}"`,
          remediation: isSuspicious
            ? "Remove the install script. If build steps are needed, use explicit build commands documented in the README."
            : "Review the install script to ensure it performs only necessary build operations. Consider using --ignore-scripts for untrusted packages.",
        });
      }
    }
  }
}

function checkRegistryConfig(skill: AgentSkill, findings: SecurityFinding[]): void {
  for (const file of skill.files) {
    if (
      !file.relativePath.endsWith(".npmrc") &&
      !file.relativePath.endsWith(".yarnrc") &&
      !file.relativePath.endsWith(".yarnrc.yml")
    )
      continue;

    const registryPattern = /registry\s*[=:]\s*["']?(https?:\/\/[^"'\s]+)/gi;
    registryPattern.lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = registryPattern.exec(file.content)) !== null) {
      const registryUrl = match[1];
      const isOfficialRegistry =
        registryUrl.includes("registry.npmjs.org") || registryUrl.includes("registry.yarnpkg.com");

      if (!isOfficialRegistry) {
        findings.push({
          id: `SC-REG-${file.relativePath}`,
          rule: "supply-chain",
          severity: "medium",
          category: "supply-chain",
          title: "Custom package registry configured",
          description: `A custom registry '${registryUrl}' is configured. Custom registries may lack the security scanning of the official npm registry.`,
          file: file.relativePath,
          evidence: match[0],
          remediation:
            "Verify the custom registry is trusted and properly secured. Consider using the official npm registry with scoped packages for private packages.",
        });
      }
    }

    if (/strict-ssl\s*=\s*false/i.test(file.content)) {
      findings.push({
        id: `SC-SSL-${file.relativePath}`,
        rule: "supply-chain",
        severity: "high",
        category: "supply-chain",
        title: "SSL verification disabled for package registry",
        description:
          "SSL verification is disabled in the npm/yarn configuration. This allows man-in-the-middle attacks on package downloads.",
        file: file.relativePath,
        evidence: "strict-ssl=false",
        remediation:
          "Enable SSL verification (strict-ssl=true). Fix any certificate issues rather than disabling verification.",
      });
    }

    if (/_authToken\s*=/.test(file.content) || /_auth\s*=/.test(file.content)) {
      findings.push({
        id: `SC-AUTH-${file.relativePath}`,
        rule: "supply-chain",
        severity: "critical",
        category: "supply-chain",
        title: "Auth token in package config file",
        description:
          "An authentication token is stored in a package config file that may be committed to version control.",
        file: file.relativePath,
        evidence: "[auth token redacted]",
        remediation:
          "Remove auth tokens from config files. Use environment variables (NPM_TOKEN) or npm login for authentication.",
      });
    }
  }
}

function checkLockfilePresence(skill: AgentSkill, findings: SecurityFinding[]): void {
  const lockfiles = ["package-lock.json", "yarn.lock", "pnpm-lock.yaml", "bun.lockb", "bun.lock"];
  const hasLockfile = skill.files.some((f) => lockfiles.some((lf) => f.relativePath.endsWith(lf)));
  const hasDeps = Object.keys(skill.manifest.dependencies ?? {}).length > 0;

  if (hasDeps && !hasLockfile) {
    findings.push({
      id: "SC-NOLOCK",
      rule: "supply-chain",
      severity: "high",
      category: "supply-chain",
      title: "No lockfile found",
      description:
        "The skill has dependencies but no lockfile. Without a lockfile, dependency versions are not deterministic, and integrity hashes are not verified.",
      remediation:
        "Generate and commit a lockfile. Run 'npm install', 'yarn install', or 'bun install' to create one.",
    });
  }
}

function checkIntegrityVerification(skill: AgentSkill, findings: SecurityFinding[]): void {
  for (const file of skill.files) {
    const ext = file.relativePath.split(".").pop()?.toLowerCase() ?? "";
    if (!["ts", "js", "sh", "bash", "py", "mjs", "cjs"].includes(ext)) continue;

    const curlPipePattern = /(?:curl|wget)\s+[^\n|]*\|\s*(?:bash|sh|zsh|node)/g;
    curlPipePattern.lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = curlPipePattern.exec(file.content)) !== null) {
      findings.push({
        id: `SC-PIPE-${getLineNumber(file.content, match.index)}`,
        rule: "supply-chain",
        severity: "critical",
        category: "supply-chain",
        title: "Remote code execution via pipe to shell",
        description:
          "Code is downloaded from a URL and piped directly to a shell interpreter without integrity verification. This is the most dangerous supply chain pattern.",
        file: file.relativePath,
        line: getLineNumber(file.content, match.index),
        evidence: getEvidenceLine(file.content, match.index),
        remediation:
          "Download the script first, verify its checksum/signature, then execute. Or use a package manager with integrity checks.",
      });
    }
  }
}

function checkDynamicLoading(skill: AgentSkill, findings: SecurityFinding[]): void {
  for (const file of skill.files) {
    const ext = file.relativePath.split(".").pop()?.toLowerCase() ?? "";
    if (!["ts", "tsx", "js", "jsx", "mjs", "cjs"].includes(ext)) continue;

    const urlImportPattern = /import\s*\(\s*["']https?:\/\//g;
    urlImportPattern.lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = urlImportPattern.exec(file.content)) !== null) {
      findings.push({
        id: `SC-URLIMPORT-${getLineNumber(file.content, match.index)}`,
        rule: "supply-chain",
        severity: "critical",
        category: "supply-chain",
        title: "Dynamic import from URL",
        description:
          "Code is dynamically imported from a URL at runtime. This bypasses all package manager integrity checks and can be changed without notice.",
        file: file.relativePath,
        line: getLineNumber(file.content, match.index),
        evidence: getEvidenceLine(file.content, match.index),
        remediation:
          "Install the dependency via a package manager. If URL imports are necessary (Deno), pin to a specific version and use a lockfile.",
      });
    }

    const pluginPattern =
      /(?:loadPlugin|loadExtension|addPlugin|registerPlugin)\s*\(\s*(?:user|input|url|path|config)\b/gi;
    pluginPattern.lastIndex = 0;

    while ((match = pluginPattern.exec(file.content)) !== null) {
      findings.push({
        id: `SC-PLUGIN-${getLineNumber(file.content, match.index)}`,
        rule: "supply-chain",
        severity: "high",
        category: "supply-chain",
        title: "Dynamic plugin loading from untrusted source",
        description:
          "Plugins or extensions are loaded dynamically from potentially untrusted sources. This allows arbitrary code execution via plugin injection.",
        file: file.relativePath,
        line: getLineNumber(file.content, match.index),
        evidence: getEvidenceLine(file.content, match.index),
        remediation:
          "Only load plugins from an explicit allowlist. Verify plugin integrity (checksums/signatures) before loading.",
      });
    }
  }
}

function checkVendoredDeps(skill: AgentSkill, findings: SecurityFinding[]): void {
  for (const file of skill.files) {
    if (file.relativePath.includes("node_modules/")) continue;
    if (!file.relativePath.match(/\.min\.js$|\.bundle\.js$|vendor\//)) continue;

    const lines = file.content.split("\n");
    const hasVeryLongLines = lines.some((line) => line.length > 5000);

    if (hasVeryLongLines) {
      findings.push({
        id: `SC-VENDOR-${file.relativePath}`,
        rule: "supply-chain",
        severity: "medium",
        category: "supply-chain",
        title: `Vendored/minified code: ${file.relativePath}`,
        description:
          "Minified or vendored JavaScript files can hide malicious code that is difficult to review. The long line lengths make manual inspection impractical.",
        file: file.relativePath,
        evidence: `File contains lines over 5000 characters (${file.size} bytes total)`,
        remediation:
          "Install dependencies via a package manager instead of vendoring. If vendoring is necessary, include the source maps and verify the minified output matches the source.",
      });
    }
  }
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
