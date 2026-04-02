import type { AgentSkill } from "@agent-audit/shared";

export interface DependencyResult {
  /** Total number of declared dependencies */
  totalDependencies: number;
  /** Number of production dependencies */
  productionDeps: number;
  /** Number of dev dependencies */
  devDeps: number;
  /** Whether a lock file was found */
  hasLockFile: boolean;
  /** Number of potentially outdated dependencies (estimated from lock file absence) */
  outdatedDependencies: number;
  /** Whether the dependency count is considered excessive */
  excessiveDependencies: boolean;
  /** Names of direct dependencies */
  dependencyNames: string[];
  /** Warnings about dependency issues */
  warnings: string[];
}

/** Thresholds for dependency warnings */
const DEP_THRESHOLDS = {
  /** Warn when total deps exceed this */
  excessive: 20,
  /** High concern when total deps exceed this */
  veryExcessive: 50,
};

/**
 * Known lock file names across package managers.
 */
const LOCK_FILES = [
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "bun.lockb",
  "bun.lock",
  "Pipfile.lock",
  "poetry.lock",
  "requirements.txt",
];

/**
 * Parse a package.json file and extract dependency information.
 */
function parsePackageJson(content: string): {
  deps: Record<string, string>;
  devDeps: Record<string, string>;
} {
  try {
    const pkg = JSON.parse(content);
    return {
      deps: pkg.dependencies ?? {},
      devDeps: pkg.devDependencies ?? {},
    };
  } catch {
    return { deps: {}, devDeps: {} };
  }
}

/**
 * Parse Python requirements from requirements.txt or Pipfile.
 */
function parsePythonDeps(content: string): string[] {
  const deps: string[] = [];
  const lines = content.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    // Skip empty lines, comments, and options
    if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("-")) continue;
    // Extract package name (before any version specifier)
    const match = trimmed.match(/^([a-zA-Z0-9_-]+)/);
    if (match) {
      deps.push(match[1]);
    }
  }

  return deps;
}

/**
 * Parse Python dependencies from pyproject.toml (basic parsing).
 */
function parsePyprojectDeps(content: string): string[] {
  const deps: string[] = [];
  // Look for dependencies array in [project] section
  const depsMatch = content.match(/\[project\][\s\S]*?dependencies\s*=\s*\[([\s\S]*?)\]/);
  if (depsMatch) {
    const depsBlock = depsMatch[1];
    const lines = depsBlock.split("\n");
    for (const line of lines) {
      const trimmed = line.trim().replace(/[",]/g, "");
      if (!trimmed) continue;
      const match = trimmed.match(/^([a-zA-Z0-9_-]+)/);
      if (match) {
        deps.push(match[1]);
      }
    }
  }
  return deps;
}

/**
 * Analyze dependencies for an agent skill.
 * Examines manifest dependencies, package.json, requirements.txt, and other
 * dependency declaration files. Detects lock files and flags excessive counts.
 */
export function analyzeDependencies(skill: AgentSkill): DependencyResult {
  const files = skill.files;
  const warnings: string[] = [];
  let productionDeps = 0;
  let devDeps = 0;
  const allDepNames: string[] = [];

  // Check manifest dependencies first
  if (skill.manifest.dependencies) {
    const manifestDeps = Object.keys(skill.manifest.dependencies);
    allDepNames.push(...manifestDeps);
    productionDeps += manifestDeps.length;
  }

  // Parse package.json if present
  const packageJsonFile = files.find(
    (f) => f.relativePath === "package.json" || f.relativePath.endsWith("/package.json"),
  );

  if (packageJsonFile) {
    const { deps, devDeps: devDepsMap } = parsePackageJson(packageJsonFile.content);
    const depNames = Object.keys(deps);
    const devDepNames = Object.keys(devDepsMap);

    // Avoid double-counting with manifest
    for (const name of depNames) {
      if (!allDepNames.includes(name)) {
        allDepNames.push(name);
        productionDeps++;
      }
    }
    for (const name of devDepNames) {
      if (!allDepNames.includes(name)) {
        allDepNames.push(name);
        devDeps++;
      }
    }
  }

  // Parse Python dependency files
  const requirementsFile = files.find(
    (f) =>
      f.relativePath === "requirements.txt" ||
      f.relativePath === "requirements/base.txt" ||
      f.relativePath === "requirements/prod.txt",
  );

  if (requirementsFile) {
    const pythonDeps = parsePythonDeps(requirementsFile.content);
    for (const name of pythonDeps) {
      if (!allDepNames.includes(name)) {
        allDepNames.push(name);
        productionDeps++;
      }
    }
  }

  const pyprojectFile = files.find((f) => f.relativePath === "pyproject.toml");
  if (pyprojectFile) {
    const pyprojectDeps = parsePyprojectDeps(pyprojectFile.content);
    for (const name of pyprojectDeps) {
      if (!allDepNames.includes(name)) {
        allDepNames.push(name);
        productionDeps++;
      }
    }
  }

  // Check for lock file presence
  const hasLockFile = files.some((f) => {
    const basename = f.relativePath.split("/").pop() ?? "";
    return LOCK_FILES.includes(basename);
  });

  // Estimate outdated dependencies
  // Without a lock file, we cannot verify versions, so we flag all as potentially outdated
  let outdatedDependencies = 0;
  if (!hasLockFile && allDepNames.length > 0) {
    // Without a lock file, dependencies are unverified
    outdatedDependencies = allDepNames.length;
    warnings.push("No lock file found. All dependencies are potentially outdated or unverified.");
  }

  // Check for version pinning in package.json
  if (packageJsonFile) {
    try {
      const pkg = JSON.parse(packageJsonFile.content);
      const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
      let unpinnedCount = 0;

      for (const [_name, version] of Object.entries(deps)) {
        const v = version as string;
        // Unpinned: starts with ^ or ~ or * or >= or > or latest
        if (/^[\^~*>]|latest/.test(v)) {
          unpinnedCount++;
        }
      }

      if (unpinnedCount > 0) {
        warnings.push(`${unpinnedCount} dependencies use unpinned version ranges (^, ~, *, etc.).`);
      }
    } catch {
      // Ignore parse errors; already handled above
    }
  }

  const totalDependencies = allDepNames.length;

  // Flag excessive dependencies
  const excessiveDependencies = totalDependencies > DEP_THRESHOLDS.excessive;
  if (totalDependencies > DEP_THRESHOLDS.veryExcessive) {
    warnings.push(
      `Very high dependency count (${totalDependencies}). Consider reducing dependencies to minimize supply chain risk.`,
    );
  } else if (excessiveDependencies) {
    warnings.push(
      `High dependency count (${totalDependencies}). Review whether all dependencies are necessary.`,
    );
  }

  return {
    totalDependencies,
    productionDeps,
    devDeps,
    hasLockFile,
    outdatedDependencies,
    excessiveDependencies,
    dependencyNames: allDepNames,
    warnings,
  };
}
