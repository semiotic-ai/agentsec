/**
 * SkillParser -- reads a skill directory and produces a fully
 * populated AgentSkill object including manifest and source files.
 */

import { basename } from "node:path";
import type { AgentSkill, SkillManifest } from "@agentsec/shared";
import { inferPlatformFromPath } from "@agentsec/shared";
import { findAndParseManifest, type ManifestResult } from "./manifest";
import { walkSkillDirectory } from "./walker";

export interface ParseOptions {
  /**
   * If true, skip reading file contents (only collect paths and metadata).
   * Useful for quick listing without the I/O cost of reading every file.
   */
  shallow?: boolean;
  /**
   * The default-discovery root directory this skill was found under.
   * When set, the returned skill records `sourceRoot` and an inferred
   * `discoveredAs` platform. Only populated when called from auto-discover.
   */
  sourceRoot?: string;
}

/**
 * SkillParser reads an OpenClaw skill directory from disk and produces
 * a complete AgentSkill record with manifest data and source files.
 */
export class SkillParser {
  /**
   * Parse a skill directory into an AgentSkill object.
   *
   * @param skillDir - Absolute path to the skill directory
   * @param options  - Optional parse configuration
   * @returns A fully populated AgentSkill, or null if the directory
   *          does not appear to be a valid skill (no manifest found).
   */
  async parse(skillDir: string, options: ParseOptions = {}): Promise<AgentSkill | null> {
    const manifestResult = await findAndParseManifest(skillDir);
    if (!manifestResult) {
      return null;
    }

    const files = options.shallow ? [] : await walkSkillDirectory(skillDir);
    const id = this.deriveSkillId(skillDir, manifestResult);

    return {
      id,
      name: manifestResult.manifest.name,
      version: manifestResult.manifest.version,
      path: skillDir,
      platform: "openclaw",
      manifest: manifestResult.manifest,
      files,
      sourceRoot: options.sourceRoot,
      discoveredAs: options.sourceRoot ? (inferPlatformFromPath(skillDir) ?? undefined) : undefined,
    };
  }

  /**
   * Parse a skill directory, throwing if no valid manifest is found.
   * Prefer this when you know the directory should contain a skill.
   */
  async parseOrThrow(skillDir: string, options: ParseOptions = {}): Promise<AgentSkill> {
    const skill = await this.parse(skillDir, options);
    if (!skill) {
      throw new Error(
        `No valid skill manifest found in ${skillDir}. ` +
          `Expected one of: skill.json, skill.yaml, skill.yml, SKILL.md, package.json, manifest.json`,
      );
    }
    return skill;
  }

  /**
   * Create a minimal AgentSkill from just a manifest and path,
   * without reading any files. Useful for testing or when you
   * already have the manifest data.
   */
  fromManifest(skillDir: string, manifest: SkillManifest): AgentSkill {
    return {
      id: `${manifest.name}@${manifest.version}`,
      name: manifest.name,
      version: manifest.version,
      path: skillDir,
      platform: "openclaw",
      manifest,
      files: [],
    };
  }

  /**
   * Derive a stable skill ID from the directory name and manifest.
   *
   * Uses the manifest name if available and meaningful, otherwise
   * falls back to the directory basename.
   */
  private deriveSkillId(skillDir: string, manifestResult: ManifestResult): string {
    const name = manifestResult.manifest.name;
    const version = manifestResult.manifest.version;

    // Use the manifest name if it's not the default "unknown"
    if (name && name !== "unknown") {
      return `${name}@${version}`;
    }

    // Fall back to directory name
    const dirName = basename(skillDir);
    return `${dirName}@${version}`;
  }
}
