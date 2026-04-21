import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { expandDefaultPath } from "../expand";

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

let fixtureRoot: string;

beforeAll(async () => {
  fixtureRoot = await mkdtemp(join(tmpdir(), "agentsec-expand-"));

  // fixtureRoot/
  //   alpha/skills/a.txt
  //   beta/skills/b.txt
  //   empty/               (no children)
  //   solo/skill.md
  await mkdir(join(fixtureRoot, "alpha", "skills"), { recursive: true });
  await mkdir(join(fixtureRoot, "beta", "skills"), { recursive: true });
  await mkdir(join(fixtureRoot, "empty"), { recursive: true });
  await mkdir(join(fixtureRoot, "solo"), { recursive: true });
  await writeFile(join(fixtureRoot, "alpha", "skills", "a.txt"), "a");
  await writeFile(join(fixtureRoot, "beta", "skills", "b.txt"), "b");
  await writeFile(join(fixtureRoot, "solo", "skill.md"), "solo");
});

afterAll(async () => {
  await rm(fixtureRoot, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Tilde expansion
// ---------------------------------------------------------------------------

describe("expandDefaultPath -- tilde", () => {
  it("expands ~/foo to $HOME/foo", async () => {
    const result = await expandDefaultPath("~/foo");
    expect(result).toEqual([resolve(join(homedir(), "foo"))]);
  });

  it("expands a bare ~ to $HOME", async () => {
    const result = await expandDefaultPath("~");
    expect(result).toEqual([resolve(homedir())]);
  });

  it("leaves ~user (no slash) alone because it is not a supported form", async () => {
    const result = await expandDefaultPath("~someuser/foo");
    expect(result).toEqual([resolve("~someuser/foo")]);
  });
});

// ---------------------------------------------------------------------------
// Environment variable expansion
// ---------------------------------------------------------------------------

describe("expandDefaultPath -- env vars", () => {
  it("expands $HOME/x to the home directory plus x", async () => {
    const result = await expandDefaultPath("$HOME/x");
    expect(result).toEqual([resolve(join(homedir(), "x"))]);
  });

  // biome-ignore lint/suspicious/noTemplateCurlyInString: literal env-var pattern is the subject under test
  it("expands ${HOME}/x using the braced form", async () => {
    // biome-ignore lint/suspicious/noTemplateCurlyInString: must pass the literal pattern, not a template literal
    const result = await expandDefaultPath("${HOME}/x");
    expect(result).toEqual([resolve(join(homedir(), "x"))]);
  });

  it("expands %APPDATA%/x when the env var is set", async () => {
    const previous = process.env.AGENTSEC_TEST_APPDATA;
    process.env.AGENTSEC_TEST_APPDATA = "/tmp/appdata";
    try {
      const result = await expandDefaultPath("%AGENTSEC_TEST_APPDATA%/x");
      expect(result).toEqual([resolve("/tmp/appdata/x")]);
    } finally {
      if (previous === undefined) {
        delete process.env.AGENTSEC_TEST_APPDATA;
      } else {
        process.env.AGENTSEC_TEST_APPDATA = previous;
      }
    }
  });

  it("leaves %VAR% literal when the env var is unset", async () => {
    delete process.env.AGENTSEC_DEFINITELY_UNSET;
    const result = await expandDefaultPath("%AGENTSEC_DEFINITELY_UNSET%/x");
    expect(result).toEqual([resolve("%AGENTSEC_DEFINITELY_UNSET%/x")]);
  });

  it("leaves $VAR literal when the env var is unset", async () => {
    delete process.env.AGENTSEC_DEFINITELY_UNSET;
    const result = await expandDefaultPath("$AGENTSEC_DEFINITELY_UNSET/x");
    expect(result).toEqual([resolve("$AGENTSEC_DEFINITELY_UNSET/x")]);
  });
});

// ---------------------------------------------------------------------------
// Non-wildcard paths
// ---------------------------------------------------------------------------

describe("expandDefaultPath -- no wildcards", () => {
  it("returns a single-entry array for a literal absolute path", async () => {
    const result = await expandDefaultPath("/tmp/literal");
    expect(result).toEqual([resolve("/tmp/literal")]);
  });

  it("does not require the path to exist", async () => {
    const missing = join(fixtureRoot, "does-not-exist", "nested");
    const result = await expandDefaultPath(missing);
    expect(result).toEqual([resolve(missing)]);
  });

  it("resolves a relative path against the current working directory", async () => {
    const result = await expandDefaultPath("./some/relative/path");
    expect(result).toEqual([resolve("./some/relative/path")]);
  });
});

// ---------------------------------------------------------------------------
// Wildcard expansion
// ---------------------------------------------------------------------------

describe("expandDefaultPath -- wildcards", () => {
  it("returns an empty array when a wildcard matches nothing", async () => {
    const result = await expandDefaultPath(join(fixtureRoot, "no-such-parent", "*"));
    expect(result).toEqual([]);
  });

  it("returns an empty array for a wildcard in an existing-but-empty directory", async () => {
    const result = await expandDefaultPath(join(fixtureRoot, "empty", "*"));
    expect(result).toEqual([]);
  });

  it("matches single-level wildcard entries in a real directory", async () => {
    const pattern = join(fixtureRoot, "*");
    const result = await expandDefaultPath(pattern);
    expect(result.sort()).toEqual(
      [
        join(fixtureRoot, "alpha"),
        join(fixtureRoot, "beta"),
        join(fixtureRoot, "empty"),
        join(fixtureRoot, "solo"),
      ].sort(),
    );
  });

  it("expands a double-wildcard pattern N x M", async () => {
    const pattern = join(fixtureRoot, "*", "skills", "*");
    const result = await expandDefaultPath(pattern);
    expect(result.sort()).toEqual(
      [
        join(fixtureRoot, "alpha", "skills", "a.txt"),
        join(fixtureRoot, "beta", "skills", "b.txt"),
      ].sort(),
    );
  });

  it("respects literal segments mixed with wildcards", async () => {
    const pattern = join(fixtureRoot, "alpha", "skills", "*");
    const result = await expandDefaultPath(pattern);
    expect(result).toEqual([join(fixtureRoot, "alpha", "skills", "a.txt")]);
  });
});

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

describe("expandDefaultPath -- errors", () => {
  it("returns an empty array for an unreadable parent without throwing", async () => {
    // A path that certainly does not exist combined with a wildcard.
    const pattern = `/definitely/does/not/exist/${Date.now()}/*`;
    const result = await expandDefaultPath(pattern);
    expect(result).toEqual([]);
  });

  it("never throws for weird input", async () => {
    await expect(expandDefaultPath("")).resolves.toBeInstanceOf(Array);
    await expect(expandDefaultPath("***")).resolves.toBeInstanceOf(Array);
    await expect(expandDefaultPath(`~${sep}`)).resolves.toBeInstanceOf(Array);
  });
});
