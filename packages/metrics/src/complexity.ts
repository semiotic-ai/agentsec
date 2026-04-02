import type { SkillFile } from "@agent-audit/shared";

/**
 * Weights for different branch types.
 * Higher weights indicate constructs that contribute more to cognitive complexity.
 */
const BRANCH_WEIGHTS: Record<string, number> = {
  if: 1,
  else: 1,
  "else if": 1,
  elif: 1,        // Python
  switch: 1,
  case: 0.5,
  for: 2,
  while: 2,
  "do-while": 2,
  catch: 1,
  ternary: 0.5,
  "logical-and": 0.3,
  "logical-or": 0.3,
  "nullish-coalesce": 0.2,
  "optional-chain": 0.1,
  try: 0.5,
  finally: 0.5,
  "for-in": 1.5,
  "for-of": 1.5,
};

interface BranchCount {
  type: string;
  count: number;
  weight: number;
}

export interface ComplexityResult {
  /** Weighted complexity score */
  score: number;
  /** Raw count of branch points */
  rawBranchCount: number;
  /** Breakdown by branch type */
  branches: BranchCount[];
  /** Per-file complexity */
  fileComplexities: FileComplexity[];
}

export interface FileComplexity {
  path: string;
  language: string;
  score: number;
  branchCount: number;
  linesOfCode: number;
}

/**
 * Strip string literals and comments from source code to avoid false positives
 * when counting branches. Handles JS/TS and Python syntax.
 */
