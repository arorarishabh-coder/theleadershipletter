import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        parchment: {
          DEFAULT: "#F4EFE6",
          deep: "#EBE3D2",
          light: "#FAF6EE",
          edge: "#D9D2C2",
        },
        ink: {
          DEFAULT: "#1A1A1F",
          faded: "#5E5A52",
          light: "#8A8378",
          mute: "#A8A296",
        },
        brick: {
          DEFAULT: "#8E2A1F",
          deep: "#6B1F17",
          dust: "#B5564A",
        },
        gold: {
          DEFAULT: "#A6803E",
          deep: "#7A5E2E",
        },
        rule: {
          DEFAULT: "#C9C1AE",
          strong: "#1A1A1F",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        serif: ["var(--font-serif)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      fontSize: {
        "display-1": ["clamp(3rem, 7vw, 5.25rem)", { lineHeight: "1.02", letterSpacing: "-0.02em" }],
        "display-2": ["clamp(2.25rem, 5vw, 3.5rem)", { lineHeight: "1.05", letterSpacing: "-0.015em" }],
        "display-3": ["clamp(1.75rem, 3.5vw, 2.5rem)", { lineHeight: "1.1", letterSpacing: "-0.01em" }],
        "pull-quote": ["clamp(1.75rem, 3vw, 2.5rem)", { lineHeight: "1.2", letterSpacing: "-0.005em" }],
        "read": ["1.1875rem", { lineHeight: "1.75" }],
        "dateline": ["0.7rem", { lineHeight: "1.2", letterSpacing: "0.16em" }],
      },
      letterSpacing: {
        "dateline": "0.16em",
        "headline-tight": "-0.02em",
      },
      maxWidth: {
        "measure": "68ch",
        "measure-wide": "78ch",
      },
      boxShadow: {
        "document": "0 24px 60px -20px rgba(26, 26, 31, 0.45), 0 8px 24px -12px rgba(26, 26, 31, 0.3)",
        "frame": "0 12px 32px -8px rgba(26, 26, 31, 0.25)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "underline-grow": {
          "0%": { transform: "scaleX(0)" },
          "100%": { transform: "scaleX(1)" },
        },
        "lightbox-in": {
          "0%": { opacity: "0", transform: "scale(0.96)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.6s ease-out both",
        "fade-in": "fade-in 0.4s ease-out both",
        "underline-grow": "underline-grow 0.4s ease-out forwards",
        "lightbox-in": "lightbox-in 0.25s ease-out both",
      },
    },
  },
  plugins: [],
};

export default config;
