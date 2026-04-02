import { describe, test, expect } from "bun:test";
import { resolve, join } from "node:path";
import { mkdtemp, writeFile, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { SkillParser } from "../parser";
import { findAndParseManifest, parseManifestFile } from "../manifest";
import {
  detectLanguage,
  detectManifestFormat,
  normalizeManifest,
  SKIP_PATTERNS,
  MANIFEST_FILENAMES,
} from "../formats";
import { walkSkillDirectory } from "../walker";

const FIXTURES_DIR = resolve(__dirname, "../../../../e2e/fixtures");

// ---------------------------------------------------------------------------
// detectLanguage
// ---------------------------------------------------------------------------
describe("detectLanguage", () => {
  test("detects TypeScript (.ts)", () => {
    expect(detectLanguage("index.ts")).toBe("typescript");
  });

  test("detects TypeScript JSX (.tsx)", () => {
    expect(detectLanguage("component.tsx")).toBe("typescript");
  });

  test("detects JavaScript (.js)", () => {
    expect(detectLanguage("main.js")).toBe("javascript");
  });

  test("detects JavaScript (.mjs, .cjs)", () => {
    expect(detectLanguage("lib.mjs")).toBe("javascript");
    expect(detectLanguage("config.cjs")).toBe("javascript");
  });

  test("detects Python (.py)", () => {
    expect(detectLanguage("script.py")).toBe("python");
  });

  test("detects shell scripts (.sh)", () => {
    expect(detectLanguage("run.sh")).toBe("shell");
  });

  test("detects other shell variants (.bash, .zsh, .fish)", () => {
    expect(detectLanguage("init.bash")).toBe("shell");
    expect(detectLanguage("config.zsh")).toBe("shell");
    expect(detectLanguage("env.fish")).toBe("shell");
  });

  test("detects markdown (.md)", () => {
    expect(detectLanguage("README.md")).toBe("markdown");
  });

  test("detects JSON (.json)", () => {
    expect(detectLanguage("package.json")).toBe("json");
  });

  test("detects YAML (.yaml, .yml)", () => {
    expect(detectLanguage("config.yaml")).toBe("yaml");
    expect(detectLanguage("data.yml")).toBe("yaml");
  });

  test("returns unknown for unrecognized extensions", () => {
    expect(detectLanguage("data.xyz")).toBe("unknown");
  });

  test("returns unknown for files without extensions", () => {
    expect(detectLanguage("Makefile")).toBe("unknown");
  });

  test("handles paths with directories", () => {
    expect(detectLanguage("/some/path/to/file.ts")).toBe("typescript");
  });

  test("handles case insensitivity via lowercase", () => {
    // The function lowercases the extension before lookup
    expect(detectLanguage("file.TS")).toBe("typescript");
    expect(detectLanguage("file.PY")).toBe("python");
  });
});

// ---------------------------------------------------------------------------
// detectManifestFormat
// ---------------------------------------------------------------------------
describe("detectManifestFormat", () => {
  test("detects skill.json format", () => {
    expect(detectManifestFormat("skill.json")).toBe("skill-json");
  });

  test("detects skill.yaml format", () => {
    expect(detectManifestFormat("skill.yaml")).toBe("skill-yaml");
  });

  test("detects skill.yml format", () => {
    expect(detectManifestFormat("skill.yml")).toBe("skill-yaml");
  });

  test("detects SKILL.md format (case-insensitive)", () => {
    expect(detectManifestFormat("SKILL.md")).toBe("skill-md");
    expect(detectManifestFormat("skill.md")).toBe("skill-md");
  });

  test("detects package.json format", () => {
    expect(detectManifestFormat("package.json")).toBe("package-json");
  });

  test("detects manifest.json format", () => {
    expect(detectManifestFormat("manifest.json")).toBe("manifest-json");
  });

  test("returns null for unknown filenames", () => {
    expect(detectManifestFormat("readme.md")).toBeNull();
    expect(detectManifestFormat("config.json")).toBeNull();
    expect(detectManifestFormat("index.ts")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// normalizeManifest
// ---------------------------------------------------------------------------
describe("normalizeManifest", () => {
  test("normalizes from skill-json (direct mapping)", () => {
    const raw = {
      name: "test-skill",
      version: "1.0.0",
      description: "A test skill",
      author: "tester",
      permissions: ["clipboard:read"],
    };
    const manifest = normalizeManifest(raw, "skill-json");
    expect(manifest.name).toBe("test-skill");
    expect(manifest.version).toBe("1.0.0");
    expect(manifest.description).toBe("A test skill");
    expect(manifest.author).toBe("tester");
    expect(manifest.permissions).toEqual(["clipboard:read"]);
  });

  test("normalizes from manifest-json (direct mapping)", () => {
    const raw = { name: "my-skill", version: "2.0.0" };
    const manifest = normalizeManifest(raw, "manifest-json");
    expect(manifest.name).toBe("my-skill");
    expect(manifest.version).toBe("2.0.0");
  });

  test("normalizes from skill-yaml (direct mapping)", () => {
    const raw = {
      name: "yaml-skill",
      version: "0.1.0",
      description: "A YAML skill",
    };
    const manifest = normalizeManifest(raw, "skill-yaml");
    expect(manifest.name).toBe("yaml-skill");
    expect(manifest.version).toBe("0.1.0");
  });

  test("normalizes from package-json with openclaw key", () => {
    const raw = {
      name: "pkg-name",
      version: "3.0.0",
      description: "pkg desc",
      openclaw: {
        name: "openclaw-name",
        permissions: ["shell:execute"],
      },
    };
    const manifest = normalizeManifest(raw, "package-json");
    // openclaw.name overrides top-level name
    expect(manifest.name).toBe("openclaw-name");
    // version falls back to top-level
    expect(manifest.version).toBe("3.0.0");
    expect(manifest.permissions).toEqual(["shell:execute"]);
  });

  test("normalizes from package-json with skill key", () => {
    const raw = {
      name: "pkg-name",
      version: "1.0.0",
      skill: {
        permissions: ["network:unrestricted"],
        entrypoint: "dist/main.js",
      },
    };
    const manifest = normalizeManifest(raw, "package-json");
    expect(manifest.permissions).toEqual(["network:unrestricted"]);
    expect(manifest.entrypoint).toBe("dist/main.js");
  });

  test("normalizes from package-json with author object", () => {
    const raw = {
      name: "auth-test",
      version: "1.0.0",
      author: { name: "Jane Doe", email: "jane@example.com" },
    };
    const manifest = normalizeManifest(raw, "package-json");
    expect(manifest.author).toBe("Jane Doe");
  });

  test("uses defaults for missing name and version", () => {
    const raw = {};
    const manifest = normalizeManifest(raw, "skill-json");
    expect(manifest.name).toBe("unknown");
    expect(manifest.version).toBe("0.0.0");
  });

  test("passes through extra keys", () => {
    const raw = {
      name: "extra-test",
      version: "1.0.0",
      engine: "openclaw@^0.9.0",
      customField: "value",
    };
    const manifest = normalizeManifest(raw, "skill-json");
    expect(manifest.engine).toBe("openclaw@^0.9.0");
    expect(manifest.customField).toBe("value");
  });

  test("maps entrypoint from main or entry aliases", () => {
    const raw = { name: "ep", version: "1.0.0", main: "src/index.ts" };
    const manifest = normalizeManifest(raw, "skill-json");
    expect(manifest.entrypoint).toBe("src/index.ts");
  });
});

// ---------------------------------------------------------------------------
// YAML frontmatter parsing (via findAndParseManifest with SKILL.md)
// ---------------------------------------------------------------------------
describe("YAML frontmatter parsing", () => {
  let tempDir: string;

  async function createTempSkill(
    skillMdContent: string,
  ): Promise<string> {
    tempDir = await mkdtemp(join(tmpdir(), "openclaw-test-"));
    await writeFile(join(tempDir, "SKILL.md"), skillMdContent);
    return tempDir;
  }

  test("parses SKILL.md with YAML frontmatter", async () => {
    const dir = await createTempSkill(`---
name: frontmatter-skill
version: 1.0.0
description: A skill with frontmatter
author: test-author
permissions:
  - clipboard:read
  - network:unrestricted
---

# Frontmatter Skill

This is the body content.
`);
    const result = await findAndParseManifest(dir);
    expect(result).not.toBeNull();
    expect(result!.format).toBe("skill-md");
    expect(result!.filename).toBe("SKILL.md");
    expect(result!.manifest.name).toBe("frontmatter-skill");
    expect(result!.manifest.version).toBe("1.0.0");
    expect(result!.manifest.author).toBe("test-author");
    expect(result!.manifest.permissions).toEqual([
      "clipboard:read",
      "network:unrestricted",
    ]);
    await rm(tempDir, { recursive: true });
  });

  test("uses body as description when frontmatter has none", async () => {
    const dir = await createTempSkill(`---
name: no-desc-skill
version: 0.1.0
---

# My Skill

This paragraph should become the description.
`);
    const result = await findAndParseManifest(dir);
    expect(result).not.toBeNull();
    expect(result!.manifest.description).toBe(
      "This paragraph should become the description.",
    );
    await rm(tempDir, { recursive: true });
  });

  test("extracts from bare markdown without frontmatter", async () => {
    const dir = await createTempSkill(`# Bare Skill

A bare markdown skill without YAML frontmatter.
`);
    const result = await findAndParseManifest(dir);
    expect(result).not.toBeNull();
    expect(result!.manifest.name).toBe("Bare Skill");
    expect(result!.manifest.version).toBe("0.0.0");
    await rm(tempDir, { recursive: true });
  });

  test("returns null for empty SKILL.md", async () => {
    const dir = await createTempSkill("");
    const result = await findAndParseManifest(dir);
    // Empty content has no heading to extract, so no manifest
    expect(result).toBeNull();
    await rm(tempDir, { recursive: true });
  });
});

// ---------------------------------------------------------------------------
// findAndParseManifest (priority order, real fixtures)
// ---------------------------------------------------------------------------
describe("findAndParseManifest", () => {
  test("parses skill.json from good-skill fixture", async () => {
    const result = await findAndParseManifest(
      join(FIXTURES_DIR, "good-skill"),
    );
    expect(result).not.toBeNull();
    expect(result!.format).toBe("skill-json");
    expect(result!.manifest.name).toBe("code-formatter");
    expect(result!.manifest.version).toBe("1.2.0");
  });

  test("parses package.json from supply-chain fixture", async () => {
    // supply-chain-skill has both skill.json and package.json,
    // but skill.json has higher priority in MANIFEST_FILENAMES
    const result = await findAndParseManifest(
      join(FIXTURES_DIR, "supply-chain-skill"),
    );
    expect(result).not.toBeNull();
    expect(result!.manifest.name).toBeDefined();
  });

  test("returns null for directory with no manifest", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "no-manifest-"));
    const result = await findAndParseManifest(tempDir);
    expect(result).toBeNull();
    await rm(tempDir, { recursive: true });
  });
});

// ---------------------------------------------------------------------------
// parseManifestFile
// ---------------------------------------------------------------------------
describe("parseManifestFile", () => {
  test("parses a known skill.json file", async () => {
    const filePath = join(FIXTURES_DIR, "good-skill", "skill.json");
    const result = await parseManifestFile(filePath, "skill.json");
    expect(result.manifest.name).toBe("code-formatter");
    expect(result.format).toBe("skill-json");
  });

  test("throws for unrecognized manifest filename", async () => {
    await expect(
      parseManifestFile("/tmp/foo.txt", "foo.txt"),
    ).rejects.toThrow("Unrecognized manifest filename");
  });
});

// ---------------------------------------------------------------------------
// SKIP_PATTERNS (walker)
// ---------------------------------------------------------------------------
describe("SKIP_PATTERNS", () => {
  test("includes node_modules", () => {
    expect(SKIP_PATTERNS).toContain("node_modules");
  });

  test("includes .git", () => {
    expect(SKIP_PATTERNS).toContain(".git");
  });

  test("includes dist", () => {
    expect(SKIP_PATTERNS).toContain("dist");
  });

  test("includes build", () => {
    expect(SKIP_PATTERNS).toContain("build");
  });

  test("includes __pycache__", () => {
    expect(SKIP_PATTERNS).toContain("__pycache__");
  });

  test("includes .DS_Store", () => {
    expect(SKIP_PATTERNS).toContain(".DS_Store");
  });
});

// ---------------------------------------------------------------------------
// walkSkillDirectory
// ---------------------------------------------------------------------------
describe("walkSkillDirectory", () => {
  test("walks fixture skill and returns source files", async () => {
    const files = await walkSkillDirectory(
      join(FIXTURES_DIR, "good-skill"),
    );
    expect(files.length).toBeGreaterThan(0);

    // Should find the source file
    const srcFile = files.find((f) => f.relativePath === "src/index.ts");
    expect(srcFile).toBeDefined();
    expect(srcFile!.language).toBe("typescript");
    expect(srcFile!.content.length).toBeGreaterThan(0);
  });

  test("skips node_modules and .git directories", async () => {
    // Create a temp dir with a node_modules subdirectory
    const tempDir = await mkdtemp(join(tmpdir(), "walker-test-"));
    await mkdir(join(tempDir, "node_modules"), { recursive: true });
    await writeFile(
      join(tempDir, "node_modules", "evil.js"),
      "module.exports = 'nope';",
    );
    await mkdir(join(tempDir, ".git"), { recursive: true });
    await writeFile(join(tempDir, ".git", "HEAD"), "ref: refs/heads/main");
    await writeFile(join(tempDir, "index.ts"), "export const x = 1;");

    const files = await walkSkillDirectory(tempDir);

    // Should only find index.ts, not files in node_modules or .git
    expect(files.length).toBe(1);
    expect(files[0].relativePath).toBe("index.ts");

    await rm(tempDir, { recursive: true });
  });

  test("skips dist and build directories", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "walker-skip-"));
    await mkdir(join(tempDir, "dist"), { recursive: true });
    await writeFile(join(tempDir, "dist", "bundle.js"), "compiled");
    await mkdir(join(tempDir, "build"), { recursive: true });
    await writeFile(join(tempDir, "build", "output.js"), "built");
    await writeFile(join(tempDir, "main.ts"), "export const y = 2;");

    const files = await walkSkillDirectory(tempDir);
    expect(files.length).toBe(1);
    expect(files[0].relativePath).toBe("main.ts");

    await rm(tempDir, { recursive: true });
  });

  test("returns empty array for non-existent directory", async () => {
    const files = await walkSkillDirectory("/no/such/dir");
    expect(files).toEqual([]);
  });

  test("detects language for walked files", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "walker-lang-"));
    await writeFile(join(tempDir, "app.py"), "print('hello')");
    await writeFile(join(tempDir, "run.sh"), "echo hello");
    await writeFile(join(tempDir, "lib.ts"), "export const a = 1;");

    const files = await walkSkillDirectory(tempDir);
    const languages = new Map(
      files.map((f) => [f.relativePath, f.language]),
    );

    expect(languages.get("app.py")).toBe("python");
    expect(languages.get("run.sh")).toBe("shell");
    expect(languages.get("lib.ts")).toBe("typescript");

    await rm(tempDir, { recursive: true });
  });

  test("skips empty files", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "walker-empty-"));
    await writeFile(join(tempDir, "empty.ts"), "");
    await writeFile(join(tempDir, "notempty.ts"), "const x = 1;");

    const files = await walkSkillDirectory(tempDir);
    expect(files.length).toBe(1);
    expect(files[0].relativePath).toBe("notempty.ts");

    await rm(tempDir, { recursive: true });
  });
});

