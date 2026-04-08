/**
 * SkillDiscovery -- scans known directories on the local system
 * to find installed OpenClaw skills.
 */

import { readdir } from "node:fs/promises";
import { homedir, platform } from "node:os";
import { join, resolve } from "node:path";
import type { AgentSkill } from "@agent-audit/shared";
import { OPENCLAW_SKILL_DIRS } from "@agent-audit/shared";
import { type ParseOptions, SkillParser } from "./parser";

export interface DiscoveryConfig {
  /**
   * Extra directories to scan in addition to the platform defaults.
   * Paths may use ~ for the home directory.
   */
  additionalPaths?: string[];

  /**
   * If provided, only scan these directories and skip the platform defaults.
   */
  onlyPaths?: string[];

  /**
   * If true, do a shallow parse (manifest only, no file contents).
   * Much faster for large skill collections.
   */
  shallow?: boolean;

  /**
   * Override platform detection (defaults to os.platform()).
   * Useful for testing.
   */
  platform?: string;
}

/**
 * SkillDiscovery scans the filesystem for installed OpenClaw skills.
 *
 * It checks well-known installation directories based on the current OS,
 * and can also scan custom directories specified in config.
 */
export class SkillDiscovery {
  private parser: SkillParser;
  private config: DiscoveryConfig;

  constructor(config: DiscoveryConfig = {}) {
    this.config = config;
    this.parser = new SkillParser();
  }

  /**
   * Discover all installed OpenClaw skills.
   *
   * Scans each candidate directory for subdirectories that contain
   * a valid skill manifest. Returns a deduplicated list of skills.
   */
  async discover(): Promise<AgentSkill[]> {
    const searchDirs = this.getSearchDirectories();
    const skills: AgentSkill[] = [];
    const seenPaths = new Set<string>();

    for (const dir of searchDirs) {
      const resolved = this.expandPath(dir);

      // Check if the directory exists
      if (!(await this.directoryExists(resolved))) {
        continue;
      }

      const discovered = await this.scanDirectory(resolved);
      for (const skill of discovered) {
        // Deduplicate by resolved path
        if (!seenPaths.has(skill.path)) {
          seenPaths.add(skill.path);
          skills.push(skill);
        }
      }
    }

    return skills;
  }

  /**
   * Scan a single directory for skill subdirectories.
   *
   * Each subdirectory is tested as a potential skill by attempting
   * to parse its manifest. Subdirectories without a valid manifest
   * are silently skipped.
   */
  async scanDirectory(parentDir: string): Promise<AgentSkill[]> {
    const skills: AgentSkill[] = [];
    let entries: import("node:fs").Dirent[];

    try {
      entries = (await readdir(parentDir, { withFileTypes: true })) as import("node:fs").Dirent[];
    } catch {
      return skills;
    }

    const parseOptions: ParseOptions = { shallow: this.config.shallow };
    const parsePromises: Promise<void>[] = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      // Skip hidden directories (except those starting with @, which are scoped packages)
      if (entry.name.startsWith(".") && !entry.name.startsWith("@")) {
        continue;
      }

      const skillDir = join(parentDir, entry.name);

      // Handle scoped directories (@org/skill-name)
      if (entry.name.startsWith("@")) {
        parsePromises.push(
          this.scanScopedDirectory(skillDir, parseOptions).then((scopedSkills) => {
            skills.push(...scopedSkills);
          }),
        );
        continue;
      }

      parsePromises.push(
        this.parser
          .parse(skillDir, parseOptions)
          .then((skill) => {
            if (skill) {
              skills.push(skill);
            }
          })
          .catch(() => {
            // Silently skip directories that fail to parse
          }),
      );
    }

    await Promise.all(parsePromises);
    return skills;
  }

  /**
   * Scan a scoped directory (e.g. @myorg/) for skill subdirectories.
   */
  private async scanScopedDirectory(
    scopedDir: string,
    parseOptions: ParseOptions,
  ): Promise<AgentSkill[]> {
    const skills: AgentSkill[] = [];
    let entries: import("node:fs").Dirent[];

    try {
      entries = (await readdir(scopedDir, { withFileTypes: true })) as import("node:fs").Dirent[];
    } catch {
      return skills;
    }

    const promises: Promise<void>[] = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const skillDir = join(scopedDir, entry.name);
      promises.push(
        this.parser
          .parse(skillDir, parseOptions)
          .then((skill) => {
            if (skill) {
              skills.push(skill);
            }
          })
          .catch(() => {
            // skip
          }),
      );
    }

    await Promise.all(promises);
    return skills;
  }

  /**
   * Parse a single skill at a known path.
   * Convenience method when you already know the exact directory.
   */
  async parseSkill(skillDir: string): Promise<AgentSkill | null> {
    const resolved = this.expandPath(skillDir);
    return this.parser.parse(resolved, { shallow: this.config.shallow });
  }

  /**
   * Get the list of directories to search for skills.
   */
  getSearchDirectories(): string[] {
    if (this.config.onlyPaths) {
      return this.config.onlyPaths;
    }

    const osPlatform = this.config.platform ?? platform();
    const platformDirs = OPENCLAW_SKILL_DIRS[osPlatform] ?? [];
    const additional = this.config.additionalPaths ?? [];

    return [...platformDirs, ...additional];
  }

  /**
   * Expand ~ and environment variables in a path to an absolute path.
   */
  expandPath(inputPath: string): string {
    let expanded = inputPath;

    // Expand ~ to home directory
    if (expanded.startsWith("~/") || expanded === "~") {
      expanded = join(homedir(), expanded.slice(1));
    }

    // Expand Windows environment variables (%APPDATA%, etc.)
    expanded = expanded.replace(/%([^%]+)%/g, (_, varName: string) => {
      return process.env[varName] ?? `%${varName}%`;
    });

    return resolve(expanded);
  }

  /**
   * Check if a directory exists and is accessible.
   */
  private async directoryExists(dirPath: string): Promise<boolean> {
    try {
      await readdir(dirPath);
      return true;
    } catch {
      return false;
    }
  }
}
