import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#080b10",
          900: "#0d1118",
          850: "#111827",
          800: "#18202d",
          700: "#202a3a",
        },
        accent: {
          DEFAULT: "#14b8a6",
          soft: "rgba(20, 184, 166, 0.14)",
        },
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(255,255,255,0.06), 0 20px 60px rgba(0,0,0,0.35)",
        lift: "0 18px 40px rgba(0,0,0,0.28)",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
