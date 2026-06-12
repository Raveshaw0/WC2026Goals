import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
      colors: {
        surface: "#101418",
        card: "#181f26",
        cardSoft: "#1f2832",
        edge: "#2a3540",
        accent: "#4ade80",
        accentDim: "#22c55e",
        live: "#f87171",
      },
    },
  },
  plugins: [],
};

export default config;
