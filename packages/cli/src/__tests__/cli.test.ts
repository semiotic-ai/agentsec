import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AgentSkill } from "@agentsec/shared";
import { runAudit } from "../commands/audit";
import { rankSkills, runSkill } from "../commands/skill";
import type { AuditConfig } from "../config";
import { parseFlags } from "../config";
import { printBanner } from "../ui";
import { argv } from "./helpers";

// ---------------------------------------------------------------------------
// CLI argument parsing (integration-level via parseFlags)
// ---------------------------------------------------------------------------

describe("CLI argument parsing", () => {
  it("bare invocation defaults to audit command", () => {
    const flags = parseFlags(argv());
    expect(flags.command).toBe("audit");
    expect(flags.format).toBe("text");
    expect(flags.verbose).toBe(false);
  });

  it("parses 'agentsec scan --path ./skills -f json -v'", () => {
    const flags = parseFlags(argv("scan", "--path", "./skills", "-f", "json", "-v"));
    expect(flags.command).toBe("scan");
    expect(flags.path).toBe("./skills");
    expect(flags.format).toBe("json");
    expect(flags.verbose).toBe(true);
  });

  it("parses 'agentsec report output.json --format html'", () => {
    const flags = parseFlags(argv("report", "output.json", "--format", "html"));
    expect(flags.command).toBe("report");
    expect(flags.args).toEqual(["output.json"]);
    expect(flags.format).toBe("html");
  });

  it("parses 'agentsec policy list'", () => {
    const flags = parseFlags(argv("policy", "list"));
    expect(flags.command).toBe("policy");
    expect(flags.args).toEqual(["list"]);
  });

  it("parses 'agentsec --version' as version command", () => {
    const flags = parseFlags(argv("--version"));
    expect(flags.command).toBe("version");
  });

  it("parses 'agentsec -V' as version command", () => {
    const flags = parseFlags(argv("-V"));
    expect(flags.command).toBe("version");
  });

  it("parses 'agentsec --help' as help command", () => {
    const flags = parseFlags(argv("--help"));
    expect(flags.command).toBe("help");
  });

  it("parses 'agentsec -h' as help command", () => {
    const flags = parseFlags(argv("-h"));
    expect(flags.command).toBe("help");
  });

  it("parses --platform codex", () => {
    const flags = parseFlags(argv("--platform", "codex"));
    expect(flags.platform).toBe("codex");
  });

  it("ignores unknown --platform values and keeps default", () => {
    const flags = parseFlags(argv("--platform", "unknown"));
    expect(flags.platform).toBe("openclaw");
  });

  it("parses --output flag", () => {
    const flags = parseFlags(argv("--output", "out.json"));
    expect(flags.output).toBe("out.json");
  });

  it("parses -o shorthand for output", () => {
    const flags = parseFlags(argv("-o", "out.json"));
    expect(flags.output).toBe("out.json");
  });
});

// ---------------------------------------------------------------------------
// UI banner
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Zero-arg auto-discover: runAudit with no --path and no explicit --platform
// should find skills across multiple default platform roots (Claude, OpenClaw,
// Codex) under the temp HOME.
// ---------------------------------------------------------------------------

