/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./app/**/*.{js,vue,ts}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Syne"', 'sans-serif'],
        body: ['"Lora"', 'Georgia', 'serif'],
      },
      colors: {
        surface: {
          DEFAULT: '#141210',
          raised: '#1e1c18',
          subtle: '#28251f',
        },
        ink: {
          DEFAULT: '#e8e2d6',
          muted: '#9c9585',
          faint: '#5c5649',
        },
        accent: {
          DEFAULT: '#d97706',
          light: '#f59e0b',
          dim: '#92400e',
        },
      },
    },
  },
  plugins: [],
}
