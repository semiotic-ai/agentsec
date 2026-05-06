import { describe, expect, it } from "bun:test";
import { inferPlatformFromPath } from "../infer-platform";

describe("inferPlatformFromPath", () => {
  describe("claude platform", () => {
    it("matches /.claude/skills/ paths", () => {
      expect(inferPlatformFromPath("/Users/x/.claude/skills/foo")).toBe("claude");
    });

    it("matches /.claude/commands/ paths", () => {
      expect(inferPlatformFromPath("/Users/x/.claude/commands/bar")).toBe("claude");
    });

    it("matches /.claude/plugins/ paths", () => {
      expect(inferPlatformFromPath("/Users/x/.claude/plugins/p/skills/baz")).toBe("claude");
    });

    it("matches Windows-style backslash paths after normalization", () => {
      expect(inferPlatformFromPath("C:\\Users\\x\\.claude\\skills\\foo")).toBe("claude");
    });
  });

  describe("openclaw platform", () => {
    it("matches /.openclaw/workspace/skills/ paths", () => {
      expect(inferPlatformFromPath("/Users/x/.openclaw/workspace/skills/foo")).toBe("openclaw");
    });

    it("matches /.openclaw/skills/ paths", () => {
      expect(inferPlatformFromPath("/Users/x/.openclaw/skills/foo")).toBe("openclaw");
    });
  });

  describe("codex platform", () => {
    it("matches /.agents/skills/ paths", () => {
      expect(inferPlatformFromPath("/Users/x/.agents/skills/foo")).toBe("codex");
    });

    it("matches /etc/codex/ paths", () => {
      expect(inferPlatformFromPath("/etc/codex/skills/foo")).toBe("codex");
    });

    it("matches /.codex/ paths", () => {
      expect(inferPlatformFromPath("/Users/x/.codex/skills/foo")).toBe("codex");
    });
  });

  describe("no match", () => {
    it("returns null for unrelated paths", () => {
      expect(inferPlatformFromPath("/some/random/dir")).toBeNull();
    });

    it("returns null for empty strings", () => {
      expect(inferPlatformFromPath("")).toBeNull();
    });
  });
});
