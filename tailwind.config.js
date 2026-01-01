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
          DEFAULT: '#5a8a6e',
          50: '#f2f7f4',
          100: '#dfeee5',
          200: '#bfddcb',
          300: '#9fccb1',
          400: '#7fbb97',
          500: '#5a8a6e',
          600: '#486f58',
          700: '#365442',
          800: '#24392c',
          900: '#121e16',
        },
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
