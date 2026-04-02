import type { AgentSkill, SkillFile } from "@agent-audit/shared";

export interface MaintenanceResult {
  /** Overall maintenance health score, 0-100 */
  score: number;
  /** Whether test files were found */
  hasTests: boolean;
  /** Number of test files found */
  testFileCount: number;
  /** Whether CI configuration was found */
  hasCIConfig: boolean;
  /** CI provider detected */
  ciProvider: string | null;
  /** Whether TypeScript type definitions are present */
  hasTypes: boolean;
  /** Whether a license file was found */
  hasLicense: boolean;
  /** License type detected */
  licenseType: string | null;
  /** Whether a linter config was found */
  hasLinter: boolean;
  /** Whether a formatter config was found */
  hasFormatter: boolean;
  /** Whether a .gitignore exists */
  hasGitignore: boolean;
  /** Breakdown of score components */
  breakdown: MaintenanceBreakdown;
}

interface MaintenanceBreakdown {
  tests: number;
  ci: number;
  types: number;
  license: number;
  linter: number;
  formatter: number;
  gitignore: number;
}

/** Score weights for each maintenance signal (must sum to 100) */
const WEIGHTS = {
  tests: 25,
  ci: 20,
  types: 20,
  license: 15,
  linter: 10,
  formatter: 5,
  gitignore: 5,
};

/** Patterns that indicate test files */
const TEST_FILE_PATTERNS = [
  /\.test\.[jt]sx?$/,
  /\.spec\.[jt]sx?$/,
  /_test\.[jt]sx?$/,
  /test_.*\.py$/,
  /.*_test\.py$/,
  /\.test\.py$/,
  /tests?\/.*\.[jt]sx?$/,
  /tests?\/.*\.py$/,
  /__tests__\//,
  /\.stories\.[jt]sx?$/, // Storybook stories serve as visual tests
];

/** CI configuration file patterns */
const CI_CONFIGS: Array<{ pattern: RegExp | string; provider: string }> = [
  { pattern: ".github/workflows", provider: "GitHub Actions" },
  { pattern: ".gitlab-ci.yml", provider: "GitLab CI" },
  { pattern: ".circleci/config.yml", provider: "CircleCI" },
  { pattern: "Jenkinsfile", provider: "Jenkins" },
  { pattern: ".travis.yml", provider: "Travis CI" },
  { pattern: "azure-pipelines.yml", provider: "Azure Pipelines" },
  { pattern: "bitbucket-pipelines.yml", provider: "Bitbucket Pipelines" },
  { pattern: ".buildkite", provider: "Buildkite" },
  { pattern: ".drone.yml", provider: "Drone CI" },
  { pattern: "turbo.json", provider: "Turborepo" },
];

/** Linter configuration files */
const LINTER_CONFIGS = [
  ".eslintrc",
  ".eslintrc.js",
  ".eslintrc.cjs",
  ".eslintrc.json",
  ".eslintrc.yml",
  "eslint.config.js",
  "eslint.config.mjs",
  "eslint.config.cjs",
  ".pylintrc",
  "pyproject.toml", // Can contain pylint/ruff config
  ".flake8",
  ".ruff.toml",
  "ruff.toml",
  "biome.json",
  "biome.jsonc",
  "deno.json",
];

/** Formatter configuration files */
const FORMATTER_CONFIGS = [
  ".prettierrc",
  ".prettierrc.js",
  ".prettierrc.cjs",
  ".prettierrc.json",
  ".prettierrc.yml",
  ".prettierrc.toml",
  "prettier.config.js",
  "prettier.config.cjs",
  "biome.json",
  "biome.jsonc",
  ".editorconfig",
  "deno.json",
  ".clang-format",
  "rustfmt.toml",
];

/** Common license identifiers */
const LICENSE_PATTERNS: Array<{ pattern: RegExp; type: string }> = [
  { pattern: /MIT\s+License/i, type: "MIT" },
  { pattern: /Apache\s+License.*2\.0/i, type: "Apache-2.0" },
  { pattern: /GNU\s+General\s+Public\s+License/i, type: "GPL" },
  { pattern: /BSD\s+[23]-Clause/i, type: "BSD" },
  { pattern: /ISC\s+License/i, type: "ISC" },
  { pattern: /Mozilla\s+Public\s+License/i, type: "MPL" },
  { pattern: /The\s+Unlicense/i, type: "Unlicense" },
  { pattern: /Creative\s+Commons/i, type: "CC" },
];

