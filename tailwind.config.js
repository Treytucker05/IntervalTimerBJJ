/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['"Chakra Petch"', 'monospace'],
      },
      colors: {
        vow: {
          black: '#121212',
          gray: '#1E1E1E',
          accent: '#E5E5E5',
        },
      },
    },
  },
  plugins: [],
};
