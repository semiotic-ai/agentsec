/**
 * e2e/setup.ts -- Programmatic Lume VM setup for agentsec e2e tests.
 *
 * Uses the Lume HTTP API (localhost:7777) and CLI to:
 *   1. Create or reuse a macOS VM
 *   2. Start the VM headlessly
 *   3. Install openclaw inside the VM
 *   4. Copy test fixture skills into the VM
 *   5. Verify the environment is ready
 *
 * Usage:
 *   bun run setup.ts             # provision & start
 *   bun run setup.ts --teardown  # stop & delete the VM
 *   bun run setup.ts --status    # print VM status
 */

import { readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { $ } from "bun";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const CONFIG = {
  vmName: process.env.LUME_VM_NAME ?? "agentsec-vm",
  cpu: Number(process.env.LUME_VM_CPU ?? 4),
  memory: process.env.LUME_VM_MEMORY ?? "8GB",
  diskSize: process.env.LUME_VM_DISK ?? "50GB",
  display: process.env.LUME_VM_DISPLAY ?? "1024x768",
  apiUrl: process.env.LUME_API_URL ?? "http://localhost:7777",
  sshUser: process.env.LUME_SSH_USER ?? "lume",
  sshPassword: process.env.LUME_SSH_PASS ?? "lume",
  fixturesDir: resolve(import.meta.dir, "fixtures"),
  sshTimeoutSeconds: 120,
  bootPollIntervalMs: 2_000,
} as const;

// ---------------------------------------------------------------------------
// Lume HTTP API client
// ---------------------------------------------------------------------------

interface LumeVm {
  name: string;
  os: string;
  cpu: number;
  memory: string;
  diskSize: string;
  status: string;
  display: string;
}

async function lumeApi<T = unknown>(path: string, options?: RequestInit): Promise<T> {
  const url = `${CONFIG.apiUrl}${path}`;
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Lume API ${options?.method ?? "GET"} ${path} failed (${res.status}): ${body}`);
  }
  return res.json() as Promise<T>;
}

async function listVms(): Promise<LumeVm[]> {
  return lumeApi<LumeVm[]>("/lume/vms");
}

async function getVm(name: string): Promise<LumeVm | null> {
  try {
    return await lumeApi<LumeVm>(`/lume/vms/${name}`);
  } catch {
    return null;
  }
}

async function createVm(): Promise<void> {
  console.log(`[setup] Creating VM '${CONFIG.vmName}'...`);
  await lumeApi("/lume/vms", {
    method: "POST",
    body: JSON.stringify({
      name: CONFIG.vmName,
      os: "macOS",
      cpu: CONFIG.cpu,
      memory: CONFIG.memory,
      diskSize: CONFIG.diskSize,
      display: CONFIG.display,
    }),
  });
  console.log(`[setup] VM '${CONFIG.vmName}' created.`);
}

async function startVm(): Promise<void> {
  console.log(`[setup] Starting VM '${CONFIG.vmName}' (headless)...`);
  await lumeApi(`/lume/vms/${CONFIG.vmName}/run`, {
    method: "POST",
    body: JSON.stringify({ noDisplay: true }),
  });
  console.log(`[setup] VM start initiated.`);
}

async function stopVm(): Promise<void> {
  console.log(`[setup] Stopping VM '${CONFIG.vmName}'...`);
  await lumeApi(`/lume/vms/${CONFIG.vmName}/stop`, {
    method: "POST",
    body: JSON.stringify({}),
  });
  console.log(`[setup] VM stopped.`);
}

async function deleteVm(): Promise<void> {
  console.log(`[setup] Deleting VM '${CONFIG.vmName}'...`);
  await lumeApi(`/lume/vms/${CONFIG.vmName}`, {
    method: "DELETE",
  });
  console.log(`[setup] VM deleted.`);
}

// ---------------------------------------------------------------------------
// SSH helpers (via lume CLI)
// ---------------------------------------------------------------------------

async function sshExec(command: string, timeoutSec = 60): Promise<string> {
  const result =
    await $`lume ssh ${CONFIG.vmName} -u ${CONFIG.sshUser} -p ${CONFIG.sshPassword} -t ${timeoutSec} ${command}`.text();
  return result.trim();
}

async function waitForSsh(): Promise<void> {
  console.log(
    `[setup] Waiting for SSH to become available (timeout: ${CONFIG.sshTimeoutSeconds}s)...`,
  );
  const deadline = Date.now() + CONFIG.sshTimeoutSeconds * 1_000;

  while (Date.now() < deadline) {
    try {
      const result = await sshExec("echo ready");
      if (result.includes("ready")) {
        console.log("[setup] SSH is ready.");
        return;
      }
    } catch {
      // VM still booting -- retry
    }
    await Bun.sleep(CONFIG.bootPollIntervalMs);
  }

  throw new Error(`SSH did not become available within ${CONFIG.sshTimeoutSeconds} seconds.`);
}

// ---------------------------------------------------------------------------
// Provisioning steps
// ---------------------------------------------------------------------------

async function ensureLumeService(): Promise<void> {
  console.log("[setup] Checking Lume API...");
  try {
    await listVms();
    console.log("[setup] Lume API is reachable.");
  } catch {
    console.log("[setup] Lume API not reachable. Starting lume serve...");
    // Start lume serve in background
    Bun.spawn(["lume", "serve"], {
      stdout: "ignore",
      stderr: "ignore",
    });

    // Wait for it to come up
    const deadline = Date.now() + 15_000;
    while (Date.now() < deadline) {
      try {
        await listVms();
        console.log("[setup] Lume API is now reachable.");
        return;
      } catch {
        await Bun.sleep(1_000);
      }
    }
    throw new Error("Lume API did not start within 15 seconds.");
  }
}

/**
 * VM statuses that indicate the VM cannot be started right now.
 * When a VM is in one of these states, tests should skip gracefully
 * instead of hanging while waiting for a state transition that may
 * never complete within a reasonable timeout.
 */
const NON_STARTABLE_STATUSES = new Set([
  "provisioning",
  "provisioning (ipsw_install)",
  "downloading",
  "restoring",
  "error",
]);

/**
 * Check whether the VM is in a state that prevents it from being started.
 * Returns a human-readable reason string if the VM cannot be started,
 * or null if it can proceed.
 */
function getVmBlockReason(status: string): string | null {
  // Exact match
  if (NON_STARTABLE_STATUSES.has(status)) {
    return status;
  }
  // Prefix match for sub-states like "provisioning (ipsw_install)"
  for (const prefix of NON_STARTABLE_STATUSES) {
    if (status.startsWith(prefix)) {
      return status;
    }
  }
  return null;
}

/** Tracks whether the VM is confirmed reachable and ready for SSH. */
export let vmReady = false;

async function ensureVm(): Promise<void> {
  const existing = await getVm(CONFIG.vmName);
  if (existing) {
    console.log(`[setup] VM '${CONFIG.vmName}' already exists (status: ${existing.status}).`);

    const blockReason = getVmBlockReason(existing.status);
    if (blockReason) {
      console.log(`[test] VM is ${blockReason}, skipping VM-dependent tests`);
      vmReady = false;
      return;
    }

    if (existing.status !== "running") {
      await startVm();
    }
    vmReady = true;
  } else {
    await createVm();
    await startVm();
    vmReady = true;
  }
}

async function installOpenclaw(): Promise<void> {
  console.log("[setup] Installing openclaw inside VM...");

  await sshExec(
    `bash -c '
    set -euo pipefail
    export PATH="$HOME/.bun/bin:/opt/homebrew/bin:$PATH"

    # Install bun if missing
    if ! command -v bun &>/dev/null; then
      echo "Installing bun..."
      curl -fsSL https://bun.sh/install | bash
      export PATH="$HOME/.bun/bin:$PATH"
    fi

    # Install openclaw
    echo "Installing openclaw..."
    bun install -g openclaw 2>/dev/null || npm install -g openclaw

    echo "openclaw-installed"
  '`,
    120,
  );

  console.log("[setup] openclaw installed.");
}

