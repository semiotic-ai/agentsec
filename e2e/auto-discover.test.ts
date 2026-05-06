/**
 * e2e/auto-discover.test.ts — Zero-argument auto-discovery integration test.
 *
 * Exercises `agentsec audit` with no arguments against a synthetic $HOME that
 * contains skills laid out for three agent platforms:
 *
 *   ~/.openclaw/workspace/skills/demo-openclaw  (OpenClaw workspace default)
 *   ~/.agents/skills/demo-codex                 (Codex / skills.sh default)
 *   ~/.claude/skills/demo-claude                (Claude Code personal default)
 *   <cwd>/skills/demo-generic                   (generic cwd walk)
 *
 * We override cwd to a controlled temp directory containing a generic
 * `./skills/demo-generic` fixture, which exercises the cwd-walk path.
 */

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const REPO_ROOT = resolve(import.meta.dir, "..");
const CLI_ENTRY = resolve(REPO_ROOT, "packages/cli/src/cli.ts");

let tempHome: string;
let tempCwd: string;

/**
 * Fixture layout: [root ("home" or "cwd"), relative path, skill name].
 *
 * Each entry exercises one platform's default root or the cwd generic walk.
 */
const FIXTURES: ReadonlyArray<readonly ["home" | "cwd", string, string]> = [
  ["home", ".openclaw/workspace/skills/demo-openclaw", "demo-openclaw"],
  ["home", ".agents/skills/demo-codex", "demo-codex"],
  ["home", ".claude/skills/demo-claude", "demo-claude"],
  ["cwd", "skills/demo-generic", "demo-generic"],
];

function writeSkill(dir: string, name: string): void {
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, "SKILL.md"),
    `---\nname: ${name}\nversion: 1.0.0\ndescription: e2e auto-discover demo skill\n---\nBody.\n`,
  );
}

beforeAll(() => {
  tempHome = mkdtempSync(join(tmpdir(), "agentsec-e2e-home-"));
  tempCwd = mkdtempSync(join(tmpdir(), "agentsec-e2e-cwd-"));

  for (const [root, rel, name] of FIXTURES) {
    const base = root === "home" ? tempHome : tempCwd;
    writeSkill(join(base, rel), name);
  }
});

afterAll(() => {
  rmSync(tempHome, { recursive: true, force: true });
  rmSync(tempCwd, { recursive: true, force: true });
});

/**
 * Run the CLI with an isolated HOME + cwd and return combined stdout/stderr.
 */
async function runAuditIsolated(): Promise<{ output: string; exitCode: number }> {
  const proc = Bun.spawn(["bun", CLI_ENTRY, "audit"], {
    cwd: tempCwd,
    stdout: "pipe",
    stderr: "pipe",
    env: {
      ...process.env,
      HOME: tempHome,
      NO_COLOR: "1",
    },
  });

  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  const exitCode = await proc.exited;
  return { output: stdout + stderr, exitCode };
}

describe("agentsec audit (zero-arg auto-discover)", () => {
  test("discovers skills across default platform locations", async () => {
    const { output, exitCode } = await runAuditIsolated();

    expect(exitCode).toBe(0);
    expect(output).toContain("demo-openclaw");
    expect(output).toContain("demo-codex");
    expect(output).toContain("demo-claude");
    expect(output).toContain("demo-generic");
  }, 60_000);
});
