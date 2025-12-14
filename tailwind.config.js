/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx}",
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        hepta: ["Hepta Slab", "serif"],
        poppins: ["Poppins", "sans-serif"],
        ibarra: ["Ibarra Real Nova", "serif"],
      },
    },
  },
  plugins: [],
}