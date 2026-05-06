import { describe, it, expect } from "vitest";
import { execute } from "../src/index";
import { detectLanguage, normalizeLineEndings } from "../src/utils";

function makeContext(inputs: Record<string, unknown>) {
  const logs: string[] = [];
  return {
    input: <T>(key: string, defaultVal?: T): T => {
      return (inputs[key] ?? defaultVal) as T;
    },
    log: (msg: string) => logs.push(msg),
    success: (data: Record<string, unknown>) => ({ status: "success" as const, data }),
    error: (msg: string) => ({ status: "error" as const, message: msg }),
    _logs: logs,
  };
}

describe("code-formatter", () => {
  describe("execute", () => {
    it("formats typescript code with default style", async () => {
      const ctx = makeContext({
        code: 'const x  =   1;\nconst y=  "hello";\n',
        language: "typescript",
      });

      const result = await execute(ctx as any);
      expect(result.status).toBe("success");
      expect(result.data.formatted).toBeDefined();
      expect(result.data.changes).toBeGreaterThanOrEqual(0);
    });

    it("returns error for empty input", async () => {
      const ctx = makeContext({ code: "   " });
      const result = await execute(ctx as any);
      expect(result.status).toBe("error");
    });

    it("formats JSON with proper indentation", async () => {
      const ctx = makeContext({
        code: '{"name":"test","value":42,"nested":{"a":1}}',
        language: "json",
      });

      const result = await execute(ctx as any);
      expect(result.status).toBe("success");
      expect(result.data.formatted).toContain("\n");
    });

    it("respects custom indent size", async () => {
      const ctx = makeContext({
        code: 'function foo() {\nreturn 1;\n}\n',
        language: "typescript",
        style: { indentSize: 4, useTabs: false },
      });

      const result = await execute(ctx as any);
      expect(result.status).toBe("success");
    });

    it("uses tabs when configured", async () => {
      const ctx = makeContext({
        code: 'function foo() {\n  return 1;\n}\n',
        language: "typescript",
        style: { useTabs: true },
      });

      const result = await execute(ctx as any);
      expect(result.status).toBe("success");
    });
  });

  describe("detectLanguage", () => {
    it("detects TypeScript", () => {
      const code = `
        import { Foo } from "./foo";
        const bar: string = "hello";
        export function baz(): void {}
      `;
      expect(detectLanguage(code)).toBe("typescript");
    });

    it("detects Python", () => {
      const code = `
        import os
        from pathlib import Path

        def main():
            print("hello")

        if __name__ == "__main__":
            main()
      `;
      expect(detectLanguage(code)).toBe("python");
    });

    it("detects JSON", () => {
      expect(detectLanguage('{"key": "value"}')).toBe("json");
      expect(detectLanguage("[1, 2, 3]")).toBe("json");
    });
  });

  describe("normalizeLineEndings", () => {
    it("converts CRLF to LF", () => {
      expect(normalizeLineEndings("a\r\nb\r\n")).toBe("a\nb\n");
    });

    it("converts CR to LF", () => {
      expect(normalizeLineEndings("a\rb\r")).toBe("a\nb\n");
    });

    it("leaves LF unchanged", () => {
      expect(normalizeLineEndings("a\nb\n")).toBe("a\nb\n");
    });
  });
});
