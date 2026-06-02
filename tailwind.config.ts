import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      screens: { xs: "480px" },
      colors: {
        // JR brand colors (navy from Sheets header)
        brand: {
          navy: "#1F4E78",
          cream: "#FFF2CC",
          light: "#E8F4FD",
        },
      },
    },
  },
  plugins: [],
};

export default config;
