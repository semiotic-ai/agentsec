import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        "brand-darker": "#0a0d12",
        "brand-dark": "#0d1117",
        "brand-secondary": "#161b22",
        "brand-card": "#1c2333",
        "brand-card-hover": "#252d3a",
        "brand-border": "#30363d",
        "brand-border-strong": "#3d444d",
        "brand-text": "#e6edf3",
        "brand-muted": "#8b949e",
        "brand-dim": "#6e7681",
        "brand-teal": "#00d2b4",
        "brand-teal-dim": "#00a894",
        "brand-red": "#f85149",
        "brand-green": "#3fb950",
        "brand-yellow": "#d29922",
        "brand-orange": "#db6d28",
        "brand-blue": "#58a6ff",
        "brand-purple": "#bc8cff",
      },
      fontFamily: {
        sans: [
          "var(--font-geist)",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Helvetica",
          "Arial",
          "sans-serif",
        ],
        mono: ["var(--font-jetbrains-mono)", "SF Mono", "Cascadia Code", "Consolas", "monospace"],
      },
      boxShadow: {
        "brand-1": "0 1px 3px rgba(0,0,0,0.3), 0 1px 2px rgba(0,0,0,0.4)",
        "brand-2": "0 8px 24px rgba(0,0,0,0.4)",
        "brand-3": "0 24px 60px rgba(0,0,0,0.55)",
        "brand-teal": "0 0 0 1px rgba(0,210,180,0.25), 0 10px 40px -10px rgba(0,210,180,0.35)",
        "brand-teal-strong": "0 0 0 1px rgba(0,210,180,0.4), 0 16px 50px -10px rgba(0,210,180,0.5)",
      },
    },
  },
  plugins: [],
} satisfies Config;
