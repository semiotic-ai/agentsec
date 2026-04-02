/**
 * vm-manager.ts - Lume VM lifecycle management for agent-audit
 *
 * Manages macOS VMs via the Lume HTTP API (default: http://localhost:7777).
 * Lume uses Apple's Virtualization Framework to run macOS/Linux VMs
 * at near-native speed on Apple Silicon.
 *
 * Prerequisites:
 *   - Apple Silicon Mac (M1/M2/M3/M4)
 *   - Lume installed: /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/trycua/cua/main/libs/lume/scripts/install.sh)"
 *   - Lume service running on port 7777 (starts automatically after install)
 *
 * Usage:
 *   import { LumeVM } from "./vm-manager";
 *   const vm = new LumeVM("audit-vm");
 *   await vm.start();
 *   const result = await vm.exec("uname -a");
 *   await vm.snapshot("clean-state");
 *   await vm.stop();
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface VMConfig {
  /** VM name (used as identifier in Lume) */
  name: string;
  /** Lume HTTP API base URL */
  apiUrl?: string;
  /** Number of CPU cores */
  cpu?: number;
  /** Memory size, e.g. "8GB" */
  memory?: string;
  /** Disk size, e.g. "50GB" */
  diskSize?: string;
  /** Display resolution, e.g. "1024x768" */
  display?: string;
  /** SSH username (Lume default: "lume") */
  sshUser?: string;
  /** SSH password (Lume default: "lume") */
  sshPassword?: string;
  /** SSH command timeout in seconds */
  sshTimeout?: number;
  /** Run headless (no VNC window) */
  headless?: boolean;
  /** Directories to share with the VM */
  sharedDirectories?: string[];
  /** Storage location name or path */
  storage?: string;
}

export interface VMInfo {
  name: string;
  status: string;
  cpu?: number;
  memory?: string;
  diskSize?: string;
  ip?: string;
  display?: string;
  [key: string]: unknown;
}

export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

// ---------------------------------------------------------------------------
// Lume HTTP API Client
// ---------------------------------------------------------------------------

class LumeAPIClient {
  private baseUrl: string;

  constructor(baseUrl: string = "http://localhost:7777") {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  async request<T = unknown>(
    method: string,
    path: string,
    body?: Record<string, unknown>,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const options: RequestInit = {
      method,
      headers: { "Content-Type": "application/json" },
    };
    if (body && method !== "GET") {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(
        `Lume API ${method} ${path} failed (${response.status}): ${text}`,
      );
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      return (await response.json()) as T;
    }
    return (await response.text()) as unknown as T;
  }

  // -- VM Management -------------------------------------------------------

  async listVMs(storage?: string): Promise<VMInfo[]> {
    const query = storage ? `?storage=${encodeURIComponent(storage)}` : "";
    return this.request<VMInfo[]>("GET", `/lume/vms${query}`);
  }

  async getVM(name: string, storage?: string): Promise<VMInfo> {
    const query = storage ? `?storage=${encodeURIComponent(storage)}` : "";
    return this.request<VMInfo>("GET", `/lume/vms/${name}${query}`);
  }

  async createVM(config: {
    name: string;
    os?: string;
    cpu?: number;
    memory?: string;
    diskSize?: string;
    display?: string;
    ipsw?: string;
    storage?: string;
  }): Promise<unknown> {
    return this.request("POST", "/lume/vms", {
      name: config.name,
      os: config.os ?? "macOS",
      cpu: config.cpu ?? 4,
      memory: config.memory ?? "8GB",
      diskSize: config.diskSize ?? "50GB",
      display: config.display ?? "1024x768",
      ...(config.ipsw ? { ipsw: config.ipsw } : {}),
      ...(config.storage ? { storage: config.storage } : {}),
    });
  }

  async runVM(
    name: string,
    opts?: {
      noDisplay?: boolean;
      sharedDirectories?: string[];
      storage?: string;
    },
  ): Promise<unknown> {
    return this.request("POST", `/lume/vms/${name}/run`, {
      noDisplay: opts?.noDisplay ?? true,
      ...(opts?.sharedDirectories
        ? { sharedDirectories: opts.sharedDirectories }
        : {}),
      ...(opts?.storage ? { storage: opts.storage } : {}),
    });
  }

  async stopVM(name: string, storage?: string): Promise<unknown> {
    return this.request("POST", `/lume/vms/${name}/stop`, {
      ...(storage ? { storage } : {}),
    });
  }

  async deleteVM(name: string, storage?: string): Promise<unknown> {
    const query = storage ? `?storage=${encodeURIComponent(storage)}` : "";
    return this.request("DELETE", `/lume/vms/${name}${query}`);
  }

  async cloneVM(
    name: string,
    newName: string,
    sourceLocation?: string,
    destLocation?: string,
  ): Promise<unknown> {
    return this.request("POST", "/lume/vms/clone", {
      name,
      newName,
      ...(sourceLocation ? { sourceLocation } : {}),
      ...(destLocation ? { destLocation } : {}),
    });
  }

  async updateVM(
    name: string,
    settings: {
      cpu?: number;
      memory?: string;
      diskSize?: string;
      display?: string;
      storage?: string;
    },
  ): Promise<unknown> {
    return this.request("PATCH", `/lume/vms/${name}`, settings);
  }

  // -- Image Management ----------------------------------------------------

  async pullImage(
    image: string,
    vmName?: string,
    storage?: string,
  ): Promise<unknown> {
    return this.request("POST", "/lume/pull", {
      image,
      ...(vmName ? { name: vmName } : {}),
      ...(storage ? { storage } : {}),
    });
  }

  async listImages(): Promise<unknown[]> {
    return this.request<unknown[]>("GET", "/lume/images");
  }

  async getIPSW(): Promise<{ url: string }> {
    return this.request<{ url: string }>("GET", "/lume/ipsw");
  }
}

// ---------------------------------------------------------------------------
// LumeVM - High-level VM Manager
// ---------------------------------------------------------------------------

export class LumeVM {
  readonly name: string;
  private config: Required<
    Pick<VMConfig, "apiUrl" | "cpu" | "memory" | "diskSize" | "display" | "sshUser" | "sshPassword" | "sshTimeout" | "headless">
  > &
    Pick<VMConfig, "sharedDirectories" | "storage">;
  private api: LumeAPIClient;

