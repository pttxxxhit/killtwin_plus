/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        darkBg: "#0a0c10",
        darkCard: "#12161f",
        darkHover: "#1a202c",
      }
    },
  },
  plugins: [],
}
