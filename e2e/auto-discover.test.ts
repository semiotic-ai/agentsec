/**
 * e2e/auto-discover.test.ts -- Zero-argument auto-discovery integration test.
 *
 * Exercises `agentsec audit` with no arguments against a synthetic $HOME that
 * contains skills laid out for three agent platforms:
 *
 *   ~/.openclaw/skills/demo-openclaw   (OpenClaw default)
 *   ~/.agents/skills/demo-codex        (Codex / skills.sh default)
 *   ~/.claude/skills/demo-claude       (Claude Code default -- not yet scanned)
 *
 * The OpenClaw and Codex fixtures live at paths that are already default scan
 * roots (see OPENCLAW_SKILL_DIRS in @agentsec/shared/constants), so those
 * assertions pass today. The Claude fixture is asserted by a TODO-gated line
 * that unblocks once Claude Code default-path discovery ships.
 *
 * We also override cwd to a clean temp directory so the CLI doesn't pick up
 * skills from the repo's own `./skills` folder.
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
 * Fixture layout: [relative path under $HOME, skill name used in SKILL.md].
 *
 * Keep the set small -- each entry exercises one platform's default root.
 */
const FIXTURES: ReadonlyArray<readonly [string, string]> = [
  [".openclaw/skills/demo-openclaw", "demo-openclaw"],
  [".agents/skills/demo-codex", "demo-codex"],
  [".claude/skills/demo-claude", "demo-claude"],
];

beforeAll(() => {
  tempHome = mkdtempSync(join(tmpdir(), "agentsec-e2e-home-"));
  // A clean cwd avoids discovering `./skills` from the repo root.
  tempCwd = mkdtempSync(join(tmpdir(), "agentsec-e2e-cwd-"));

  for (const [rel, name] of FIXTURES) {
    const dir = join(tempHome, rel);
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, "SKILL.md"),
      `---\nname: ${name}\nversion: 1.0.0\ndescription: e2e auto-discover demo skill\n---\nBody.\n`,
    );
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

    // CLI should not crash. Zero-skill scans also exit 0, so we can't
    // assert on exitCode alone -- the output contents matter.
    expect(exitCode).toBe(0);

    // OpenClaw default root (~/.openclaw/skills) is already scanned today.
    expect(output).toContain("demo-openclaw");

    // Codex / skills.sh default root (~/.agents/skills) is already scanned
    // today -- it's listed in OPENCLAW_SKILL_DIRS for both darwin and linux.
    expect(output).toContain("demo-codex");

    // TODO: once Claude Code default-path discovery ships (scanning
    // ~/.claude/skills and ./.claude/skills in zero-arg mode), uncomment:
    // expect(output).toContain("demo-claude");
  }, 60_000);
});