  constructor(nameOrConfig: string | VMConfig) {
    const cfg: VMConfig =
      typeof nameOrConfig === "string"
        ? { name: nameOrConfig }
        : nameOrConfig;

    this.name = cfg.name;
    this.config = {
      apiUrl: cfg.apiUrl ?? "http://localhost:7777",
      cpu: cfg.cpu ?? 4,
      memory: cfg.memory ?? "8GB",
      diskSize: cfg.diskSize ?? "50GB",
      display: cfg.display ?? "1024x768",
      sshUser: cfg.sshUser ?? "lume",
      sshPassword: cfg.sshPassword ?? "lume",
      sshTimeout: cfg.sshTimeout ?? 60,
      headless: cfg.headless ?? true,
      sharedDirectories: cfg.sharedDirectories,
      storage: cfg.storage,
    };
    this.api = new LumeAPIClient(this.config.apiUrl);
  }

  // -----------------------------------------------------------------------
  // Lifecycle
  // -----------------------------------------------------------------------

  /**
   * Start the VM. If it does not exist, pull the default image and create it.
   * Waits for the VM to become responsive via SSH before returning.
   */
  async start(): Promise<void> {
    const exists = await this.exists();
    if (!exists) {
      console.log(`[vm-manager] VM "${this.name}" not found. Pulling image and creating...`);
      await this.api.pullImage("macos-sequoia-cua:latest", this.name, this.config.storage);
      console.log(`[vm-manager] Image pulled. Waiting for VM provisioning...`);
      await this.waitForStatus(["stopped"], 600_000); // up to 10 min for image pull
    }

    const info = await this.info();
    if (info.status === "running") {
      console.log(`[vm-manager] VM "${this.name}" is already running.`);
      return;
    }

    console.log(`[vm-manager] Starting VM "${this.name}"...`);
    await this.api.runVM(this.name, {
      noDisplay: this.config.headless,
      sharedDirectories: this.config.sharedDirectories,
      storage: this.config.storage,
    });

    // Wait for the VM to be reachable via SSH
    await this.waitForSSH(120_000);
    console.log(`[vm-manager] VM "${this.name}" is running and reachable.`);
  }

