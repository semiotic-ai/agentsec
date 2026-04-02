import type { SkillFile } from "@agent-audit/shared";

export interface DocumentationResult {
  /** Overall documentation quality score, 0-1 */
  score: number;
  /** Whether a README.md file is present */
  hasReadme: boolean;
  /** README length in characters (0 if absent) */
  readmeLength: number;
  /** Score component for README quality (0-1) */
  readmeScore: number;
  /** Ratio of comment lines to total code lines */
  commentRatio: number;
  /** Score component for inline comments (0-1) */
  commentScore: number;
  /** Whether JSDoc or docstrings are present */
  hasDocstrings: boolean;
  /** Count of JSDoc/docstring blocks found */
  docstringCount: number;
  /** Score component for JSDoc/docstrings (0-1) */
  docstringScore: number;
}

/** Weight each component contributes to the final score */
const WEIGHTS = {
  readme: 0.35,
  comments: 0.3,
  docstrings: 0.35,
};

/** Minimum README length (chars) to be considered substantive */
const README_MIN_LENGTH = 100;
/** README length (chars) considered "excellent" for full score */
const README_EXCELLENT_LENGTH = 1000;

/**
 * Score README quality based on presence, length, and content signals.
 */
function scoreReadme(files: SkillFile[]): {
  hasReadme: boolean;
  readmeLength: number;
  score: number;
} {
  const readme = files.find(
    (f) =>
      f.relativePath.toLowerCase() === "readme.md" || f.relativePath.toLowerCase() === "readme",
  );

  if (!readme) {
    return { hasReadme: false, readmeLength: 0, score: 0 };
  }

  const content = readme.content;
  const length = content.length;

  if (length < README_MIN_LENGTH) {
    return { hasReadme: true, readmeLength: length, score: 0.2 };
  }

  // Base score from length (0.2 to 0.7)
  let score = 0.2 + 0.5 * Math.min(1, length / README_EXCELLENT_LENGTH);

  // Bonus for having sections (headings)
  const headingCount = (content.match(/^#{1,3}\s+/gm) ?? []).length;
  if (headingCount >= 3) score += 0.1;
  else if (headingCount >= 1) score += 0.05;

  // Bonus for code examples
  const hasCodeBlocks = /```[\s\S]*?```/.test(content);
  if (hasCodeBlocks) score += 0.1;

  // Bonus for having an installation/usage section
  const hasUsageSection = /(?:install|usage|getting\s+started|quick\s*start)/i.test(content);
  if (hasUsageSection) score += 0.1;

  return { hasReadme: true, readmeLength: length, score: Math.min(1, score) };
}

/**
 * Detect comment lines in source code and compute the ratio.
 */
function analyzeComments(files: SkillFile[]): { ratio: number; score: number } {
  let totalCodeLines = 0;
  let totalCommentLines = 0;

  for (const file of files) {
    const lang = file.language.toLowerCase();
    const isSource =
      lang === "javascript" ||
      lang === "typescript" ||
      lang === "js" ||
      lang === "ts" ||
      lang === "jsx" ||
      lang === "tsx" ||
      lang === "python" ||
      lang === "py";

    if (!isSource) continue;

    const lines = file.content.split("\n");
    const isPython = lang === "python" || lang === "py";
    let inBlockComment = false;

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed === "") continue;

      totalCodeLines++;

      if (isPython) {
        if (trimmed.startsWith("#")) {
          totalCommentLines++;
        }
      } else {
        if (inBlockComment) {
          totalCommentLines++;
          if (trimmed.includes("*/")) {
            inBlockComment = false;
          }
          continue;
        }
        if (trimmed.startsWith("/*")) {
          totalCommentLines++;
          if (!trimmed.includes("*/")) {
            inBlockComment = true;
          }
          continue;
        }
        if (trimmed.startsWith("//")) {
          totalCommentLines++;
        }
      }
    }
  }

  if (totalCodeLines === 0) {
    return { ratio: 0, score: 0 };
  }

  const ratio = totalCommentLines / totalCodeLines;

  // Ideal comment ratio is 10-25%. Too low = undocumented, too high = excessive.
  let score: number;
  if (ratio < 0.03) {
    score = (ratio / 0.03) * 0.3; // Very few comments
  } else if (ratio < 0.1) {
    score = 0.3 + ((ratio - 0.03) / 0.07) * 0.4; // Building up
  } else if (ratio <= 0.25) {
    score = 0.7 + ((ratio - 0.1) / 0.15) * 0.3; // Sweet spot
  } else if (ratio <= 0.4) {
    score = 1.0 - ((ratio - 0.25) / 0.15) * 0.2; // Slightly too many
  } else {
    score = 0.6; // Excessive comments, might indicate commented-out code
  }

  return {
    ratio: Math.round(ratio * 1000) / 1000,
    score: Math.round(score * 100) / 100,
  };
}

