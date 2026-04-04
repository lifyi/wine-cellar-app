/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        wine: {
          50:  '#fdf2f4',
          100: '#fce7ea',
          200: '#f9d0d8',
          300: '#f4aab8',
          400: '#ec7590',
          500: '#e04e70',
          600: '#cc2d55',
          700: '#ac2047',
          800: '#901e42',
          900: '#7c1d3e',
          950: '#450a1f',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
