import { describe, expect, it } from "bun:test";
import { getOpenclawWorkspaceDir, OPENCLAW_SKILL_DIRS_V2 } from "../openclaw";

/**
 * Run `fn` with `OPENCLAW_PROFILE` set (or unset if `value` is undefined),
 * restoring the original env state afterwards.
 */
function withProfileEnv(value: string | undefined, fn: () => void): void {
  const original = process.env.OPENCLAW_PROFILE;
  if (value === undefined) {
    delete process.env.OPENCLAW_PROFILE;
  } else {
    process.env.OPENCLAW_PROFILE = value;
  }
  try {
    fn();
  } finally {
    if (original === undefined) {
      delete process.env.OPENCLAW_PROFILE;
    } else {
      process.env.OPENCLAW_PROFILE = original;
    }
  }
}

// ---------------------------------------------------------------------------
// OPENCLAW_SKILL_DIRS_V2
// ---------------------------------------------------------------------------

describe("OPENCLAW_SKILL_DIRS_V2", () => {
  it("has non-empty entries for darwin, linux, and win32", () => {
    for (const platform of ["darwin", "linux", "win32"] as const) {
      expect(OPENCLAW_SKILL_DIRS_V2[platform]).toBeDefined();
      expect(Array.isArray(OPENCLAW_SKILL_DIRS_V2[platform])).toBe(true);
      expect(OPENCLAW_SKILL_DIRS_V2[platform].length).toBeGreaterThan(0);
    }
  });

  it("includes the primary workspace default on darwin and linux", () => {
    expect(OPENCLAW_SKILL_DIRS_V2.darwin).toContain("~/.openclaw/workspace/skills");
    expect(OPENCLAW_SKILL_DIRS_V2.linux).toContain("~/.openclaw/workspace/skills");
  });

  it("includes the named-profile glob on darwin and linux", () => {
    expect(OPENCLAW_SKILL_DIRS_V2.darwin).toContain("~/.openclaw/workspace-*/skills");
    expect(OPENCLAW_SKILL_DIRS_V2.linux).toContain("~/.openclaw/workspace-*/skills");
  });

  it("includes the managed/legacy path on darwin and linux", () => {
    expect(OPENCLAW_SKILL_DIRS_V2.darwin).toContain("~/.openclaw/skills");
    expect(OPENCLAW_SKILL_DIRS_V2.linux).toContain("~/.openclaw/skills");
  });

  it("includes project fallback paths on darwin and linux", () => {
    for (const platform of ["darwin", "linux"] as const) {
      expect(OPENCLAW_SKILL_DIRS_V2[platform]).toContain("./skills");
      expect(OPENCLAW_SKILL_DIRS_V2[platform]).toContain("./.agents/skills");
    }
  });

  it("includes all expected win32 variants", () => {
    const win32 = OPENCLAW_SKILL_DIRS_V2.win32;
    expect(win32).toContain("%USERPROFILE%/.openclaw/workspace/skills");
    expect(win32).toContain("%USERPROFILE%/.openclaw/workspace-*/skills");
    expect(win32).toContain("%USERPROFILE%/.openclaw/skills");
    expect(win32).toContain("%APPDATA%/openclaw/skills");
    expect(win32).toContain("%LOCALAPPDATA%/openclaw/skills");
    expect(win32).toContain(".\\skills");
    expect(win32).toContain(".\\.agents\\skills");
  });

  it("includes the named-profile glob pattern on every platform", () => {
    for (const platform of ["darwin", "linux", "win32"] as const) {
      const hasGlob = OPENCLAW_SKILL_DIRS_V2[platform].some((p) => p.includes("workspace-*"));
      expect(hasGlob).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// getOpenclawWorkspaceDir
// ---------------------------------------------------------------------------

describe("getOpenclawWorkspaceDir", () => {
  it("returns the default workspace path when no profile is given and env is unset", () => {
    withProfileEnv(undefined, () => {
      expect(getOpenclawWorkspaceDir()).toBe("~/.openclaw/workspace");
    });
  });

  it("returns the default workspace path for an explicit 'default' profile", () => {
    expect(getOpenclawWorkspaceDir("default")).toBe("~/.openclaw/workspace");
  });

  it("returns a named-profile path for any non-default profile", () => {
    expect(getOpenclawWorkspaceDir("work")).toBe("~/.openclaw/workspace-work");
    expect(getOpenclawWorkspaceDir("personal")).toBe("~/.openclaw/workspace-personal");
  });

  it("treats an empty-string profile as a named profile (not default)", () => {
    // Empty string is not "default" and not nullish, so the function uses it
    // verbatim as the profile suffix. Documenting this edge case.
    expect(getOpenclawWorkspaceDir("")).toBe("~/.openclaw/workspace-");
  });

  it("honors OPENCLAW_PROFILE env var when no profile arg is passed", () => {
    withProfileEnv("staging", () => {
      expect(getOpenclawWorkspaceDir()).toBe("~/.openclaw/workspace-staging");
    });
  });

  it("returns default path when OPENCLAW_PROFILE env var is 'default'", () => {
    withProfileEnv("default", () => {
      expect(getOpenclawWorkspaceDir()).toBe("~/.openclaw/workspace");
    });
  });

  it("prefers the explicit profile argument over the env var", () => {
    withProfileEnv("staging", () => {
      expect(getOpenclawWorkspaceDir("prod")).toBe("~/.openclaw/workspace-prod");
      expect(getOpenclawWorkspaceDir("default")).toBe("~/.openclaw/workspace");
    });
  });
});
