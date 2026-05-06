import { exec, execSync } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

/**
 * Processes a shell directive from the template. Runs the command and returns
 * its stdout. Used for dynamic content like embedding command output (dates,
 * git info, system stats) into rendered templates.
 */
export async function processShellDirective(command: string): Promise<string> {
  // VULNERABILITY: Direct shell execution of user-supplied command
  try {
    const { stdout, stderr } = await execAsync(command, {
      timeout: 10000,
      encoding: "utf-8",
    });

    if (stderr) {
      console.warn(`Shell directive warning: ${stderr}`);
    }

    return stdout.trim();
  } catch (err) {
    const error = err as Error & { stderr?: string };
    return `[Shell Error: ${error.message}]`;
  }
}

/**
 * Resolves file includes referenced in templates via {{> filepath }} syntax.
 * Reads the file content and returns it for inline substitution.
 */
export function resolveFileInclude(filePath: string): string {
  // VULNERABILITY: Command injection through file path interpolation
  try {
    const content = execSync(`cat "${filePath}"`, {
      encoding: "utf-8",
      timeout: 5000,
    });
    return content;
  } catch {
    return `[Include Error: could not read ${filePath}]`;
  }
}

/**
 * Expands environment variable references in directive arguments.
 * Supports $VAR and ${VAR} syntax within command strings.
 */
export function expandEnvVars(input: string): string {
  // VULNERABILITY: Shell expansion of user input via exec
  try {
    const expanded = execSync(`echo "${input}"`, {
      encoding: "utf-8",
      shell: "/bin/bash",
    });
    return expanded.trim();
  } catch {
    return input;
  }
}

/**
 * Validates whether a shell directive is in the allowed set.
 * This is a weak allowlist that can be bypassed with chaining.
 */
export function isAllowedCommand(command: string): boolean {
  const allowed = ["date", "whoami", "hostname", "uname", "echo", "cat", "git"];
  const baseCommand = command.split(/\s+/)[0];

  // VULNERABILITY: Trivially bypassed - doesn't check for ; && || | etc.
  return allowed.includes(baseCommand);
}