  /** Stop the VM gracefully. */
  async stop(): Promise<void> {
    console.log(`[vm-manager] Stopping VM "${this.name}"...`);
    await this.api.stopVM(this.name, this.config.storage);
    await this.waitForStatus(["stopped"], 120_000);
    console.log(`[vm-manager] VM "${this.name}" stopped.`);
  }

  /** Delete the VM and all its files. */
  async destroy(): Promise<void> {
    console.log(`[vm-manager] Deleting VM "${this.name}"...`);
    try {
      await this.stop();
    } catch {
      // May already be stopped
    }
    await this.api.deleteVM(this.name, this.config.storage);
    console.log(`[vm-manager] VM "${this.name}" deleted.`);
  }

  // -----------------------------------------------------------------------
  // Snapshots (implemented via clone/restore pattern)
  //
  // Lume does not have a native snapshot API. We implement snapshots by
  // cloning the VM. To restore, we delete the current VM and clone the
  // snapshot back.
  // -----------------------------------------------------------------------

  /**
   * Take a snapshot by cloning the current VM.
   * The VM should be stopped before snapshotting for consistency.
   */
  async snapshot(label: string): Promise<string> {
    const snapshotName = `${this.name}--snapshot-${label}`;
    console.log(`[vm-manager] Creating snapshot "${snapshotName}"...`);

    // Stop if running for a clean snapshot
    const info = await this.info();
    const wasRunning = info.status === "running";
    if (wasRunning) {
      await this.stop();
    }

    await this.api.cloneVM(this.name, snapshotName);
    console.log(`[vm-manager] Snapshot "${snapshotName}" created.`);

    if (wasRunning) {
      await this.start();
    }

    return snapshotName;
  }

  /**
   * Restore from a previously taken snapshot.
   * Destroys the current VM and clones the snapshot back to the original name.
   */
  async restore(label: string): Promise<void> {
    const snapshotName = `${this.name}--snapshot-${label}`;
    console.log(`[vm-manager] Restoring from snapshot "${snapshotName}"...`);

    // Verify snapshot exists
    try {
      await this.api.getVM(snapshotName);
    } catch {
      throw new Error(`Snapshot "${snapshotName}" not found.`);
    }

    // Delete current VM
    try {
      await this.destroy();
    } catch {
      // May not exist
    }

    // Clone snapshot back to original name
    await this.api.cloneVM(snapshotName, this.name);
    console.log(`[vm-manager] Restored from "${snapshotName}".`);
  }

  /** List available snapshots for this VM. */
  async listSnapshots(): Promise<string[]> {
    const prefix = `${this.name}--snapshot-`;
    const vms = await this.api.listVMs();
    return vms
      .filter((vm) => vm.name.startsWith(prefix))
      .map((vm) => vm.name.replace(prefix, ""));
  }

  // -----------------------------------------------------------------------
  // Command Execution
  // -----------------------------------------------------------------------

  /**
   * Execute a command in the VM over SSH.
   * Uses `lume ssh` CLI under the hood, which handles SSH key management
   * and connects using the VM's internal IP.
   */
  async exec(command: string, timeoutSeconds?: number): Promise<ExecResult> {
    const timeout = timeoutSeconds ?? this.config.sshTimeout;
    const args = [
      "lume", "ssh", this.name,
      "-u", this.config.sshUser,
      "-p", this.config.sshPassword,
      "-t", String(timeout),
      ...(this.config.storage ? ["--storage", this.config.storage] : []),
      command,
    ];

    const proc = Bun.spawn(args, {
      stdout: "pipe",
      stderr: "pipe",
    });

    const [stdout, stderr] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
    ]);
    const exitCode = await proc.exited;

