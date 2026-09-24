import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#faf8f6',
          100: '#f3ede8',
          200: '#e8ddd3',
          300: '#d4c2b0',
          400: '#bfa38a',
          500: '#a9876a',
          600: '#96724f',
          700: '#7d5d41',
          800: '#664d38',
          900: '#544030',
          950: '#2d2118',
        },
        accent: {
          50: '#fdf6f3',
          100: '#fce8e0',
          200: '#fad5c5',
          300: '#f5b89e',
          400: '#ed8e6a',
          500: '#e4703f',
          600: '#d5572a',
          700: '#b24422',
          800: '#8f3820',
          900: '#76311e',
          950: '#40160c',
        },
        rose: {
          50: '#fdf5f3',
          100: '#fce8e4',
          200: '#fad5cd',
          300: '#f5b8aa',
          400: '#ed8e7a',
          500: '#e06b52',
          600: '#cc523a',
          700: '#ab422e',
          800: '#8d3829',
          900: '#763328',
          950: '#401610',
        },
        cream: {
          50: '#fefdfb',
          100: '#fdf9f4',
          200: '#faf3ea',
          300: '#f5e8d8',
          400: '#eedcc4',
          500: '#e5ccaa',
          600: '#d4b28a',
          700: '#b8946a',
          800: '#967856',
          900: '#7a6348',
          950: '#413325',
        },
      },
      fontFamily: {
        serif: ['var(--font-playfair)', 'Georgia', 'serif'],
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
