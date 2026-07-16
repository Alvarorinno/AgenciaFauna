/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        serif: ['Newsreader', 'serif'],
        sans: ['Inter', 'sans-serif']
      },
      colors: {
        // Sistema de marca Agencia Fauna: "Tinta / Papel / Latón / Burdeos"
        ink: '#12192b',
        ink2: '#2a3248',
        paper: '#f7f4ee',
        brass: '#c8a24a',
        burgundy: { DEFAULT: '#6d2632', hover: '#8a3140' },
        muted: '#5b5f6b',
        muted2: '#9aa0ad',
        border: '#dfd8c8',
        surface: '#efe9df',
        calc: '#f4f4f2',
        finance: {
          header: '#f4e6c1',
          cell: '#faf3e2',
          border: '#e8dcbd',
          text: '#8a6a1f'
        },
        success: { DEFAULT: '#1f7a4d', bg: '#e3ecdf' },
        neutralBadge: { DEFAULT: '#8a8f9c', bg: '#eceae4' },
        editIcon: { DEFAULT: '#2c4a7c', bg: '#e2e9f5' },
        deleteIcon: { DEFAULT: '#6d2632', bg: '#f6e4e6' }
      }
    }
  },
  plugins: []
};
