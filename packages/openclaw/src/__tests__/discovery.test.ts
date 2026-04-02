import { describe, expect, test } from "bun:test";
import { join, resolve } from "node:path";
import { SkillDiscovery } from "../discovery";

const FIXTURES_DIR = resolve(__dirname, "../../../../e2e/fixtures");

describe("SkillDiscovery", () => {
  // ---------------------------------------------------------------------------
  // getSearchDirectories
  // ---------------------------------------------------------------------------
  describe("getSearchDirectories", () => {
    test("returns darwin platform dirs by default on macOS", () => {
      const discovery = new SkillDiscovery({ platform: "darwin" });
      const dirs = discovery.getSearchDirectories();
      expect(dirs.length).toBeGreaterThan(0);
      expect(dirs.some((d) => d.includes("openclaw/skills"))).toBe(true);
    });

    test("returns linux platform dirs for linux", () => {
      const discovery = new SkillDiscovery({ platform: "linux" });
      const dirs = discovery.getSearchDirectories();
      expect(dirs.length).toBeGreaterThan(0);
      expect(dirs.some((d) => d.includes("openclaw/skills"))).toBe(true);
    });

    test("returns win32 platform dirs for Windows", () => {
      const discovery = new SkillDiscovery({ platform: "win32" });
      const dirs = discovery.getSearchDirectories();
      expect(dirs.length).toBeGreaterThan(0);
      expect(dirs.some((d) => d.includes("APPDATA"))).toBe(true);
    });

    test("returns empty for unknown platform", () => {
      const discovery = new SkillDiscovery({ platform: "freebsd" });
      const dirs = discovery.getSearchDirectories();
      expect(dirs).toEqual([]);
    });

    test("onlyPaths overrides platform defaults", () => {
      const discovery = new SkillDiscovery({
        platform: "darwin",
        onlyPaths: ["/custom/path"],
      });
      const dirs = discovery.getSearchDirectories();
      expect(dirs).toEqual(["/custom/path"]);
    });

    test("additionalPaths appends to platform defaults", () => {
      const discovery = new SkillDiscovery({
        platform: "darwin",
        additionalPaths: ["/extra/dir"],
      });
      const dirs = discovery.getSearchDirectories();
      expect(dirs[dirs.length - 1]).toBe("/extra/dir");
      // Should still contain platform defaults
      expect(dirs.length).toBeGreaterThan(1);
    });
  });

  // ---------------------------------------------------------------------------
  // expandPath
  // ---------------------------------------------------------------------------
  describe("expandPath", () => {
    const discovery = new SkillDiscovery();

    test("expands ~ to home directory", () => {
      const result = discovery.expandPath("~/some/dir");
      expect(result).not.toContain("~");
      expect(result).toMatch(/^\/|[A-Z]:\\/); // absolute path
    });

    test("expands bare ~ to home directory", () => {
      const result = discovery.expandPath("~");
      expect(result).not.toBe("~");
      expect(result.length).toBeGreaterThan(1);
    });

    test("resolves relative paths to absolute", () => {
      const result = discovery.expandPath("./relative");
      expect(result).toMatch(/^\/|[A-Z]:\\/);
    });

    test("leaves absolute paths unchanged (after resolve)", () => {
      const result = discovery.expandPath("/absolute/path");
      expect(result).toBe("/absolute/path");
    });
  });

  // ---------------------------------------------------------------------------
  // discover (using fixtures)
  // ---------------------------------------------------------------------------
  describe("discover", () => {
    test("discovers skills from fixture directory", async () => {
      const discovery = new SkillDiscovery({
        onlyPaths: [FIXTURES_DIR],
      });
      const skills = await discovery.discover();
      expect(skills.length).toBeGreaterThan(0);
    });

    test("returns deduplicated skills", async () => {
      // Pass the same directory twice
      const discovery = new SkillDiscovery({
        onlyPaths: [FIXTURES_DIR, FIXTURES_DIR],
      });
      const skills = await discovery.discover();
      const paths = skills.map((s) => s.path);
      const uniquePaths = [...new Set(paths)];
      expect(paths.length).toBe(uniquePaths.length);
    });

    test("skips non-existent directories gracefully", async () => {
      const discovery = new SkillDiscovery({
        onlyPaths: ["/non/existent/directory"],
      });
      const skills = await discovery.discover();
      expect(skills).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // scanDirectory
  // ---------------------------------------------------------------------------
  describe("scanDirectory", () => {
    test("scans fixture directory and finds skills with skill.json", async () => {
      const discovery = new SkillDiscovery();
      const skills = await discovery.scanDirectory(FIXTURES_DIR);
      expect(skills.length).toBeGreaterThan(0);

      const goodSkill = skills.find((s) => s.name === "code-formatter");
      expect(goodSkill).toBeDefined();
      expect(goodSkill!.manifest.version).toBe("1.2.0");
    });

    test("returns empty array for unreadable directory", async () => {
      const discovery = new SkillDiscovery();
      const skills = await discovery.scanDirectory("/no/such/dir");
      expect(skills).toEqual([]);
    });

    test("skips hidden directories", async () => {
      const discovery = new SkillDiscovery();
      const skills = await discovery.scanDirectory(FIXTURES_DIR);
      // None of the skill paths should be hidden directories
      for (const skill of skills) {
        const dirName = skill.path.split("/").pop()!;
        expect(dirName.startsWith(".")).toBe(false);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // parseSkill
  // ---------------------------------------------------------------------------
  describe("parseSkill", () => {
    test("parses a single known fixture skill", async () => {
      const discovery = new SkillDiscovery();
      const skill = await discovery.parseSkill(join(FIXTURES_DIR, "good-skill"));
      expect(skill).not.toBeNull();
      expect(skill!.name).toBe("code-formatter");
      expect(skill!.platform).toBe("openclaw");
    });

    test("returns null for directory without manifest", async () => {
      const discovery = new SkillDiscovery();
      const skill = await discovery.parseSkill("/tmp");
      expect(skill).toBeNull();
    });

    test("shallow parse skips file contents", async () => {
      const discovery = new SkillDiscovery({ shallow: true });
      const skill = await discovery.parseSkill(join(FIXTURES_DIR, "good-skill"));
      expect(skill).not.toBeNull();
      expect(skill!.files).toEqual([]);
    });
  });
});
