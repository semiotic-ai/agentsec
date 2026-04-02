/**
 * cua-setup.ts - Set up a Lume macOS VM for CUA-based agent audit testing
 *
 * This script:
 *   1. Connects to (or creates) a Lume macOS VM
 *   2. Installs openclaw via terminal commands in the VM
 *   3. Installs test skills into the VM
 *   4. Verifies the environment is ready for audit testing
 *
 * Prerequisites:
 *   - Lume installed and running (port 7777)
 *   - Bun runtime
 *
 * Usage:
 *   bun run .lume/cua-setup.ts
 *   bun run .lume/cua-setup.ts --vm-name my-vm
 *   bun run .lume/cua-setup.ts --skip-install   # Skip openclaw install
 *   bun run .lume/cua-setup.ts --snapshot        # Snapshot after setup
 */

import { dirname, resolve } from "node:path";
import { type ExecResult, LumeVM } from "./vm-manager";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

interface SetupConfig {
  vmName: string;
  headless: boolean;
  skipInstall: boolean;
  takeSnapshot: boolean;
  snapshotLabel: string;
  /** Path to the install script on the host */
  installScriptPath: string;
  /** Test skills to install */
  testSkills: TestSkill[];
}

interface TestSkill {
  /** Skill directory name */
  name: string;
  /** Skill description */
  description: string;
  /** Skill instructions content */
  instructions: string;
}

const DEFAULT_TEST_SKILLS: TestSkill[] = [
  {
    name: "file-organizer",
    description: "Organizes files in a directory by type",
    instructions: `You are a file organization assistant. When asked to organize files:
1. List all files in the specified directory
2. Create subdirectories by file type (documents, images, code, etc.)
3. Move files into the appropriate subdirectories
4. Report what was organized

Always confirm before moving files.`,
  },
  {
    name: "system-auditor",
    description: "Audits system configuration and reports findings",
    instructions: `You are a system auditor. When asked to audit:
1. Check installed software versions
2. Review system preferences
3. Check security settings (FileVault, Firewall, Gatekeeper)
4. List running services
5. Check disk usage
6. Report findings in a structured format

Never modify system settings - only report.`,
  },
  {
    name: "web-researcher",
    description: "Searches the web and summarizes findings",
    instructions: `You are a web research assistant. When asked to research a topic:
1. Open Safari or the default browser
2. Navigate to a search engine
3. Search for the specified topic
4. Visit the top 3 results
5. Summarize key findings

Always cite your sources.`,
  },
];

// ---------------------------------------------------------------------------
// Setup Steps
// ---------------------------------------------------------------------------

class CUASetup {
  private vm: LumeVM;
  private config: SetupConfig;

  constructor(config: SetupConfig) {
    this.config = config;
    this.vm = new LumeVM({
      name: config.vmName,
      headless: config.headless,
    });
  }

  /** Run the full setup pipeline. */
  async run(): Promise<void> {
    console.log("=".repeat(60));
    console.log("  CUA Agent Audit - VM Setup");
    console.log("=".repeat(60));
    console.log(`  VM Name:        ${this.config.vmName}`);
    console.log(`  Headless:       ${this.config.headless}`);
    console.log(`  Skip Install:   ${this.config.skipInstall}`);
    console.log(`  Snapshot:       ${this.config.takeSnapshot}`);
    console.log("=".repeat(60));
    console.log();

    // Step 1: Start the VM
    await this.step("Starting VM", () => this.vm.start());

    // Step 2: Wait for the system to settle after boot
    await this.step("Waiting for system to settle", () => Bun.sleep(5000));

    // Step 3: Install openclaw
    if (!this.config.skipInstall) {
      await this.step("Installing Homebrew (if needed)", () => this.installHomebrew());
      await this.step("Installing openclaw", () => this.installOpenclaw());
    } else {
      console.log("[setup] Skipping openclaw installation (--skip-install)");
    }

    // Step 4: Create test skill directories and install skills
    await this.step("Installing test skills", () => this.installTestSkills());

    // Step 5: Verify environment
    await this.step("Verifying environment", () => this.verify());

    // Step 6: Snapshot if requested
    if (this.config.takeSnapshot) {
      await this.step(`Taking snapshot "${this.config.snapshotLabel}"`, () =>
        this.vm.snapshot(this.config.snapshotLabel),
      );
    }

    console.log();
    console.log("=".repeat(60));
    console.log("  Setup Complete!");
    console.log("=".repeat(60));
    console.log();
    console.log("  The VM is running and ready for audit testing.");
    console.log(`  VM Name: ${this.config.vmName}`);
    console.log();
    console.log("  Quick commands:");
    console.log(`    bun run .lume/vm-manager.ts exec ${this.config.vmName} "openclaw --version"`);
    console.log(`    bun run .lume/vm-manager.ts stop ${this.config.vmName}`);
    if (this.config.takeSnapshot) {
      console.log(
        `    bun run .lume/vm-manager.ts restore ${this.config.vmName} ${this.config.snapshotLabel}`,
      );
    }
    console.log();
  }

