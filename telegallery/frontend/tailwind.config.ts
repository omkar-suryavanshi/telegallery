import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        accent: "var(--accent-color, #6366f1)",
        surface: {
          DEFAULT: "rgb(var(--surface) / <alpha-value>)",
        },
      },
      backdropBlur: {
        glass: "16px",
      },
      borderRadius: {
        xl2: "1.25rem",
      },
    },
  },
  plugins: [],
};

export default config;
