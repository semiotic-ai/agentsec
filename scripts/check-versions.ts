#!/usr/bin/env bun
/**
 * CI gate: verify every version stamp matches the canonical version, and that
 * the SKILL.md mirror is byte-identical to the canonical SKILL.md.
 *
 * Exits 0 if everything is in sync, 1 otherwise. Designed to run in CI so
 * a PR that bumps `packages/cli/package.json` without running `bun run bump`
 * fails before merge.
 */

import { resolve } from "node:path";
import { fillPattern, readCanonicalVersion, SKILL_MIRROR, STAMPS } from "./version-stamps";

const REPO_ROOT = resolve(import.meta.dir, "..");

type Mismatch = { file: string; expected: string; reason: string };

async function main(): Promise<void> {
  const canonical = await readCanonicalVersion(REPO_ROOT);
  const mismatches: Mismatch[] = [];

  for (const stamp of STAMPS) {
    const expected = fillPattern(stamp.pattern, canonical);
    const text = await Bun.file(`${REPO_ROOT}/${stamp.file}`).text();
    const occurrences = text.split(expected).length - 1;

    if (occurrences === 0) {
      mismatches.push({
        file: stamp.file,
        expected: JSON.stringify(expected),
        reason: `pattern not found — version stamp out of sync with ${canonical}`,
      });
    } else if (occurrences > 1) {
      mismatches.push({
        file: stamp.file,
        expected: JSON.stringify(expected),
        reason: `pattern matched ${occurrences} times — pattern in version-stamps.ts is not unique`,
      });
    }
  }

  const sourceText = await Bun.file(`${REPO_ROOT}/${SKILL_MIRROR.source}`).text();
  const mirrorText = await Bun.file(`${REPO_ROOT}/${SKILL_MIRROR.mirror}`).text();
  if (sourceText !== mirrorText) {
    mismatches.push({
      file: SKILL_MIRROR.mirror,
      expected: `byte-identical copy of ${SKILL_MIRROR.source}`,
      reason: "SKILL.md mirror has drifted — run `bun run bump` or copy the file manually",
    });
  }

  if (mismatches.length > 0) {
    console.error(`Version sync check FAILED (canonical = ${canonical})\n`);
    for (const m of mismatches) {
      console.error(`  ✗ ${m.file}`);
      console.error(`      expected: ${m.expected}`);
      console.error(`      reason:   ${m.reason}\n`);
    }
    console.error(`Fix: run \`bun run bump <version>\` to re-sync, or update the matching\n`);
    console.error(`     entry in scripts/version-stamps.ts if the file's pattern has changed.`);
    process.exit(1);
  }

  console.log(`✓ All ${STAMPS.length} version stamps match ${canonical}`);
  console.log(`✓ SKILL.md mirror is in sync`);
}

main().catch((err) => {
  console.error(`check-versions failed: ${err.message}`);
  process.exit(1);
});
