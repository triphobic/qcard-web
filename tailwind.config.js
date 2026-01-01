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
          DEFAULT: '#4a6fa5',
          50: '#f0f4f8',
          100: '#d9e2ed',
          200: '#b3c5db',
          300: '#8da8c9',
          400: '#678bb7',
          500: '#4a6fa5',
          600: '#3b5a87',
          700: '#2d4569',
          800: '#1e304b',
          900: '#101b2d',
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
