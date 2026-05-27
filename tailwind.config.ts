import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        graphite: "#20211f",
        paper: "#f4f1ea",
        amberline: "#d8a94d",
        fern: "#4c6f57"
      },
      fontFamily: {
        ui: ["Avenir Next", "Helvetica Neue", "Arial", "sans-serif"]
      }
    }
  },
  plugins: []
} satisfies Config;