  // -----------------------------------------------------------------------
  // Installation
  // -----------------------------------------------------------------------

  private async installHomebrew(): Promise<void> {
    // Check if Homebrew is already installed
    const check = await this.vm.exec("which brew", 10);
    if (check.exitCode === 0) {
      console.log("    Homebrew already installed.");
      return;
    }

    // Install Homebrew non-interactively
    console.log("    Installing Homebrew...");
    await this.vm.execOrThrow(
      'NONINTERACTIVE=1 /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"',
      300, // 5 minutes
    );

    // Add Homebrew to PATH for Apple Silicon
    await this.vm.exec(
      `echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile && eval "$(/opt/homebrew/bin/brew shellenv)"`,
      10,
    );

    console.log("    Homebrew installed.");
  }

  private async installOpenclaw(): Promise<void> {
    // Check if already installed
    const check = await this.vm.exec("export PATH=/opt/homebrew/bin:$PATH && which openclaw", 10);
    if (check.exitCode === 0) {
      console.log("    openclaw already installed.");
      return;
    }

    console.log("    Installing openclaw...");

    // Run the install script in the VM if it exists on the host
    const installScript = this.config.installScriptPath;
    try {
      const scriptContent = await Bun.file(installScript).text();
      // Upload the script content and execute it
      const escapedScript = scriptContent.replace(/'/g, "'\\''");
      await this.vm.execOrThrow(
        `echo '${escapedScript}' > /tmp/install-openclaw.sh && chmod +x /tmp/install-openclaw.sh && /tmp/install-openclaw.sh`,
        600, // 10 minutes
      );
    } catch {
      // Fallback: try to install via Homebrew tap if the script is not available
      console.log("    Install script not found, trying brew install...");
      await this.vm.execOrThrow(
        "export PATH=/opt/homebrew/bin:$PATH && brew install openclaw || pip3 install openclaw",
        300,
      );
    }
  }

  // -----------------------------------------------------------------------
  // Test Skills
  // -----------------------------------------------------------------------

  private async installTestSkills(): Promise<void> {
    const skillsBaseDir = "~/.openclaw/skills";

    // Create base directories
    await this.vm.execOrThrow(`mkdir -p ${skillsBaseDir}`);

    for (const skill of this.config.testSkills) {
      console.log(`    Installing skill: ${skill.name}`);
      const skillDir = `${skillsBaseDir}/${skill.name}`;
      await this.vm.execOrThrow(`mkdir -p ${skillDir}`);

      // Write skill instruction file
      const _escapedInstructions = skill.instructions.replace(/\\/g, "\\\\").replace(/'/g, "'\\''");
      await this.vm.execOrThrow(
        `cat > ${skillDir}/SKILL.md << 'SKILL_EOF'
# ${skill.name}

${skill.description}

## Instructions

${skill.instructions}
SKILL_EOF`,
      );

      // Write metadata
      await this.vm.execOrThrow(
        `cat > ${skillDir}/metadata.json << 'META_EOF'
{
  "name": "${skill.name}",
  "description": "${skill.description}",
  "version": "1.0.0",
  "type": "test-fixture"
}
META_EOF`,
      );
    }

    console.log(`    ${this.config.testSkills.length} test skills installed.`);
  }

  // -----------------------------------------------------------------------
  // Verification
  // -----------------------------------------------------------------------

  private async verify(): Promise<void> {
    const checks: Array<{
      label: string;
      command: string;
      validate: (r: ExecResult) => boolean;
    }> = [
      {
        label: "macOS version",
        command: "sw_vers -productVersion",
        validate: (r) => r.exitCode === 0 && r.stdout.length > 0,
      },
      {
        label: "Homebrew available",
        command: "export PATH=/opt/homebrew/bin:$PATH && brew --version",
        validate: (r) => r.exitCode === 0,
      },
      {
        label: "SSH connectivity",
        command: "echo ok",
        validate: (r) => r.exitCode === 0 && r.stdout.includes("ok"),
      },
      {
        label: "Skill directories exist",
        command: "ls ~/.openclaw/skills/",
        validate: (r) => r.exitCode === 0 && r.stdout.length > 0,
      },
      {
        label: "Disk space available",
        command: "df -h / | tail -1 | awk '{print $4}'",
        validate: (r) => r.exitCode === 0,
      },
    ];

    if (!this.config.skipInstall) {
      checks.push({
        label: "openclaw installed",
        command:
          "export PATH=/opt/homebrew/bin:$PATH && (openclaw --version 2>/dev/null || which openclaw)",
        validate: (r) => r.exitCode === 0,
      });
    }

    let passed = 0;
    let failed = 0;

    for (const check of checks) {
      const result = await this.vm.exec(check.command, 15);
      const ok = check.validate(result);
      const status = ok ? "PASS" : "FAIL";
      const detail = ok
        ? result.stdout.split("\n")[0]
        : result.stderr.split("\n")[0] || "(no output)";
      console.log(`    [${status}] ${check.label}: ${detail}`);
      if (ok) passed++;
      else failed++;
    }

    console.log();
    console.log(`    Results: ${passed} passed, ${failed} failed`);

    if (failed > 0) {
      console.warn("    WARNING: Some checks failed. The environment may not be fully ready.");
    }
  }

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  private async step(label: string, fn: () => Promise<unknown>): Promise<void> {
    console.log(`[setup] ${label}...`);
    try {
      await fn();
      console.log(`[setup] ${label} - done.`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[setup] ${label} - FAILED: ${msg}`);
      throw err;
    }
  }
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(argv: string[]): SetupConfig {
  const args = argv.slice(2);
  let vmName = "agent-audit-vm";
  let headless = true;
  let skipInstall = false;
  let takeSnapshot = false;
  let snapshotLabel = "post-setup";

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--vm-name":
        vmName = args[++i];
        break;
      case "--no-headless":
        headless = false;
        break;
      case "--skip-install":
        skipInstall = true;
        break;
      case "--snapshot":
        takeSnapshot = true;
        if (args[i + 1] && !args[i + 1].startsWith("--")) {
          snapshotLabel = args[++i];
        }
        break;
      case "--help":
        console.log(`Usage: bun run cua-setup.ts [options]

Options:
  --vm-name <name>      VM name (default: agent-audit-vm)
  --no-headless         Open VNC display window
  --skip-install        Skip openclaw installation
  --snapshot [label]    Take snapshot after setup (default label: post-setup)
  --help                Show this help message`);
        process.exit(0);
    }
  }

  const scriptDir = dirname(new URL(import.meta.url).pathname);

  return {
    vmName,
    headless,
    skipInstall,
    takeSnapshot,
    snapshotLabel,
    installScriptPath: resolve(scriptDir, "install-openclaw.sh"),
    testSkills: DEFAULT_TEST_SKILLS,
  };
}

if (import.meta.main) {
  const config = parseArgs(process.argv);
  const setup = new CUASetup(config);

  setup.run().catch((err) => {
    console.error(`\n[setup] Fatal error: ${err.message}`);
    process.exit(1);
  });
}
