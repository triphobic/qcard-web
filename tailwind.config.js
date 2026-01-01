/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Warm black dark mode palette
        'dark-bg': '#0d0d0d',
        'dark-card': '#161616',
        'dark-border': '#2a2a2a',
        // Elegant muted accents
        'accent-blue': {
          DEFAULT: '#070738',
          50: '#e6e6f0',
          100: '#c2c2db',
          200: '#9999c2',
          300: '#7070a9',
          400: '#474790',
          500: '#1e1e77',
          600: '#070738',
          700: '#05052a',
          800: '#03031c',
          900: '#02020e',
        },
        'accent-green': {
          DEFAULT: '#06402B',
          50: '#e6f2ed',
          100: '#c0ded2',
          200: '#8fc4ae',
          300: '#5eaa8a',
          400: '#2d9066',
          500: '#0a5c3d',
          600: '#06402B',
          700: '#053522',
          800: '#042a1b',
          900: '#021f14',
        },
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