function stripStringsAndComments(source: string, language: string): string {
  if (language === "python") {
    // Remove triple-quoted strings first (both """ and ''')
    let result = source.replace(/"""[\s\S]*?"""/g, '""');
    result = result.replace(/'''[\s\S]*?'''/g, "''");
    // Remove single-line comments
    result = result.replace(/#[^\n]*/g, "");
    // Remove regular strings
    result = result.replace(/"(?:[^"\\]|\\.)*"/g, '""');
    result = result.replace(/'(?:[^'\\]|\\.)*'/g, "''");
    return result;
  }

  // JS/TS: remove block comments, line comments, template literals, strings
  let result = source.replace(/\/\*[\s\S]*?\*\//g, "");
  result = result.replace(/\/\/[^\n]*/g, "");
  result = result.replace(/`(?:[^`\\]|\\.)*`/g, '""');
  result = result.replace(/"(?:[^"\\]|\\.)*"/g, '""');
  result = result.replace(/'(?:[^'\\]|\\.)*'/g, "''");
  return result;
}

/**
 * Normalize language identifiers to a canonical form.
 */
function normalizeLanguage(language: string): "js" | "python" | "unknown" {
  const lang = language.toLowerCase();
  if (
    lang === "javascript" ||
    lang === "typescript" ||
    lang === "js" ||
    lang === "ts" ||
    lang === "jsx" ||
    lang === "tsx"
  ) {
    return "js";
  }
  if (lang === "python" || lang === "py") {
    return "python";
  }
  return "unknown";
}

/**
 * Count branches in JS/TS source code.
 */
function countJsBranches(clean: string): Map<string, number> {
  const counts = new Map<string, number>();

  // if statements (not inside else if which we count separately)
  const ifMatches = clean.match(/\bif\s*\(/g);
  counts.set("if", ifMatches?.length ?? 0);

  // else if
  const elseIfMatches = clean.match(/\belse\s+if\s*\(/g);
  counts.set("else if", elseIfMatches?.length ?? 0);

  // standalone else (not else if)
  const elseMatches = clean.match(/\belse\s*\{/g);
  counts.set("else", elseMatches?.length ?? 0);

  // Adjust 'if' count: subtract else-if occurrences since they were matched by both
  const rawIf = counts.get("if") ?? 0;
  const elseIfCount = counts.get("else if") ?? 0;
  // The `if` in `else if` is also matched by the if regex, so subtract
  counts.set("if", Math.max(0, rawIf - elseIfCount));

  // switch
  const switchMatches = clean.match(/\bswitch\s*\(/g);
  counts.set("switch", switchMatches?.length ?? 0);

  // case (in switch)
  const caseMatches = clean.match(/\bcase\s+/g);
  counts.set("case", caseMatches?.length ?? 0);

  // for loops
  const forMatches = clean.match(/\bfor\s*\(/g);
  counts.set("for", forMatches?.length ?? 0);

  // for...in
  const forInMatches = clean.match(/\bfor\s*\([^)]*\bin\b/g);
  counts.set("for-in", forInMatches?.length ?? 0);

  // for...of
  const forOfMatches = clean.match(/\bfor\s*\([^)]*\bof\b/g);
  counts.set("for-of", forOfMatches?.length ?? 0);

  // Adjust plain 'for' by subtracting for-in and for-of
  const rawFor = counts.get("for") ?? 0;
  const forInCount = counts.get("for-in") ?? 0;
  const forOfCount = counts.get("for-of") ?? 0;
  counts.set("for", Math.max(0, rawFor - forInCount - forOfCount));

  // while
  const whileMatches = clean.match(/\bwhile\s*\(/g);
  counts.set("while", whileMatches?.length ?? 0);

  // do...while (the do keyword followed by a block)
  const doWhileMatches = clean.match(/\bdo\s*\{/g);
  counts.set("do-while", doWhileMatches?.length ?? 0);

  // Adjust while: subtract do-while occurrences
  const rawWhile = counts.get("while") ?? 0;
  const doWhileCount = counts.get("do-while") ?? 0;
  counts.set("while", Math.max(0, rawWhile - doWhileCount));

  // try
  const tryMatches = clean.match(/\btry\s*\{/g);
  counts.set("try", tryMatches?.length ?? 0);

  // catch
  const catchMatches = clean.match(/\bcatch\s*[\({]/g);
  counts.set("catch", catchMatches?.length ?? 0);

  // finally
  const finallyMatches = clean.match(/\bfinally\s*\{/g);
  counts.set("finally", finallyMatches?.length ?? 0);

  // ternary operator (? not preceded by ?. or ??)
  const ternaryMatches = clean.match(/[^?]\?[^?.?]/g);
  counts.set("ternary", ternaryMatches?.length ?? 0);

  // logical AND
  const andMatches = clean.match(/&&/g);
  counts.set("logical-and", andMatches?.length ?? 0);

  // logical OR
  const orMatches = clean.match(/\|\|/g);
  counts.set("logical-or", orMatches?.length ?? 0);

  // nullish coalescing
  const nullishMatches = clean.match(/\?\?/g);
  counts.set("nullish-coalesce", nullishMatches?.length ?? 0);

  // optional chaining
  const optionalChainMatches = clean.match(/\?\./g);
  counts.set("optional-chain", optionalChainMatches?.length ?? 0);

  return counts;
}

/**
 * Count branches in Python source code.
 */
function countPythonBranches(clean: string): Map<string, number> {
  const counts = new Map<string, number>();

  // if
  const ifMatches = clean.match(/\bif\s+/g);
  counts.set("if", ifMatches?.length ?? 0);

  // elif
  const elifMatches = clean.match(/\belif\s+/g);
  counts.set("elif", elifMatches?.length ?? 0);

  // Adjust: elif also matches 'if' in some patterns
  const rawIf = counts.get("if") ?? 0;
  counts.set("if", Math.max(0, rawIf));

  // else
  const elseMatches = clean.match(/\belse\s*:/g);
  counts.set("else", elseMatches?.length ?? 0);

  // for
  const forMatches = clean.match(/\bfor\s+\w+\s+in\b/g);
  counts.set("for", forMatches?.length ?? 0);

  // while
  const whileMatches = clean.match(/\bwhile\s+/g);
  counts.set("while", whileMatches?.length ?? 0);

  // try
  const tryMatches = clean.match(/\btry\s*:/g);
  counts.set("try", tryMatches?.length ?? 0);

  // except (Python's catch)
  const exceptMatches = clean.match(/\bexcept\s*/g);
  counts.set("catch", exceptMatches?.length ?? 0);

  // finally
  const finallyMatches = clean.match(/\bfinally\s*:/g);
  counts.set("finally", finallyMatches?.length ?? 0);

  // ternary (x if cond else y) - match "if" within expressions
  // This is tricky; we approximate by counting inline if/else patterns
  const ternaryMatches = clean.match(/\S+\s+if\s+\S+\s+else\s+/g);
  counts.set("ternary", ternaryMatches?.length ?? 0);

  // logical and
  const andMatches = clean.match(/\band\b/g);
  counts.set("logical-and", andMatches?.length ?? 0);

  // logical or
  const orMatches = clean.match(/\bor\b/g);
  counts.set("logical-or", orMatches?.length ?? 0);

  return counts;
}

/**
 * Count non-blank, non-comment lines of code.
 */
function countLinesOfCode(source: string, language: string): number {
  const lines = source.split("\n");
  let count = 0;
  let inBlockComment = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === "") continue;

    if (language === "python") {
      if (trimmed.startsWith("#")) continue;
      count++;
    } else {
      // JS/TS
      if (inBlockComment) {
        if (trimmed.includes("*/")) {
          inBlockComment = false;
        }
        continue;
      }
      if (trimmed.startsWith("/*")) {
        if (!trimmed.includes("*/")) {
          inBlockComment = true;
        }
        continue;
      }
      if (trimmed.startsWith("//")) continue;
      count++;
    }
  }

  return count;
}

/**
 * Calculate cyclomatic complexity for a single file.
 */
function analyzeFileComplexity(file: SkillFile): FileComplexity {
  const lang = normalizeLanguage(file.language);
  if (lang === "unknown") {
    return {
      path: file.relativePath,
      language: file.language,
      score: 0,
      branchCount: 0,
      linesOfCode: countLinesOfCode(file.content, file.language),
    };
  }

  const clean = stripStringsAndComments(file.content, lang);
  const branchCounts = lang === "python" ? countPythonBranches(clean) : countJsBranches(clean);

  let totalScore = 0;
  let totalBranches = 0;

  for (const [type, count] of branchCounts) {
    if (count > 0) {
      const weight = BRANCH_WEIGHTS[type] ?? 1;
      totalScore += count * weight;
      totalBranches += count;
    }
  }

  return {
    path: file.relativePath,
    language: file.language,
    score: Math.round(totalScore * 100) / 100,
    branchCount: totalBranches,
    linesOfCode: countLinesOfCode(file.content, lang),
  };
}

/**
 * Calculate the aggregate cyclomatic complexity across all source files in a skill.
 * Returns a weighted complexity score that accounts for branch types.
 */
export function calculateComplexity(files: SkillFile[]): ComplexityResult {
  const sourceFiles = files.filter((f) => {
    const lang = normalizeLanguage(f.language);
    return lang !== "unknown";
  });

  if (sourceFiles.length === 0) {
    return {
      score: 0,
      rawBranchCount: 0,
      branches: [],
      fileComplexities: [],
    };
  }

  const fileComplexities = sourceFiles.map(analyzeFileComplexity);

  // Aggregate branch counts across all files
  const aggregateBranches = new Map<string, number>();

  for (const file of sourceFiles) {
    const lang = normalizeLanguage(file.language);
    const clean = stripStringsAndComments(file.content, lang);
    const counts = lang === "python" ? countPythonBranches(clean) : countJsBranches(clean);

    for (const [type, count] of counts) {
      aggregateBranches.set(type, (aggregateBranches.get(type) ?? 0) + count);
    }
  }

  const branches: BranchCount[] = [];
  let totalScore = 0;
  let totalBranches = 0;

  for (const [type, count] of aggregateBranches) {
    if (count > 0) {
      const weight = BRANCH_WEIGHTS[type] ?? 1;
      branches.push({ type, count, weight });
      totalScore += count * weight;
      totalBranches += count;
    }
  }

  // Sort branches by weighted contribution (descending)
  branches.sort((a, b) => b.count * b.weight - a.count * a.weight);

  return {
    score: Math.round(totalScore * 100) / 100,
    rawBranchCount: totalBranches,
    branches,
    fileComplexities,
  };
}

/**
 * Aggregate total lines of code across all source files.
 */
export function countTotalLinesOfCode(files: SkillFile[]): number {
  let total = 0;
  for (const file of files) {
    const lang = normalizeLanguage(file.language);
    total += countLinesOfCode(file.content, lang === "unknown" ? file.language : lang);
  }
  return total;
}
