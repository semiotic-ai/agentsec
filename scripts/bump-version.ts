#!/usr/bin/env bun
/**
 * Bump the agentsec version across every place it's stamped.
 *
 * Usage:
 *   bun run bump 0.1.6                    # bump to 0.1.6, regenerate examples
 *   bun run bump 0.1.6 --skip-examples    # skip the report regeneration step
 *   bun run bump --help
 *
 * What this touches: see `scripts/version-stamps.ts` for the full list. As a
 * final step it copies skills/agentsec/SKILL.md → apps/landing/public/skill.md
 * so the landing-site mirror can never drift from the canonical SKILL.md.
 *
 * What this does NOT do:
 *   - Commit, tag, or push. You review the diff and commit yourself.
 *   - Publish to npm — that happens via .github/workflows/release.yml on tag.
 *   - Re-index ClawHub. ClawHub re-fetches the SKILL.md on its own schedule;
 *     if a manual re-index is needed, do it from the ClawHub side.
 */

import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import {
  assertSemver,
  compareSemver,
  fillPattern,
  readCanonicalVersion,
  SKILL_MIRROR,
  STAMPS,
} from "./version-stamps";

const REPO_ROOT = resolve(import.meta.dir, "..");

function printUsage(): void {
  console.log(`Usage: bun run bump <new-version> [--skip-examples]

  <new-version>      Target semver, e.g. 0.1.6
  --skip-examples    Don't regenerate sample audit reports
  -h, --help         Show this message

Stamps updated (${STAMPS.length}):
${STAMPS.map((s) => `  - ${s.file}  (${s.description})`).join("\n")}

After bumping: review with \`git diff\`, then commit. The release workflow
publishes to npm when you push a v<version> tag.`);
}

async function rewriteFile(
  filePath: string,
  pattern: string,
  oldVersion: string,
  newVersion: string,
): Promise<void> {
  const absPath = `${REPO_ROOT}/${filePath}`;
  const before = await Bun.file(absPath).text();
  const oldStr = fillPattern(pattern, oldVersion);
  const newStr = fillPattern(pattern, newVersion);

  const occurrences = before.split(oldStr).length - 1;
  if (occurrences === 0) {
    throw new Error(
      `[${filePath}] pattern not found:\n  ${JSON.stringify(oldStr)}\n` +
        `  Either the file was edited manually, or the pattern in version-stamps.ts is wrong.`,
    );
  }
  if (occurrences > 1) {
    throw new Error(
      `[${filePath}] pattern matched ${occurrences} times — must be unique:\n` +
        `  ${JSON.stringify(oldStr)}\n  Tighten the pattern in version-stamps.ts.`,
    );
  }

  const after = before.replace(oldStr, newStr);
  await Bun.write(absPath, after);
}

async function mirrorSkillFile(): Promise<void> {
  const sourcePath = `${REPO_ROOT}/${SKILL_MIRROR.source}`;
  const mirrorPath = `${REPO_ROOT}/${SKILL_MIRROR.mirror}`;
  const text = await Bun.file(sourcePath).text();
  await Bun.write(mirrorPath, text);
}

function regenerateExamples(): void {
  const targets: { format: string; ext: string }[] = [
    { format: "text", ext: "txt" },
    { format: "json", ext: "json" },
    { format: "html", ext: "html" },
    { format: "sarif", ext: "sarif" },
  ];

  for (const { format, ext } of targets) {
    for (const dir of ["examples", "apps/landing/public/examples"]) {
      const out = `${REPO_ROOT}/${dir}/audit-report.${ext}`;
      const result = spawnSync(
        "bun",
        [
          "packages/cli/src/cli.ts",
          "audit",
          "--path",
          "./e2e/fixtures",
          "--format",
          format,
          "--output",
          out,
          "--no-color",
        ],
        { cwd: REPO_ROOT, stdio: "inherit" },
      );
      if (result.status !== 0) {
        throw new Error(`Failed to regenerate ${out}`);
      }
    }
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes("-h") || args.includes("--help")) {
    printUsage();
    process.exit(args.length === 0 ? 1 : 0);
  }

  const positional = args.filter((a) => !a.startsWith("-"));
  const skipExamples = args.includes("--skip-examples");

  if (positional.length !== 1) {
    console.error("error: expected exactly one positional argument (the new version)\n");
    printUsage();
    process.exit(1);
  }

  const newVersion = positional[0];
  assertSemver(newVersion);

  const oldVersion = await readCanonicalVersion(REPO_ROOT);
  assertSemver(oldVersion);

  if (oldVersion === newVersion) {
    console.error(`error: already at ${oldVersion} — pick a different version`);
    process.exit(1);
  }
  if (compareSemver(newVersion, oldVersion) < 0) {
    console.error(
      `error: ${newVersion} < ${oldVersion} (use --force in code if you really mean to downgrade)`,
    );
    process.exit(1);
  }

  console.log(`Bumping ${oldVersion} → ${newVersion}\n`);

  for (const stamp of STAMPS) {
    await rewriteFile(stamp.file, stamp.pattern, oldVersion, newVersion);
    console.log(`  ✓ ${stamp.file}`);
  }

  await mirrorSkillFile();
  console.log(`  ✓ mirrored ${SKILL_MIRROR.source} → ${SKILL_MIRROR.mirror}`);

  if (skipExamples) {
    console.log("\nSkipped sample-report regeneration (--skip-examples).");
    console.log("If your CLI output changed, run the four commands in examples/README.md");
    console.log("to re-stamp the banner version in the sample reports.");
  } else {
    console.log("\nRegenerating sample audit reports…");
    regenerateExamples();
    console.log("  ✓ examples/ and apps/landing/public/examples/ updated");
  }

  console.log(`\nDone. Review with \`git diff\` and commit.`);
  console.log(`Then push a tag to trigger npm publish:`);
  console.log(`  git tag v${newVersion} && git push --tags`);
}

main().catch((err) => {
  console.error(`\nbump-version failed: ${err.message}`);
  process.exit(1);
});