async function installFixtures(): Promise<void> {
  console.log("[setup] Installing fixture skills into VM...");

  const fixturesDir = CONFIG.fixturesDir;
  let entries: string[];
  try {
    entries = await readdir(fixturesDir);
  } catch {
    console.log("[setup] No fixtures directory found. Skipping.");
    return;
  }

  // Create target directory
  await sshExec("mkdir -p ~/test-skills");

  // For each fixture, tar it up and pipe into the VM
  for (const entry of entries) {
    const skillPath = join(fixturesDir, entry);
    const stat = await Bun.file(join(skillPath, "skill.json")).exists();
    if (!stat) continue;

    console.log(`[setup]   Deploying fixture: ${entry}`);

    // Use tar to transfer the fixture into the VM
    const tar = Bun.spawn(["tar", "-cf", "-", "-C", fixturesDir, entry], {
      stdout: "pipe",
    });

    const sshProc = Bun.spawn(
      [
        "lume",
        "ssh",
        CONFIG.vmName,
        "-u",
        CONFIG.sshUser,
        "-p",
        CONFIG.sshPassword,
        "tar -xf - -C ~/test-skills/",
      ],
      { stdin: tar.stdout },
    );

    await sshProc.exited;
  }

  console.log("[setup] Fixtures deployed.");
}

