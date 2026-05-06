import { describe, expect, it } from "bun:test";
import { CODEX_SKILL_DIRS } from "../codex";

describe("CODEX_SKILL_DIRS", () => {
  it("exposes entries for darwin, linux, and win32", () => {
    expect(CODEX_SKILL_DIRS.darwin).toBeDefined();
    expect(CODEX_SKILL_DIRS.linux).toBeDefined();
    expect(CODEX_SKILL_DIRS.win32).toBeDefined();
  });

  it("has non-empty arrays for every supported platform", () => {
    for (const platform of ["darwin", "linux", "win32"] as const) {
      const dirs = CODEX_SKILL_DIRS[platform];
      expect(Array.isArray(dirs)).toBe(true);
      expect(dirs.length).toBeGreaterThan(0);
    }
  });

  it("includes the shared ~/.agents/skills path on darwin and linux", () => {
    expect(CODEX_SKILL_DIRS.darwin).toContain("~/.agents/skills");
    expect(CODEX_SKILL_DIRS.linux).toContain("~/.agents/skills");
  });

  it("includes project and parent .agents/skills on darwin and linux", () => {
    for (const platform of ["darwin", "linux"] as const) {
      expect(CODEX_SKILL_DIRS[platform]).toContain("./.agents/skills");
      expect(CODEX_SKILL_DIRS[platform]).toContain("../.agents/skills");
    }
  });

  it("includes the system /etc/codex/skills path on darwin and linux only", () => {
    expect(CODEX_SKILL_DIRS.darwin).toContain("/etc/codex/skills");
    expect(CODEX_SKILL_DIRS.linux).toContain("/etc/codex/skills");
    expect(CODEX_SKILL_DIRS.win32).not.toContain("/etc/codex/skills");
  });

  it("uses Windows-native variants on win32", () => {
    const win = CODEX_SKILL_DIRS.win32;
    expect(win).toContain("%USERPROFILE%/.agents/skills");
    expect(win).toContain(".\\.agents\\skills");
    expect(win).toContain("..\\.agents\\skills");
    expect(win).toContain("%PROGRAMDATA%/codex/skills");
  });

  it("does not leak POSIX tilde paths into win32 entries", () => {
    for (const dir of CODEX_SKILL_DIRS.win32) {
      expect(dir.startsWith("~")).toBe(false);
    }
  });
});