// ---------------------------------------------------------------------------
// SkillParser
// ---------------------------------------------------------------------------
describe("SkillParser", () => {
  const parser = new SkillParser();

  describe("parse", () => {
    test("parses a valid skill directory", async () => {
      const skill = await parser.parse(join(FIXTURES_DIR, "good-skill"));
      expect(skill).not.toBeNull();
      expect(skill!.id).toContain("code-formatter");
      expect(skill!.name).toBe("code-formatter");
      expect(skill!.version).toBe("1.2.0");
      expect(skill!.platform).toBe("openclaw");
      expect(skill!.path).toBe(join(FIXTURES_DIR, "good-skill"));
      expect(skill!.files.length).toBeGreaterThan(0);
    });

    test("returns null for directory without manifest", async () => {
      const tempDir = await mkdtemp(join(tmpdir(), "no-manifest-"));
      await writeFile(join(tempDir, "index.ts"), "export const x = 1;");
      const skill = await parser.parse(tempDir);
      expect(skill).toBeNull();
      await rm(tempDir, { recursive: true });
    });

    test("shallow parse returns no files", async () => {
      const skill = await parser.parse(join(FIXTURES_DIR, "good-skill"), {
        shallow: true,
      });
      expect(skill).not.toBeNull();
      expect(skill!.files).toEqual([]);
      expect(skill!.name).toBe("code-formatter");
    });

    test("derives skill ID from manifest name and version", async () => {
      const skill = await parser.parse(join(FIXTURES_DIR, "good-skill"));
      expect(skill).not.toBeNull();
      expect(skill!.id).toBe("code-formatter@1.2.0");
    });

    test("derives skill ID from directory name when name is unknown", async () => {
      const tempDir = await mkdtemp(join(tmpdir(), "unnamed-skill-"));
      // Create a skill.json with no name
      await writeFile(
        join(tempDir, "skill.json"),
        JSON.stringify({ version: "1.0.0" }),
      );
      const skill = await parser.parse(tempDir);
      expect(skill).not.toBeNull();
      // ID should fall back to directory basename
      const dirName = tempDir.split("/").pop()!;
      expect(skill!.id).toContain(dirName);
      await rm(tempDir, { recursive: true });
    });
  });

  describe("parseOrThrow", () => {
    test("returns skill for valid directory", async () => {
      const skill = await parser.parseOrThrow(
        join(FIXTURES_DIR, "good-skill"),
      );
      expect(skill.name).toBe("code-formatter");
    });

    test("throws for directory without manifest", async () => {
      const tempDir = await mkdtemp(join(tmpdir(), "parseorthrow-"));
      await expect(parser.parseOrThrow(tempDir)).rejects.toThrow(
        "No valid skill manifest found",
      );
      await rm(tempDir, { recursive: true });
    });
  });

  describe("fromManifest", () => {
    test("creates AgentSkill from manifest and path", () => {
      const manifest = {
        name: "test-skill",
        version: "2.0.0",
        description: "test",
      };
      const skill = parser.fromManifest("/path/to/skill", manifest);
      expect(skill.id).toBe("test-skill@2.0.0");
      expect(skill.name).toBe("test-skill");
      expect(skill.version).toBe("2.0.0");
      expect(skill.path).toBe("/path/to/skill");
      expect(skill.platform).toBe("openclaw");
      expect(skill.files).toEqual([]);
    });
  });
});

// ---------------------------------------------------------------------------
// MANIFEST_FILENAMES constant
// ---------------------------------------------------------------------------
describe("MANIFEST_FILENAMES", () => {
  test("contains all expected manifest filenames", () => {
    expect(MANIFEST_FILENAMES).toContain("skill.json");
    expect(MANIFEST_FILENAMES).toContain("skill.yaml");
    expect(MANIFEST_FILENAMES).toContain("skill.yml");
    expect(MANIFEST_FILENAMES).toContain("SKILL.md");
    expect(MANIFEST_FILENAMES).toContain("package.json");
    expect(MANIFEST_FILENAMES).toContain("manifest.json");
  });

  test("skill.json has highest priority (first position)", () => {
    expect(MANIFEST_FILENAMES[0]).toBe("skill.json");
  });
});