/**
 * Check whether test files exist in the skill.
 */
function detectTests(files: SkillFile[]): {
  hasTests: boolean;
  testFileCount: number;
  score: number;
} {
  const testFiles = files.filter((f) =>
    TEST_FILE_PATTERNS.some((pattern) => pattern.test(f.relativePath)),
  );

  const testFileCount = testFiles.length;

  if (testFileCount === 0) {
    return { hasTests: false, testFileCount: 0, score: 0 };
  }

  // Count source files (non-test, non-config)
  const sourceFiles = files.filter((f) => {
    const ext = f.relativePath.split(".").pop()?.toLowerCase() ?? "";
    const isSource = ["js", "ts", "jsx", "tsx", "py", "mjs", "cjs"].includes(ext);
    const isTest = TEST_FILE_PATTERNS.some((p) => p.test(f.relativePath));
    return isSource && !isTest;
  });

  if (sourceFiles.length === 0) {
    return { hasTests: true, testFileCount, score: 1 };
  }

  // Score based on test-to-source file ratio
  const ratio = testFileCount / sourceFiles.length;
  let score: number;
  if (ratio >= 0.8) {
    score = 1;
  } else if (ratio >= 0.5) {
    score = 0.7 + ((ratio - 0.5) / 0.3) * 0.3;
  } else if (ratio >= 0.2) {
    score = 0.4 + ((ratio - 0.2) / 0.3) * 0.3;
  } else {
    score = (ratio / 0.2) * 0.4;
  }

  return { hasTests: true, testFileCount, score: Math.min(1, score) };
}

/**
 * Detect CI configuration.
 */
function detectCI(files: SkillFile[]): {
  hasCIConfig: boolean;
  ciProvider: string | null;
  score: number;
} {
  for (const ci of CI_CONFIGS) {
    const found = files.some((f) => {
      if (typeof ci.pattern === "string") {
        return f.relativePath === ci.pattern || f.relativePath.startsWith(`${ci.pattern}/`);
      }
      return ci.pattern.test(f.relativePath);
    });

    if (found) {
      return { hasCIConfig: true, ciProvider: ci.provider, score: 1 };
    }
  }

  return { hasCIConfig: false, ciProvider: null, score: 0 };
}

/**
 * Detect TypeScript type definitions.
 */
