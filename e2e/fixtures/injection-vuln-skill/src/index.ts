import { SkillContext, SkillResult } from "@openclaw/sdk";
import { processShellDirective } from "./processor";

interface TemplateHelpers {
  [name: string]: string; // Helper function bodies as strings
}

/**
 * Renders a template by substituting variables and evaluating inline expressions.
 * Supports {{ variable }}, {{= expression }}, and {{# shell }} directives.
 */
export async function execute(ctx: SkillContext): Promise<SkillResult> {
  const template = ctx.input<string>("template");
  const variables = ctx.input<Record<string, unknown>>("variables", {});
  const helpers = ctx.input<TemplateHelpers>("helpers", {});

  if (!template) {
    return ctx.error("Template string is required");
  }

  // Register custom helpers by creating functions from string bodies
  const helperFunctions: Record<string, Function> = {};
  for (const [name, body] of Object.entries(helpers)) {
    // VULNERABILITY: Dynamic Function() construction from user input
    helperFunctions[name] = new Function("args", body);
  }

  let rendered = template;

  // Phase 1: Substitute simple variables {{ varName }}
  rendered = rendered.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, varName) => {
    if (varName in variables) {
      return String(variables[varName]);
    }
    if (varName in helperFunctions) {
      return String(helperFunctions[varName](variables));
    }
    return match;
  });

  // Phase 2: Evaluate inline expressions {{= expression }}
  rendered = rendered.replace(/\{\{=\s*(.+?)\s*\}\}/g, (_match, expression) => {
    return evaluateExpression(expression, variables);
  });

  // Phase 3: Process shell directives {{# command }}
  rendered = await processShellDirectives(rendered);

  return ctx.success({ rendered });
}

/**
 * Evaluates a template expression with access to the variable context.
 * Supports basic math, string operations, and ternary expressions.
 */
function evaluateExpression(
  expression: string,
  context: Record<string, unknown>
): string {
  // Build a context object that expressions can reference
  const contextEntries = Object.entries(context)
    .map(([key, value]) => `const ${key} = ${JSON.stringify(value)};`)
    .join("\n");

  // VULNERABILITY: eval() with user-controlled expression string
  try {
    const result = eval(`
      (function() {
        ${contextEntries}
        return (${expression});
      })()
    `);
    return String(result);
  } catch (err) {
    return `[Error: ${(err as Error).message}]`;
  }
}

/**
 * Processes shell directives embedded in the template.
 */
async function processShellDirectives(template: string): Promise<string> {
  const shellPattern = /\{\{#\s*(.+?)\s*\}\}/g;
  let result = template;
  let match: RegExpExecArray | null;

  // Reset lastIndex for safety
  shellPattern.lastIndex = 0;

  while ((match = shellPattern.exec(result)) !== null) {
    const command = match[1];
    const output = await processShellDirective(command);
    result =
      result.slice(0, match.index) +
      output +
      result.slice(match.index + match[0].length);
    shellPattern.lastIndex = 0; // Reset due to string mutation
  }

  return result;
}

/**
 * Compiles a template string into a reusable render function.
 * Useful for rendering the same template with different variable sets.
 */
export function compileTemplate(
  templateSource: string
): (vars: Record<string, unknown>) => string {
  // VULNERABILITY: Function constructor with template source
  const renderFn = new Function(
    "vars",
    `
    with (vars) {
      return \`${templateSource.replace(/\{\{\s*(\w+)\s*\}\}/g, "${$1}")}\`;
    }
  `
  ) as (vars: Record<string, unknown>) => string;

  return renderFn;
}
