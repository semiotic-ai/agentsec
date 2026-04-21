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
    const skills = await discoverAll({ platform: "darwin" });

    const names = skills.map((s) => s.name).sort();
    expect(names).toContain("claude-demo");
    expect(names).toContain("openclaw-demo");
    expect(names).toContain("codex-demo");
  });

  test("each skill is tagged with a sourceRoot", async () => {
    const skills = await discoverAll({ platform: "darwin" });

    for (const skill of skills) {
      const tagged = skill as typeof skill & { sourceRoot?: string };
      expect(tagged.sourceRoot).toBeDefined();
    }
  });

  test("returns different sourceRoots for different platforms", async () => {
    const skills = await discoverAll({ platform: "darwin" });

    const byName = new Map<string, string | undefined>();
    for (const skill of skills) {
      const tagged = skill as typeof skill & { sourceRoot?: string };
      byName.set(skill.name, tagged.sourceRoot);
    }

    const claude = byName.get("claude-demo");
    const openclaw = byName.get("openclaw-demo");
    const codex = byName.get("codex-demo");

    expect(claude).not.toBe(openclaw);
    expect(openclaw).not.toBe(codex);
    expect(claude).not.toBe(codex);
  });

  test("skills are deduplicated across overlapping roots", async () => {
    const skills = await discoverAll({ platform: "darwin" });

    const seen = new Set<string>();
    for (const skill of skills) {
      expect(seen.has(skill.path)).toBe(false);
      seen.add(skill.path);
    }
  });

  test("shallow option skips file contents", async () => {
    const skills = await discoverAll({ platform: "darwin", shallow: true });
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
        additionalPaths: [extraRoot],
      });
      const names = skills.map((s) => s.name);
      expect(names).toContain("extra-demo");
    } finally {
      await rm(extraRoot, { recursive: true, force: true });
    }
  });
});
