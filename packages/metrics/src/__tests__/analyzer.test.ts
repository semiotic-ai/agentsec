import { describe, expect, test } from "bun:test";
import type { AgentSkill, SkillFile } from "@agentsec/shared";
import { MetricsAnalyzer } from "../analyzer";

/** Build a mock SkillFile. */
function makeFile(content: string, language: string, relativePath: string): SkillFile {
  return {
    path: `/tmp/mock-skill/${relativePath}`,
    relativePath,
    content,
    language,
    size: content.length,
  };
}

/** Build a mock AgentSkill with sensible defaults, overridable via partial. */
function mockSkill(overrides: Partial<AgentSkill> = {}): AgentSkill {
  return {
    id: "mock-skill",
    name: "Mock Skill",
    version: "1.0.0",
    path: "/tmp/mock-skill",
    platform: "openclaw",
    manifest: {
      name: "mock-skill",
      version: "1.0.0",
      permissions: [],
      dependencies: {},
    },
    files: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// MetricsAnalyzer.analyze()
// ---------------------------------------------------------------------------
describe("MetricsAnalyzer.analyze()", () => {
  test("returns all QualityMetrics fields", () => {
    const skill = mockSkill();
    const analyzer = new MetricsAnalyzer(skill);
    const metrics = analyzer.analyze();

    expect(metrics).toHaveProperty("codeComplexity");
    expect(metrics).toHaveProperty("testCoverage");
    expect(metrics).toHaveProperty("documentationScore");
    expect(metrics).toHaveProperty("maintenanceHealth");
    expect(metrics).toHaveProperty("dependencyCount");
    expect(metrics).toHaveProperty("outdatedDependencies");
    expect(metrics).toHaveProperty("hasReadme");
    expect(metrics).toHaveProperty("hasLicense");
    expect(metrics).toHaveProperty("hasTests");
    expect(metrics).toHaveProperty("hasTypes");
    expect(metrics).toHaveProperty("linesOfCode");
  });

  test("testCoverage is null (requires runtime analysis)", () => {
    const skill = mockSkill();
    const analyzer = new MetricsAnalyzer(skill);
    const metrics = analyzer.analyze();
    expect(metrics.testCoverage).toBeNull();
  });

  test("empty skill has zero complexity and zero lines", () => {
    const skill = mockSkill();
    const analyzer = new MetricsAnalyzer(skill);
    const metrics = analyzer.analyze();
    expect(metrics.codeComplexity).toBe(0);
    expect(metrics.linesOfCode).toBe(0);
  });

  test("does not include detailed breakdown fields", () => {
    const skill = mockSkill();
    const analyzer = new MetricsAnalyzer(skill);
    const metrics = analyzer.analyze();
    // The standard QualityMetrics type should NOT have the *Details fields
    expect(metrics).not.toHaveProperty("complexityDetails");
    expect(metrics).not.toHaveProperty("documentationDetails");
    expect(metrics).not.toHaveProperty("dependencyDetails");
    expect(metrics).not.toHaveProperty("maintenanceDetails");
  });
});

// ---------------------------------------------------------------------------
// MetricsAnalyzer.analyzeDetailed()
// ---------------------------------------------------------------------------
describe("MetricsAnalyzer.analyzeDetailed()", () => {
  test("includes all detail breakdowns", () => {
    const skill = mockSkill();
    const analyzer = new MetricsAnalyzer(skill);
    const detailed = analyzer.analyzeDetailed();

    expect(detailed).toHaveProperty("complexityDetails");
    expect(detailed).toHaveProperty("documentationDetails");
    expect(detailed).toHaveProperty("dependencyDetails");
    expect(detailed).toHaveProperty("maintenanceDetails");
  });

  test("complexityDetails has expected structure", () => {
    const code = `if (x) { for (let i = 0; i < 10; i++) { } }`;
    const skill = mockSkill({
      files: [makeFile(code, "typescript", "main.ts")],
    });
    const detailed = new MetricsAnalyzer(skill).analyzeDetailed();
    const cd = detailed.complexityDetails;

    expect(cd.score).toBeGreaterThan(0);
    expect(cd.rawBranchCount).toBeGreaterThanOrEqual(2);
    expect(cd.branches.length).toBeGreaterThan(0);
    expect(cd.fileComplexities).toHaveLength(1);
  });

  test("documentationDetails reflects README presence", () => {
    const readme = makeFile(
      "# My Skill\n\nThis skill does things.\n\n## Installation\n\n```bash\nnpm install\n```\n\n## Usage\n\nUse it like so.\n\nMore text to reach the minimum length threshold for scoring well. This is additional content that provides details about the skill and its purpose. It includes enough text to be considered substantive documentation.",
      "markdown",
      "readme.md",
    );
    const skill = mockSkill({ files: [readme] });
    const detailed = new MetricsAnalyzer(skill).analyzeDetailed();

    expect(detailed.hasReadme).toBe(true);
    expect(detailed.documentationDetails.hasReadme).toBe(true);
    expect(detailed.documentationDetails.readmeScore).toBeGreaterThan(0);
  });

  test("documentationDetails with no README scores zero for readme component", () => {
    const skill = mockSkill({
      files: [makeFile("const x = 1;", "typescript", "index.ts")],
    });
    const detailed = new MetricsAnalyzer(skill).analyzeDetailed();

    expect(detailed.hasReadme).toBe(false);
    expect(detailed.documentationDetails.readmeScore).toBe(0);
  });

  test("documentationDetails scores JSDoc comments", () => {
    const code = `
/** Add two numbers. */
function add(a: number, b: number): number {
  return a + b;
}

/** Multiply two numbers. */
function multiply(a: number, b: number): number {
  return a * b;
}
`;
    const skill = mockSkill({
      files: [makeFile(code, "typescript", "math.ts")],
    });
    const detailed = new MetricsAnalyzer(skill).analyzeDetailed();

    expect(detailed.documentationDetails.hasDocstrings).toBe(true);
    expect(detailed.documentationDetails.docstringCount).toBeGreaterThanOrEqual(2);
    expect(detailed.documentationDetails.docstringScore).toBeGreaterThan(0);
  });

  test("documentationDetails scores inline comment ratio", () => {
    const code = `
// Initialize counter
let count = 0;
// Increment
count++;
// Log result
console.log(count);
const a = 1;
const b = 2;
const c = 3;
const d = 4;
`;
    const skill = mockSkill({
      files: [makeFile(code, "typescript", "main.ts")],
    });
    const detailed = new MetricsAnalyzer(skill).analyzeDetailed();

    expect(detailed.documentationDetails.commentRatio).toBeGreaterThan(0);
    expect(detailed.documentationDetails.commentScore).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Dependency analysis via analyzer
// ---------------------------------------------------------------------------
describe("MetricsAnalyzer: dependency analysis", () => {
  test("counts manifest dependencies", () => {
    const skill = mockSkill({
      manifest: {
        name: "dep-skill",
        version: "1.0.0",
        permissions: [],
        dependencies: { zod: "3.22.4", lodash: "4.17.21" },
      },
    });
    const metrics = new MetricsAnalyzer(skill).analyze();
    expect(metrics.dependencyCount).toBe(2);
  });

  test("counts package.json dependencies", () => {
    const pkgJson = JSON.stringify({
      dependencies: { express: "4.18.0", cors: "2.8.5" },
      devDependencies: { vitest: "1.0.0" },
    });
    const skill = mockSkill({
      files: [makeFile(pkgJson, "json", "package.json")],
    });
    const metrics = new MetricsAnalyzer(skill).analyze();
    expect(metrics.dependencyCount).toBe(3);
  });

  test("flags all deps as outdated when no lock file present", () => {
    const skill = mockSkill({
      manifest: {
        name: "no-lock",
        version: "1.0.0",
        permissions: [],
        dependencies: { a: "1.0.0", b: "2.0.0" },
      },
    });
    const detailed = new MetricsAnalyzer(skill).analyzeDetailed();
    expect(detailed.dependencyDetails.hasLockFile).toBe(false);
    expect(detailed.outdatedDependencies).toBe(2);
  });

  test("detects lock file presence", () => {
    const skill = mockSkill({
      manifest: {
        name: "locked",
        version: "1.0.0",
        permissions: [],
        dependencies: { a: "1.0.0" },
      },
      files: [makeFile("{}", "json", "bun.lockb")],
    });
    const detailed = new MetricsAnalyzer(skill).analyzeDetailed();
    expect(detailed.dependencyDetails.hasLockFile).toBe(true);
    expect(detailed.outdatedDependencies).toBe(0);
  });

  test("zero dependencies for empty manifest and no package.json", () => {
    const skill = mockSkill();
    const metrics = new MetricsAnalyzer(skill).analyze();
    expect(metrics.dependencyCount).toBe(0);
    expect(metrics.outdatedDependencies).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Maintenance health via analyzer
// ---------------------------------------------------------------------------
describe("MetricsAnalyzer: maintenance health", () => {
  test("detects test files", () => {
    const testFile = makeFile(
      'test("works", () => expect(1).toBe(1));',
      "typescript",
      "src/utils.test.ts",
    );
    const srcFile = makeFile("export const x = 1;", "typescript", "src/utils.ts");
    const skill = mockSkill({ files: [testFile, srcFile] });
    const detailed = new MetricsAnalyzer(skill).analyzeDetailed();

    expect(detailed.hasTests).toBe(true);
    expect(detailed.maintenanceDetails.hasTests).toBe(true);
    expect(detailed.maintenanceDetails.testFileCount).toBeGreaterThanOrEqual(1);
  });

  test("detects CI configuration (GitHub Actions)", () => {
    const ciFile = makeFile(
      "name: CI\non: push\njobs:\n  test:\n    runs-on: ubuntu-latest",
      "yaml",
      ".github/workflows/ci.yml",
    );
    const skill = mockSkill({ files: [ciFile] });
    const detailed = new MetricsAnalyzer(skill).analyzeDetailed();

    expect(detailed.maintenanceDetails.hasCIConfig).toBe(true);
    expect(detailed.maintenanceDetails.ciProvider).toBe("GitHub Actions");
  });

  test("detects TypeScript types", () => {
    const tsFile = makeFile("export const x: number = 1;", "typescript", "index.ts");
    const skill = mockSkill({ files: [tsFile] });
    const detailed = new MetricsAnalyzer(skill).analyzeDetailed();

    expect(detailed.hasTypes).toBe(true);
    expect(detailed.maintenanceDetails.hasTypes).toBe(true);
  });

  test("detects license from manifest", () => {
    const skill = mockSkill({
      manifest: {
        name: "licensed-skill",
        version: "1.0.0",
        license: "MIT",
        permissions: [],
        dependencies: {},
      },
    });
    const detailed = new MetricsAnalyzer(skill).analyzeDetailed();

    expect(detailed.hasLicense).toBe(true);
    expect(detailed.maintenanceDetails.hasLicense).toBe(true);
    expect(detailed.maintenanceDetails.licenseType).toBe("MIT");
  });

  test("detects license from LICENSE file", () => {
    const licenseFile = makeFile("MIT License\n\nCopyright (c) 2024 Test", "text", "LICENSE");
    const skill = mockSkill({ files: [licenseFile] });
    const detailed = new MetricsAnalyzer(skill).analyzeDetailed();

    expect(detailed.hasLicense).toBe(true);
    expect(detailed.maintenanceDetails.licenseType).toBe("MIT");
  });

  test("detects linter configuration", () => {
    const eslintFile = makeFile("{}", "json", "eslint.config.js");
    const skill = mockSkill({ files: [eslintFile] });
    const detailed = new MetricsAnalyzer(skill).analyzeDetailed();

    expect(detailed.maintenanceDetails.hasLinter).toBe(true);
  });

  test("detects formatter configuration", () => {
    const prettierFile = makeFile("{}", "json", ".prettierrc");
    const skill = mockSkill({ files: [prettierFile] });
    const detailed = new MetricsAnalyzer(skill).analyzeDetailed();

    expect(detailed.maintenanceDetails.hasFormatter).toBe(true);
  });

  test("detects .gitignore", () => {
    const gitignoreFile = makeFile("node_modules/\ndist/", "text", ".gitignore");
    const skill = mockSkill({ files: [gitignoreFile] });
    const detailed = new MetricsAnalyzer(skill).analyzeDetailed();

    expect(detailed.maintenanceDetails.hasGitignore).toBe(true);
  });

  test("maintenance score is 0-100 range", () => {
    const skill = mockSkill();
    const detailed = new MetricsAnalyzer(skill).analyzeDetailed();
    expect(detailed.maintenanceHealth).toBeGreaterThanOrEqual(0);
    expect(detailed.maintenanceHealth).toBeLessThanOrEqual(100);
  });

  test("well-maintained skill scores high", () => {
    const skill = mockSkill({
      manifest: {
        name: "good-skill",
        version: "1.0.0",
        license: "MIT",
        permissions: [],
        dependencies: {},
      },
      files: [
        makeFile("export const x: number = 1;", "typescript", "src/index.ts"),
        makeFile('test("works", () => {});', "typescript", "src/index.test.ts"),
        makeFile("name: CI\non: push", "yaml", ".github/workflows/ci.yml"),
        makeFile("{}", "json", "eslint.config.js"),
        makeFile("{}", "json", ".prettierrc"),
        makeFile("node_modules/", "text", ".gitignore"),
      ],
    });
    const detailed = new MetricsAnalyzer(skill).analyzeDetailed();
    // Should score at least 70 with tests, CI, types, license, linter, formatter, gitignore
    expect(detailed.maintenanceHealth).toBeGreaterThanOrEqual(70);
  });
});

// ---------------------------------------------------------------------------
// Full pipeline: realistic skill
// ---------------------------------------------------------------------------
describe("MetricsAnalyzer: full pipeline", () => {
  test("realistic skill produces coherent metrics", () => {
    const mainCode = `
/**
 * Search for items matching a query.
 */
export async function search(query: string): Promise<string[]> {
  if (!query) {
    return [];
  }
  const results: string[] = [];
  for (const item of database) {
    if (item.includes(query)) {
      results.push(item);
    }
  }
  return results;
}

/**
 * Format search results for display.
 */
export function formatResults(results: string[]): string {
  return results.length > 0
    ? results.join("\\n")
    : "No results found.";
}
`;
    const testCode = `
import { search, formatResults } from "./main";
test("search returns results", async () => {
  const results = await search("test");
  expect(results).toBeDefined();
});
`;
    const readmeContent =
      "# Search Skill\n\nA skill for searching.\n\n## Installation\n\n```bash\nbun install\n```\n\n## Usage\n\nImport and call `search(query)`. It returns matching results from the database. This is a comprehensive skill for text searching with multiple features and capabilities.";

    const pkgJson = JSON.stringify({
      name: "search-skill",
      version: "1.0.0",
      license: "MIT",
      dependencies: { zod: "3.22.4" },
      devDependencies: { typescript: "5.3.0" },
      scripts: { lint: "eslint ." },
    });

    const skill = mockSkill({
      manifest: {
        name: "search-skill",
        version: "1.0.0",
        description: "Search things",
        permissions: [],
        dependencies: { zod: "3.22.4" },
      },
      files: [
        makeFile(mainCode, "typescript", "src/main.ts"),
        makeFile(testCode, "typescript", "src/main.test.ts"),
        makeFile(readmeContent, "markdown", "readme.md"),
        makeFile(pkgJson, "json", "package.json"),
        makeFile("node_modules/\ndist/", "text", ".gitignore"),
      ],
    });

    const analyzer = new MetricsAnalyzer(skill);
    const metrics = analyzer.analyze();
    const detailed = analyzer.analyzeDetailed();

    // Complexity should be positive (has if, for, ternary)
    expect(metrics.codeComplexity).toBeGreaterThan(0);
    // Lines of code should be positive
    expect(metrics.linesOfCode).toBeGreaterThan(0);
    // Should detect README
    expect(metrics.hasReadme).toBe(true);
    // Should detect tests
    expect(metrics.hasTests).toBe(true);
    // Should detect types (TypeScript source)
    expect(metrics.hasTypes).toBe(true);
    // Should count dependencies
    expect(metrics.dependencyCount).toBeGreaterThanOrEqual(1);
    // Documentation score should be positive
    expect(metrics.documentationScore).toBeGreaterThan(0);
    // Maintenance health should be positive
    expect(metrics.maintenanceHealth).toBeGreaterThan(0);

    // Detailed results should have all breakdowns
    expect(detailed.complexityDetails.fileComplexities.length).toBeGreaterThan(0);
    expect(detailed.documentationDetails.hasReadme).toBe(true);
    expect(detailed.dependencyDetails.totalDependencies).toBeGreaterThanOrEqual(1);
    expect(detailed.maintenanceDetails.hasTests).toBe(true);
  });
});
