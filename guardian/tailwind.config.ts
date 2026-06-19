import type { Config } from "tailwindcss";
import { chainsageTheme } from "./lib/tokens";

export default {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: chainsageTheme,
  },
  plugins: [],
} satisfies Config;