/**
 * Detect JSDoc blocks (JS/TS) and docstrings (Python).
 */
function analyzeDocstrings(files: SkillFile[]): {
  hasDocstrings: boolean;
  count: number;
  score: number;
} {
  let docstringCount = 0;
  let functionCount = 0;

  for (const file of files) {
    const lang = file.language.toLowerCase();
    const content = file.content;

    if (
      lang === "javascript" ||
      lang === "typescript" ||
      lang === "js" ||
      lang === "ts" ||
      lang === "jsx" ||
      lang === "tsx"
    ) {
      // Count JSDoc blocks: /** ... */
      const jsdocMatches = content.match(/\/\*\*[\s\S]*?\*\//g);
      docstringCount += jsdocMatches?.length ?? 0;

      // Count functions/methods/classes
      const funcMatches = content.match(
        /\b(?:function|class|const\s+\w+\s*=\s*(?:async\s+)?(?:\([^)]*\)|[a-zA-Z_]\w*)\s*=>|(?:async\s+)?(?:get|set|static)?\s*(?:[a-zA-Z_]\w*)\s*\([^)]*\)\s*[:{])/g,
      );
      functionCount += funcMatches?.length ?? 0;
    } else if (lang === "python" || lang === "py") {
      // Count Python docstrings (triple-quoted strings after def/class)
      const docstringMatches = content.match(
        /(?:def|class)\s+\w+[^:]*:\s*\n\s*(?:"""[\s\S]*?"""|'''[\s\S]*?''')/g,
      );
      docstringCount += docstringMatches?.length ?? 0;

      // Count functions/classes
      const funcMatches = content.match(/\b(?:def|class)\s+/g);
      functionCount += funcMatches?.length ?? 0;
    }
  }

  if (functionCount === 0) {
    // No functions found; if there are still docstrings, give some credit
    return {
      hasDocstrings: docstringCount > 0,
      count: docstringCount,
      score: docstringCount > 0 ? 0.5 : 0,
    };
  }

  const coverage = docstringCount / functionCount;
  // Score based on documentation coverage of functions
  let score: number;
  if (coverage >= 0.8) {
    score = 1.0;
  } else if (coverage >= 0.5) {
    score = 0.6 + ((coverage - 0.5) / 0.3) * 0.4;
  } else if (coverage >= 0.2) {
    score = 0.3 + ((coverage - 0.2) / 0.3) * 0.3;
  } else {
    score = (coverage / 0.2) * 0.3;
  }

  return {
    hasDocstrings: docstringCount > 0,
    count: docstringCount,
    score: Math.round(score * 100) / 100,
  };
}

/**
 * Calculate an overall documentation quality score for a skill.
 * Analyzes README presence/quality, inline comments ratio, and JSDoc/docstring coverage.
 * Returns a score between 0 and 1.
 */
export function scoreDocumentation(files: SkillFile[]): DocumentationResult {
  const readmeResult = scoreReadme(files);
  const commentResult = analyzeComments(files);
  const docstringResult = analyzeDocstrings(files);

  const weightedScore =
    readmeResult.score * WEIGHTS.readme +
    commentResult.score * WEIGHTS.comments +
    docstringResult.score * WEIGHTS.docstrings;

  return {
    score: Math.round(weightedScore * 100) / 100,
    hasReadme: readmeResult.hasReadme,
    readmeLength: readmeResult.readmeLength,
    readmeScore: Math.round(readmeResult.score * 100) / 100,
    commentRatio: commentResult.ratio,
    commentScore: commentResult.score,
    hasDocstrings: docstringResult.hasDocstrings,
    docstringCount: docstringResult.count,
    docstringScore: docstringResult.score,
  };
}