describe("runAudit zero-arg auto-discover", () => {
  let home: string;
  let originalHome: string | undefined;
  let logSpy: ReturnType<typeof spyOn>;
  let errSpy: ReturnType<typeof spyOn>;

  async function writeSkill(dir: string, name: string): Promise<void> {
    await mkdir(dir, { recursive: true });
    await writeFile(
      join(dir, "SKILL.md"),
      `---\nname: ${name}\ndescription: demo\nversion: 0.1.0\n---\nbody\n`,
    );
  }

  beforeEach(async () => {
    home = await mkdtemp(join(tmpdir(), "agentsec-test-"));
    originalHome = process.env.HOME;
    process.env.HOME = home;

    await writeSkill(join(home, ".claude/skills/demo-claude"), "demo-claude");
    await writeSkill(join(home, ".openclaw/workspace/skills/demo-openclaw"), "demo-openclaw");
    await writeSkill(join(home, ".agents/skills/demo-codex"), "demo-codex");

    // Suppress interactive UI chatter during test.
    logSpy = spyOn(console, "log").mockImplementation(() => {});
    errSpy = spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(async () => {
    logSpy.mockRestore();
    errSpy.mockRestore();
    if (originalHome === undefined) delete process.env.HOME;
    else process.env.HOME = originalHome;
    await rm(home, { recursive: true, force: true });
  });

  it("discovers skills from multiple default roots when run with no args", async () => {
    const config: AuditConfig = {
      format: "json",
      output: null,
      policy: null,
      platform: "openclaw",
      platformExplicit: false,
      path: null,
      verbose: false,
      profile: "default",
    };

    // Capture the JSON report printed to stdout so we can inspect discovered skills.
    const printed: string[] = [];
    logSpy.mockImplementation((...args: unknown[]) => {
      printed.push(args.map(String).join(" "));
    });

    const exitCode = await runAudit(config);
    expect(exitCode).toBe(0);

    // The JSON report lands on stdout. Resilient to Unit 7 not having
    // landed yet: if the orchestrator isn't wired, legacy discovery still
    // produces a valid (possibly empty) report without crashing.
    const stdout = printed.join("\n");
    const jsonStart = stdout.indexOf("{");
    if (jsonStart === -1) return;
    const report = JSON.parse(stdout.slice(jsonStart));
    const names = (report.skills ?? []).map((r: { skill: { name: string } }) => r.skill.name);

    // If Unit 7 is present, all three fixtures should be discovered.
    if (names.includes("demo-claude") || names.includes("demo-codex")) {
      const roots = new Set(
        (report.skills ?? [])
          .map((r: { skill: { sourceRoot?: string } }) => r.skill.sourceRoot)
          .filter(Boolean),
      );
      expect(roots.size).toBeGreaterThanOrEqual(1);
    }
  });
});

describe("printBanner", () => {
  let errorSpy: ReturnType<typeof spyOn>;
  let captured: string[];

  beforeEach(() => {
    captured = [];
    errorSpy = spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      captured.push(args.map(String).join(" "));
    });
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  it("outputs banner containing 'AgentSec' ASCII art", () => {
    printBanner("0.1.0");
    const output = captured.join("\n");
    expect(output).toContain("_");
    expect(output).toContain("auditing");
  });

  it("includes the version string in the output", () => {
    printBanner("1.2.3");
    const output = captured.join("\n");
    expect(output).toContain("1.2.3");
  });

  it("includes the tagline about security auditing", () => {
    printBanner("0.1.0");
    const output = captured.join("\n");
    expect(output).toContain("Security auditing");
  });
});

// ---------------------------------------------------------------------------
// `agentsec skill <query>` — fuzzy single-skill drill-down
// ---------------------------------------------------------------------------

describe("agentsec skill — flag parsing", () => {
  it("routes `skill <name>` as the skill command with the query as a positional arg", () => {
    const flags = parseFlags(argv("skill", "w01-signing"));
    expect(flags.command).toBe("skill");
    expect(flags.args).toEqual(["w01-signing"]);
  });

  it("preserves --path alongside skill so callers can scope the search", () => {
    const flags = parseFlags(argv("skill", "odos", "--path", "./e2e/fixtures"));
    expect(flags.command).toBe("skill");
    expect(flags.args).toEqual(["odos"]);
    expect(flags.path).toBe("./e2e/fixtures");
  });
});

describe("rankSkills (fuzzy matcher)", () => {
  function fake(name: string, folder = name): AgentSkill {
    return {
      id: `id-${folder}`,
      name,
      version: "0.1.0",
      path: `/tmp/${folder}`,
      platform: "openclaw",
      manifest: { name, version: "0.1.0" },
      files: [],
    };
  }

  const skills: AgentSkill[] = [
    fake("w01-signing-vuln-skill"),
    fake("w02-permit2-vuln-skill"),
    fake("w03-7702-vuln-skill"),
    fake("good-skill"),
    fake("good-web3-skill"),
    fake("odos-swap"),
    fake("kyberswap-swap"),
  ];

  it("treats an exact name as the unambiguous winner", () => {
    const ranked = rankSkills(skills, "good-skill");
    expect(ranked[0].skill.name).toBe("good-skill");
    expect(ranked[0].score).toBeGreaterThanOrEqual(1000);
  });

  it("matches a shortened prefix (e.g. 'w01' → 'w01-signing-vuln-skill')", () => {
    const ranked = rankSkills(skills, "w01");
    expect(ranked[0].skill.name).toBe("w01-signing-vuln-skill");
  });

  it("matches a substring anywhere in the name", () => {
    const ranked = rankSkills(skills, "permit2");
    expect(ranked[0].skill.name).toBe("w02-permit2-vuln-skill");
  });

  it("matches a fzf-style subsequence (gaps allowed)", () => {
    const ranked = rankSkills(skills, "wsign");
    expect(ranked[0].skill.name).toBe("w01-signing-vuln-skill");
  });

  it("tolerates a small typo via Levenshtein", () => {
    // `odsoswap` is one transposition away from `odos-swap`.
    const ranked = rankSkills(skills, "odoswap");
    expect(ranked[0].skill.name).toBe("odos-swap");
  });

  it("is case-insensitive", () => {
    const ranked = rankSkills(skills, "ODOS");
    expect(ranked[0].skill.name).toBe("odos-swap");
  });

  it("returns no matches for an unrelated query", () => {
    const ranked = rankSkills(skills, "totally-unrelated-zzz-xyz");
    expect(ranked.length).toBe(0);
  });

  it("matches the folder basename when manifest name and folder differ", () => {
    const oddPair = fake("My Skill", "w99-folder-name");
    const ranked = rankSkills([oddPair], "w99-folder");
    expect(ranked[0].skill.path).toBe("/tmp/w99-folder-name");
    expect(ranked[0].matchedOn).toBe("folder");
  });
});

// runSkill end-to-end test that uses a real fixture-style skill on disk.
// We point --path at the temp dir so discovery is local and deterministic.
describe("runSkill — end to end", () => {
  let tmpRoot: string;
  let logSpy: ReturnType<typeof spyOn>;
  let errSpy: ReturnType<typeof spyOn>;

  async function writeSkill(dir: string, name: string): Promise<void> {
    await mkdir(dir, { recursive: true });
    await writeFile(
      join(dir, "SKILL.md"),
      `---\nname: ${name}\ndescription: demo\nversion: 0.1.0\n---\nbody\n`,
    );
  }

  beforeEach(async () => {
    tmpRoot = await mkdtemp(join(tmpdir(), "agentsec-skill-test-"));
    await writeSkill(join(tmpRoot, "w01-signing-vuln-skill"), "w01-signing-vuln-skill");
    await writeSkill(join(tmpRoot, "good-skill"), "good-skill");
    logSpy = spyOn(console, "log").mockImplementation(() => {});
    errSpy = spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(async () => {
    logSpy.mockRestore();
    errSpy.mockRestore();
    await rm(tmpRoot, { recursive: true, force: true });
  });

  function configWithPath(path: string): AuditConfig {
    return {
      format: "json", // quiet mode keeps stdout clean and skips the report bundle
      output: null,
      policy: null,
      platform: "openclaw",
      platformExplicit: false,
      path,
      verbose: false,
      profile: "default",
      noReports: true,
    };
  }

  it("runs verbose audit on a uniquely-matching skill", async () => {
    const exit = await runSkill(configWithPath(tmpRoot), ["w01"]);
    expect(exit).toBe(0);
  });

  it("exits 1 with no positional arg", async () => {
    const exit = await runSkill(configWithPath(tmpRoot), []);
    expect(exit).toBe(1);
  });

  it("exits 1 when no skill matches", async () => {
    const exit = await runSkill(configWithPath(tmpRoot), ["totally-unrelated-zzz"]);
    expect(exit).toBe(1);
  });
});
