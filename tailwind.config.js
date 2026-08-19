/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./*.html",
    "./product/**/*.html",
    "./search/**/*.html",
    "./shop/**/*.html",
    "./js/**/*.js",
  ],
  theme: {
    extend: {
      colors: {
        "mystora-black": "#050505",
        "mystora-gold": "#D4AF37",
      },
      fontFamily: {
        brand: ['"Playfair Display"', "serif"],
        body: ['"Inter"', "sans-serif"],
      },
    },
  },
  plugins: [],
};
