/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bread: {
          50: '#fff8f0',
          100: '#ffeedd',
          200: '#ffd9b0',
          300: '#ffc483',
          400: '#ffb056',
          500: '#ff9b29',
          600: '#e68820',
          700: '#b36a19',
          800: '#804c11',
          900: '#4d2e0a',
        },
      },
    },
  },
  plugins: [],
}
