import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/app/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        nexus: {
          base: "#090d16",
          panel: "#111a27",
          teal: "#5eead4",
          violet: "#b49aff",
        },
      },
    },
  },
  plugins: [],
};

export default config;