import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        "brand-teal": "#00d2b4",
        "brand-dark": "#0d1117",
        "brand-secondary": "#161b22",
        "brand-card": "#1c2333",
        "brand-border": "#606770",
        "brand-text": "#e6edf3",
        "brand-muted": "#8b949e",
        "brand-red": "#f85149",
        "brand-green": "#3fb950",
        "brand-yellow": "#d29922",
        "brand-blue": "#58a6ff",
      },
    },
  },
  plugins: [],
} satisfies Config;
