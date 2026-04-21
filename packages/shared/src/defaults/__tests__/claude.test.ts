import { describe, expect, it } from "bun:test";
import { CLAUDE_SKILL_DIRS_V2 } from "../claude";

describe("CLAUDE_SKILL_DIRS_V2", () => {
  it("has entries for darwin, linux, and win32", () => {
    expect(CLAUDE_SKILL_DIRS_V2).toHaveProperty("darwin");
    expect(CLAUDE_SKILL_DIRS_V2).toHaveProperty("linux");
    expect(CLAUDE_SKILL_DIRS_V2).toHaveProperty("win32");
  });

  it("has a non-empty path list for each supported platform", () => {
    for (const platform of ["darwin", "linux", "win32"] as const) {
      const paths = CLAUDE_SKILL_DIRS_V2[platform] ?? [];
      expect(Array.isArray(paths)).toBe(true);
      expect(paths.length).toBeGreaterThan(0);
    }
  });

  it("includes personal, project, legacy, and plugin paths on darwin", () => {
    const paths = CLAUDE_SKILL_DIRS_V2.darwin ?? [];
    expect(paths).toContain("~/.claude/skills");
    expect(paths).toContain(".claude/skills");
    expect(paths).toContain("~/.claude/commands");
    expect(paths).toContain(".claude/commands");
    expect(paths).toContain("~/.claude/plugins/*/skills/*");
  });

  it("mirrors the darwin layout on linux", () => {
    expect(CLAUDE_SKILL_DIRS_V2.linux).toEqual(CLAUDE_SKILL_DIRS_V2.darwin ?? []);
  });

  it("uses %USERPROFILE% and backslash-separated project paths on win32", () => {
    const paths = CLAUDE_SKILL_DIRS_V2.win32 ?? [];
    expect(paths).toContain("%USERPROFILE%/.claude/skills");
    expect(paths).toContain(".claude\\skills");
    expect(paths).toContain("%USERPROFILE%/.claude/commands");
    expect(paths).toContain(".claude\\commands");
    expect(paths).toContain("%USERPROFILE%/.claude/plugins/*/skills/*");
  });
});
