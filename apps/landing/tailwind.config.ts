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
        "brand-border": "#30363d",
        "brand-text": "#e6edf3",
        "brand-muted": "#8b949e",
        "brand-red": "#f85149",
        "brand-green": "#3fb950",
        "brand-yellow": "#d29922",
        "brand-blue": "#58a6ff",
      },
      backgroundImage: {
        "dot-pattern": "radial-gradient(circle, #30363d 1px, transparent 1px)",
      },
      backgroundSize: {
        "dot-pattern": "30px 30px",
      },
      animation: {
        "fade-in": "fadeIn 0.6s ease-in-out",
        "slide-up": "slideUp 0.6s ease-out",
        glow: "glow 3s ease-in-out infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(30px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        glow: {
          "0%, 100%": { boxShadow: "0 0 20px rgba(0, 210, 180, 0.3)" },
          "50%": { boxShadow: "0 0 40px rgba(0, 210, 180, 0.6)" },
        },
      },
      fontSize: {
        hero: ["4rem", { lineHeight: "1.1", fontWeight: "700" }],
      },
    },
  },
  plugins: [],
} satisfies Config;
