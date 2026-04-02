import { describe, it, expect } from "bun:test";
import { parseFlags, resolveConfig } from "../config";
import { argv } from "./helpers";

// ---------------------------------------------------------------------------
// parseFlags
// ---------------------------------------------------------------------------

describe("parseFlags", () => {
  it("defaults command to 'audit' with no args", () => {
    const flags = parseFlags(argv());
    expect(flags.command).toBe("audit");
  });

  it("defaults format to 'text'", () => {
    const flags = parseFlags(argv());
    expect(flags.format).toBe("text");
  });

  it("defaults platform to 'openclaw'", () => {
    const flags = parseFlags(argv());
    expect(flags.platform).toBe("openclaw");
  });

  it("defaults verbose, noColor, help, version to false", () => {
    const flags = parseFlags(argv());
    expect(flags.verbose).toBe(false);
    expect(flags.noColor).toBe(false);
    expect(flags.help).toBe(false);
    expect(flags.version).toBe(false);
  });

  it("defaults output, policy, path to null", () => {
    const flags = parseFlags(argv());
    expect(flags.output).toBeNull();
    expect(flags.policy).toBeNull();
    expect(flags.path).toBeNull();
  });

  // -- Format flag --

  it("parses --format json", () => {
    const flags = parseFlags(argv("--format", "json"));
    expect(flags.format).toBe("json");
  });

  it("parses -f html", () => {
    const flags = parseFlags(argv("-f", "html"));
    expect(flags.format).toBe("html");
  });

  it("parses --format sarif", () => {
    const flags = parseFlags(argv("--format", "sarif"));
    expect(flags.format).toBe("sarif");
  });

  it("ignores invalid --format value", () => {
    const flags = parseFlags(argv("--format", "csv"));
    expect(flags.format).toBe("text");
  });

  // -- Policy flag --

  it("parses --policy strict", () => {
    const flags = parseFlags(argv("--policy", "strict"));
    expect(flags.policy).toBe("strict");
  });

  it("parses -p permissive", () => {
    const flags = parseFlags(argv("-p", "permissive"));
    expect(flags.policy).toBe("permissive");
  });

  // -- Path flag --

  it("parses --path ./my-skills", () => {
    const flags = parseFlags(argv("--path", "./my-skills"));
    expect(flags.path).toBe("./my-skills");
  });

  // -- Boolean flags --

  it("parses -v for verbose", () => {
    const flags = parseFlags(argv("-v"));
    expect(flags.verbose).toBe(true);
  });

  it("parses --verbose", () => {
    const flags = parseFlags(argv("--verbose"));
    expect(flags.verbose).toBe(true);
  });

  it("parses --no-color", () => {
    const flags = parseFlags(argv("--no-color"));
    expect(flags.noColor).toBe(true);
  });

  it("parses -h for help", () => {
    const flags = parseFlags(argv("-h"));
    expect(flags.help).toBe(true);
  });

  it("parses --help", () => {
    const flags = parseFlags(argv("--help"));
    expect(flags.help).toBe(true);
  });

  it("parses -V for version", () => {
    const flags = parseFlags(argv("-V"));
    expect(flags.version).toBe(true);
  });

  it("parses --version", () => {
    const flags = parseFlags(argv("--version"));
    expect(flags.version).toBe(true);
  });

  // -- Command routing --

  it("routes 'audit' command", () => {
    const flags = parseFlags(argv("audit"));
    expect(flags.command).toBe("audit");
  });

  it("routes 'scan' command", () => {
    const flags = parseFlags(argv("scan"));
    expect(flags.command).toBe("scan");
  });

  it("routes 'report' command", () => {
    const flags = parseFlags(argv("report"));
    expect(flags.command).toBe("report");
  });

  it("routes 'policy' command", () => {
    const flags = parseFlags(argv("policy"));
    expect(flags.command).toBe("policy");
  });

  it("routes 'version' command", () => {
    const flags = parseFlags(argv("version"));
    expect(flags.command).toBe("version");
  });

  it("routes 'help' command", () => {
    const flags = parseFlags(argv("help"));
    expect(flags.command).toBe("help");
  });

  // -- Override behavior --

  it("--version overrides command to 'version'", () => {
    const flags = parseFlags(argv("scan", "--version"));
    expect(flags.command).toBe("version");
  });

  it("--help overrides default audit command to 'help'", () => {
    const flags = parseFlags(argv("--help"));
    expect(flags.command).toBe("help");
  });

  it("--help does not override an explicit non-audit command", () => {
    const flags = parseFlags(argv("scan", "--help"));
    expect(flags.command).toBe("scan");
    expect(flags.help).toBe(true);
  });

  // -- Positional args --

  it("collects positional args after the command", () => {
    const flags = parseFlags(argv("report", "audit.json", "extra"));
    expect(flags.command).toBe("report");
    expect(flags.args).toEqual(["audit.json", "extra"]);
  });

  it("treats unrecognized first positional as an arg, not a command", () => {
    const flags = parseFlags(argv("unknown-thing"));
    expect(flags.command).toBe("audit");
    expect(flags.args).toContain("unknown-thing");
  });

  // -- Combined flags --

  it("parses multiple flags together", () => {
    const flags = parseFlags(argv("scan", "--format", "json", "--policy", "strict", "-v", "--path", "/skills"));
    expect(flags.command).toBe("scan");
    expect(flags.format).toBe("json");
    expect(flags.policy).toBe("strict");
    expect(flags.verbose).toBe(true);
    expect(flags.path).toBe("/skills");
  });
});

// ---------------------------------------------------------------------------
// resolveConfig
// ---------------------------------------------------------------------------

describe("resolveConfig", () => {
  it("returns defaults when flags have default values", async () => {
    const flags = parseFlags(argv());
    const config = await resolveConfig(flags);
    expect(config.format).toBe("text");
    expect(config.platform).toBe("openclaw");
    expect(config.verbose).toBe(false);
    expect(config.output).toBeNull();
    expect(config.policy).toBeNull();
    expect(config.path).toBeNull();
  });

  it("applies CLI flag overrides", async () => {
    const flags = parseFlags(argv("--format", "json", "--policy", "strict", "-v", "--path", "/tmp/skills"));
    const config = await resolveConfig(flags);
    expect(config.format).toBe("json");
    expect(config.policy).toBe("strict");
    expect(config.verbose).toBe(true);
    expect(config.path).toBe("/tmp/skills");
  });

  it("applies --platform flag", async () => {
    const flags = parseFlags(argv("--platform", "claude"));
    const config = await resolveConfig(flags);
    expect(config.platform).toBe("claude");
  });

  it("applies --output flag", async () => {
    const flags = parseFlags(argv("--output", "report.html"));
    const config = await resolveConfig(flags);
    expect(config.output).toBe("report.html");
  });
});