function detectTypes(files: SkillFile[]): { hasTypes: boolean; score: number } {
  // Check for .d.ts files
  const hasDtsFiles = files.some((f) => f.relativePath.endsWith(".d.ts"));

  // Check for tsconfig.json
  const hasTsConfig = files.some(
    (f) =>
      f.relativePath === "tsconfig.json" ||
      f.relativePath === "tsconfig.build.json" ||
      f.relativePath.endsWith("/tsconfig.json"),
  );

  // Check for TypeScript source files
  const hasTsSource = files.some((f) => {
    const ext = f.relativePath.split(".").pop()?.toLowerCase();
    return ext === "ts" || ext === "tsx";
  });

  // Check for JSDoc @type annotations in JS files
  const hasJSDocTypes = files.some((f) => {
    if (!f.relativePath.endsWith(".js") && !f.relativePath.endsWith(".jsx")) return false;
    return /@type\s*\{|@param\s*\{|@returns?\s*\{/.test(f.content);
  });

  // Check for Python type hints
  const hasPythonTypes = files.some((f) => {
    if (!f.relativePath.endsWith(".py")) return false;
    return (
      /:\s*(?:str|int|float|bool|list|dict|tuple|Optional|Union|List|Dict)/.test(f.content) ||
      f.relativePath.endsWith(".pyi")
    );
  });

  const hasTypes = hasDtsFiles || hasTsConfig || hasTsSource || hasJSDocTypes || hasPythonTypes;

  let score = 0;
  if (hasTsSource || hasPythonTypes) score = 1;
  else if (hasDtsFiles) score = 0.8;
  else if (hasJSDocTypes) score = 0.6;
  else if (hasTsConfig) score = 0.5;

  return { hasTypes, score };
}

/**
 * Detect license file and type.
 */
function detectLicense(skill: AgentSkill): {
  hasLicense: boolean;
  licenseType: string | null;
  score: number;
} {
  const files = skill.files;

  // Check for license file
  const licenseFile = files.find((f) => {
    const name = f.relativePath.toLowerCase();
    return (
      name === "license" ||
      name === "license.md" ||
      name === "license.txt" ||
      name === "licence" ||
      name === "licence.md" ||
      name === "licence.txt" ||
      name === "copying" ||
      name === "copying.md"
    );
  });

  // Also check manifest
  if (skill.manifest.license) {
    return { hasLicense: true, licenseType: skill.manifest.license, score: 1 };
  }

  if (!licenseFile) {
    // Check package.json for license field
    const pkgFile = files.find((f) => f.relativePath === "package.json");
    if (pkgFile) {
      try {
        const pkg = JSON.parse(pkgFile.content);
        if (pkg.license) {
          return { hasLicense: true, licenseType: pkg.license, score: 1 };
        }
      } catch {
        // Ignore parse errors
      }
    }
    return { hasLicense: false, licenseType: null, score: 0 };
  }

  // Try to detect license type
  let licenseType: string | null = null;
  for (const lp of LICENSE_PATTERNS) {
    if (lp.pattern.test(licenseFile.content)) {
      licenseType = lp.type;
      break;
    }
  }

  return { hasLicense: true, licenseType, score: 1 };
}

/**
 * Detect linter configuration.
 */
function detectLinter(files: SkillFile[]): { hasLinter: boolean; score: number } {
  const hasLinter = files.some((f) => {
    const basename = f.relativePath.split("/").pop() ?? "";
    return LINTER_CONFIGS.includes(basename);
  });

  // Also check package.json for lint script
  if (!hasLinter) {
    const pkgFile = files.find((f) => f.relativePath === "package.json");
    if (pkgFile) {
      try {
        const pkg = JSON.parse(pkgFile.content);
        if (pkg.scripts?.lint || pkg.scripts?.eslint) {
          return { hasLinter: true, score: 0.8 };
        }
      } catch {
        // Ignore
      }
    }
  }

  return { hasLinter, score: hasLinter ? 1 : 0 };
}

/**
 * Detect formatter configuration.
 */
function detectFormatter(files: SkillFile[]): { hasFormatter: boolean; score: number } {
  const hasFormatter = files.some((f) => {
    const basename = f.relativePath.split("/").pop() ?? "";
    return FORMATTER_CONFIGS.includes(basename);
  });

  return { hasFormatter, score: hasFormatter ? 1 : 0 };
}

/**
 * Detect .gitignore.
 */
function detectGitignore(files: SkillFile[]): { hasGitignore: boolean; score: number } {
  const hasGitignore = files.some(
    (f) => f.relativePath === ".gitignore" || f.relativePath.endsWith("/.gitignore"),
  );
  return { hasGitignore, score: hasGitignore ? 1 : 0 };
}

/**
 * Calculate maintenance health score for an agent skill.
 * Checks for test files, CI configuration, type definitions, license,
 * linter, formatter, and gitignore. Returns a score from 0 to 100.
 */
export function scoreMaintenanceHealth(skill: AgentSkill): MaintenanceResult {
  const files = skill.files;

  const tests = detectTests(files);
  const ci = detectCI(files);
  const types = detectTypes(files);
  const license = detectLicense(skill);
  const linter = detectLinter(files);
  const formatter = detectFormatter(files);
  const gitignore = detectGitignore(files);

  const breakdown: MaintenanceBreakdown = {
    tests: Math.round(tests.score * WEIGHTS.tests),
    ci: Math.round(ci.score * WEIGHTS.ci),
    types: Math.round(types.score * WEIGHTS.types),
    license: Math.round(license.score * WEIGHTS.license),
    linter: Math.round(linter.score * WEIGHTS.linter),
    formatter: Math.round(formatter.score * WEIGHTS.formatter),
    gitignore: Math.round(gitignore.score * WEIGHTS.gitignore),
  };

  const score =
    breakdown.tests +
    breakdown.ci +
    breakdown.types +
    breakdown.license +
    breakdown.linter +
    breakdown.formatter +
    breakdown.gitignore;

  return {
    score: Math.min(100, score),
    hasTests: tests.hasTests,
    testFileCount: tests.testFileCount,
    hasCIConfig: ci.hasCIConfig,
    ciProvider: ci.ciProvider,
    hasTypes: types.hasTypes,
    hasLicense: license.hasLicense,
    licenseType: license.licenseType,
    hasLinter: linter.hasLinter,
    hasFormatter: formatter.hasFormatter,
    hasGitignore: gitignore.hasGitignore,
    breakdown,
  };
}
