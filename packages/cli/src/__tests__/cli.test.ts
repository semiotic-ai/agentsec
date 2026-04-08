import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
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

describe("printBanner", () => {
  let logSpy: ReturnType<typeof spyOn>;
  let captured: string[];

  beforeEach(() => {
    captured = [];
    logSpy = spyOn(console, "log").mockImplementation((...args: unknown[]) => {
      captured.push(args.map(String).join(" "));
    });
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it("outputs banner containing 'Agent Audit' ASCII art", () => {
    printBanner("0.1.0");
    const output = captured.join("\n");
    expect(output).toContain("___/");
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
