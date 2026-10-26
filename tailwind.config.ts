import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primaryDark: '#2C2C2C',
        primary: '#C99B24',
        gold: '#BC9226',
        brightGold: '#D1AC3E',
        cream: '#FDF3E4',
        heading: '#291900',
        primaryText: '#645743',
        success: '#28A736',
        error: '#EF1F1F',
      },
      fontFamily: {
        heading: ['var(--font-heading)', 'Playfair Display', 'Merriweather', 'serif'],
        sans: ['var(--font-body)', 'Plus Jakarta Sans', 'Inter', 'sans-serif'],
      },
      boxShadow: {
        gold: '0 4px 20px -2px rgba(201, 155, 36, 0.25)',
        goldGlow: '0 0 15px rgba(209, 172, 62, 0.4)',
      },
    },
  },
  plugins: [],
};

export default config;
