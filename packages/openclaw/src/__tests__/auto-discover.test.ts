import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { discoverAll } from "../auto-discover";

/** Create a SKILL.md for a given directory with a minimal front-matter. */
async function writeSkillMd(dir: string, name: string): Promise<void> {
  const body = `---
name: ${name}
description: Test fixture skill ${name}
version: 1.0.0
---

# ${name}

body
`;
  await writeFile(join(dir, "SKILL.md"), body, "utf-8");
}

describe("discoverAll", () => {
  let fixtureHome: string;
  let originalHome: string | undefined;

  beforeEach(async () => {
    fixtureHome = await mkdtemp(join(tmpdir(), "agentsec-discoverAll-"));

    const claudeSkill = join(fixtureHome, ".claude", "skills", "claude-demo");
    const openclawSkill = join(fixtureHome, ".openclaw", "workspace", "skills", "openclaw-demo");
    const codexSkill = join(fixtureHome, ".agents", "skills", "codex-demo");

    await mkdir(claudeSkill, { recursive: true });
    await mkdir(openclawSkill, { recursive: true });
    await mkdir(codexSkill, { recursive: true });

    await writeSkillMd(claudeSkill, "claude-demo");
    await writeSkillMd(openclawSkill, "openclaw-demo");
    await writeSkillMd(codexSkill, "codex-demo");

    originalHome = process.env.HOME;
    process.env.HOME = fixtureHome;
  });

  afterEach(async () => {
    if (originalHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = originalHome;
    }
    await rm(fixtureHome, { recursive: true, force: true });
  });

  test("discovers skills across all three platform default roots", async () => {
    const skills = await discoverAll({ platform: "darwin", cwd: null });

    const names = skills.map((s) => s.name).sort();
    expect(names).toContain("claude-demo");
    expect(names).toContain("openclaw-demo");
    expect(names).toContain("codex-demo");
  });

  test("tags each skill with its sourceRoot and inferred platform", async () => {
    const skills = await discoverAll({ platform: "darwin", cwd: null });
    const byName = new Map(skills.map((s) => [s.name, s] as const));

    expect(byName.get("claude-demo")?.discoveredAs).toBe("claude");
    expect(byName.get("openclaw-demo")?.discoveredAs).toBe("openclaw");
    expect(byName.get("codex-demo")?.discoveredAs).toBe("codex");

    for (const skill of skills) {
      expect(skill.sourceRoot).toBeDefined();
    }
  });

  test("skills are deduplicated across overlapping roots", async () => {
    const skills = await discoverAll({ platform: "darwin", cwd: null });

    const seen = new Set<string>();
    for (const skill of skills) {
      expect(seen.has(skill.path)).toBe(false);
      seen.add(skill.path);
    }
  });

  test("shallow option skips file contents", async () => {
    const skills = await discoverAll({ platform: "darwin", cwd: null, shallow: true });
    expect(skills.length).toBeGreaterThan(0);
    for (const skill of skills) {
      expect(skill.files).toEqual([]);
    }
  });

  test("additionalPaths are also scanned", async () => {
    const extraRoot = await mkdtemp(join(tmpdir(), "agentsec-discoverAll-extra-"));
    const extraSkill = join(extraRoot, "extra-demo");
    await mkdir(extraSkill, { recursive: true });
    await writeSkillMd(extraSkill, "extra-demo");

    try {
      const skills = await discoverAll({
        platform: "darwin",
        cwd: null,
        additionalPaths: [extraRoot],
      });
      const names = skills.map((s) => s.name);
      expect(names).toContain("extra-demo");
    } finally {
      await rm(extraRoot, { recursive: true, force: true });
    }
  });

  test("cwd walker discovers a generic ./skills directory", async () => {
    const cwdFixture = await mkdtemp(join(tmpdir(), "agentsec-discoverAll-cwd-"));
    const genericSkill = join(cwdFixture, "skills", "generic-demo");
    await mkdir(genericSkill, { recursive: true });
    await writeSkillMd(genericSkill, "generic-demo");

    try {
      const skills = await discoverAll({ platform: "darwin", cwd: cwdFixture });
      const names = skills.map((s) => s.name);
      expect(names).toContain("generic-demo");
    } finally {
      await rm(cwdFixture, { recursive: true, force: true });
    }
  });

  test("cwd walker respects depth limit", async () => {
    const cwdFixture = await mkdtemp(join(tmpdir(), "agentsec-discoverAll-depth-"));
    // Place a skills/ dir 3 levels deep. Default depth=2 should NOT find it.
    const deepSkill = join(cwdFixture, "a", "b", "c", "skills", "deep-demo");
    await mkdir(deepSkill, { recursive: true });
    await writeSkillMd(deepSkill, "deep-demo");

    try {
      const skillsShallow = await discoverAll({
        platform: "darwin",
        cwd: cwdFixture,
        cwdDepth: 2,
      });
      expect(skillsShallow.map((s) => s.name)).not.toContain("deep-demo");

      const skillsDeep = await discoverAll({
        platform: "darwin",
        cwd: cwdFixture,
        cwdDepth: 4,
      });
      expect(skillsDeep.map((s) => s.name)).toContain("deep-demo");
    } finally {
      await rm(cwdFixture, { recursive: true, force: true });
    }
  });
});
