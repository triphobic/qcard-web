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
          DEFAULT: '#111184',
          50: '#e8e8f5',
          100: '#c5c5e6',
          200: '#9e9ed4',
          300: '#7777c2',
          400: '#5050b0',
          500: '#2929a0',
          600: '#111184',
          700: '#0e0e6a',
          800: '#0a0a50',
          900: '#060636',
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
