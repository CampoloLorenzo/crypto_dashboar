import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Dark theme palette
        base: {
          900: "#0a0e17",
          800: "#0f1525",
          700: "#161d31",
          600: "#1e2740",
        },
        tier: {
          emerging: "#a855f7", // viola
          momentum: "#3b82f6", // blu
          stable: "#22c55e", // verde
          caution: "#f97316", // arancione
        },
        growth: "#22c55e",
        risk: "#ef4444",
      },
      fontFamily: {
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