async function verifyEnvironment(): Promise<void> {
  console.log("[setup] Verifying VM environment...");

  const output = await sshExec(
    `bash -c '
    export PATH="$HOME/.bun/bin:/opt/homebrew/bin:$PATH"
    echo "macos=$(sw_vers -productVersion)"
    echo "bun=$(bun --version 2>/dev/null || echo missing)"
    echo "openclaw=$(openclaw --version 2>/dev/null || echo missing)"
    echo "fixtures=$(ls ~/test-skills/ 2>/dev/null | tr "\\n" "," || echo none)"
  '`,
    30,
  );

  console.log("[setup] VM environment:");
  for (const line of output.split("\n")) {
    if (line.trim()) {
      console.log(`[setup]   ${line.trim()}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Teardown
// ---------------------------------------------------------------------------

async function teardown(): Promise<void> {
  console.log("[setup] Tearing down test environment...");
  try {
    await stopVm();
  } catch (e) {
    console.log(`[setup] Stop failed (may already be stopped): ${e}`);
  }
  try {
    await deleteVm();
  } catch (e) {
    console.log(`[setup] Delete failed: ${e}`);
  }
  console.log("[setup] Teardown complete.");
}

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

async function status(): Promise<void> {
  await ensureLumeService();
  const vm = await getVm(CONFIG.vmName);
  if (vm) {
    console.log(`[status] VM '${vm.name}': ${vm.status} (cpu=${vm.cpu}, memory=${vm.memory})`);
  } else {
    console.log(`[status] VM '${CONFIG.vmName}' does not exist.`);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes("--teardown")) {
    await ensureLumeService();
    await teardown();
    return;
  }

  if (args.includes("--status")) {
    await status();
    return;
  }

  // Full setup
  await ensureLumeService();
  await ensureVm();
  await waitForSsh();
  await installOpenclaw();
  await installFixtures();
  await verifyEnvironment();

  console.log("");
  console.log("[setup] Environment is ready for e2e tests.");
  console.log(`[setup]   VM: ${CONFIG.vmName}`);
  console.log(`[setup]   SSH: lume ssh ${CONFIG.vmName}`);
  console.log(`[setup]   Run tests: bun test`);
}

main().catch((err) => {
  console.error("[setup] Fatal error:", err);
  process.exit(1);
});

// Export for use by tests
export {
  CONFIG,
  deleteVm,
  ensureLumeService,
  ensureVm,
  getVm,
  sshExec,
  stopVm,
  vmReady,
  waitForSsh,
};