    return { stdout: stdout.trim(), stderr: stderr.trim(), exitCode };
  }

  /**
   * Execute a command and throw if it fails (non-zero exit code).
   */
  async execOrThrow(command: string, timeoutSeconds?: number): Promise<string> {
    const result = await this.exec(command, timeoutSeconds);
    if (result.exitCode !== 0) {
      throw new Error(
        `Command failed (exit ${result.exitCode}): ${command}\nstderr: ${result.stderr}`,
      );
    }
    return result.stdout;
  }

  /**
   * Copy a file from the host to the VM using SSH/scp.
   */
  async copyToVM(localPath: string, remotePath: string): Promise<void> {
    const info = await this.info();
    const ip = info.ip;
    if (!ip) throw new Error("Cannot determine VM IP address");

    const proc = Bun.spawn([
      "sshpass", "-p", this.config.sshPassword,
      "scp", "-o", "StrictHostKeyChecking=no",
      "-o", "UserKnownHostsFile=/dev/null",
      localPath,
      `${this.config.sshUser}@${ip}:${remotePath}`,
    ], { stdout: "pipe", stderr: "pipe" });

    const exitCode = await proc.exited;
    if (exitCode !== 0) {
      const stderr = await new Response(proc.stderr).text();
      throw new Error(`scp failed: ${stderr}`);
    }
  }

  // -----------------------------------------------------------------------
  // Info & Utilities
  // -----------------------------------------------------------------------

  /** Get detailed VM info from Lume. */
  async info(): Promise<VMInfo> {
    return this.api.getVM(this.name, this.config.storage);
  }

  /** Check if the VM exists. */
  async exists(): Promise<boolean> {
    try {
      await this.api.getVM(this.name, this.config.storage);
      return true;
    } catch {
      return false;
    }
  }

  /** Get the VM's IP address. */
  async getIP(): Promise<string | undefined> {
    const info = await this.info();
    return info.ip as string | undefined;
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  /**
   * Poll until the VM reaches one of the expected statuses.
   */
  private async waitForStatus(
    expected: string[],
    timeoutMs: number,
    pollIntervalMs: number = 3000,
  ): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      try {
        const info = await this.api.getVM(this.name, this.config.storage);
        if (expected.includes(info.status)) return;
      } catch {
        // VM may not exist yet during provisioning
      }
      await Bun.sleep(pollIntervalMs);
    }
    throw new Error(
      `VM "${this.name}" did not reach status [${expected.join(", ")}] within ${timeoutMs}ms`,
    );
  }

  /**
   * Wait until the VM is reachable via SSH.
   */
  private async waitForSSH(timeoutMs: number): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      try {
        const result = await this.exec("echo ok", 5);
        if (result.exitCode === 0 && result.stdout.includes("ok")) return;
      } catch {
        // Not ready yet
      }
      await Bun.sleep(3000);
    }
    throw new Error(`VM "${this.name}" SSH not reachable within ${timeoutMs}ms`);
  }
}

// ---------------------------------------------------------------------------
// CLI entry point - run directly with `bun run .lume/vm-manager.ts <command>`
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const vmName = args[1] ?? "agent-audit-vm";

  const vm = new LumeVM({
    name: vmName,
    headless: true,
  });

  switch (command) {
    case "start":
      await vm.start();
      break;
    case "stop":
      await vm.stop();
      break;
    case "destroy":
      await vm.destroy();
      break;
    case "info":
      console.log(JSON.stringify(await vm.info(), null, 2));
      break;
    case "snapshot":
      if (!args[2]) {
        console.error("Usage: vm-manager.ts snapshot <label>");
        process.exit(1);
      }
      await vm.snapshot(args[2]);
      break;
    case "restore":
      if (!args[2]) {
        console.error("Usage: vm-manager.ts restore <label>");
        process.exit(1);
      }
      await vm.restore(args[2]);
      break;
    case "snapshots":
      const snaps = await vm.listSnapshots();
      console.log(snaps.length ? snaps.join("\n") : "(no snapshots)");
      break;
    case "exec":
      if (!args[2]) {
        console.error("Usage: vm-manager.ts exec <vmname> <command>");
        process.exit(1);
      }
      const result = await vm.exec(args.slice(2).join(" "));
      if (result.stdout) console.log(result.stdout);
      if (result.stderr) console.error(result.stderr);
      process.exit(result.exitCode);
      break;
    default:
      console.log(`Usage: bun run vm-manager.ts <command> [vm-name] [args...]

Commands:
  start   [name]          Start a VM (pulls image if needed)
  stop    [name]          Stop a running VM
  destroy [name]          Delete a VM and its files
  info    [name]          Show VM details as JSON
  snapshot [name] <label> Take a named snapshot
  restore  [name] <label> Restore from a named snapshot
  snapshots [name]        List available snapshots
  exec    [name] <cmd>    Execute a command in the VM

Default VM name: agent-audit-vm`);
  }
}

// Only run CLI if executed directly
if (import.meta.main) {
  main().catch((err) => {
    console.error(`[vm-manager] Error: ${err.message}`);
    process.exit(1);
  });
}
