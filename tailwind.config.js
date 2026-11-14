export default {
  content: ['./index.html', './src/**/*.{jsx,js}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        display: ['Inter', 'sans-serif'],
      },
      colors: {
        space: {
          950: '#060b14',
          900: '#09111e',
          850: '#0b1322',
          800: '#0d1829',
          750: '#101d32',
          700: '#152540',
          600: '#1d3254',
        },
        mint: {
          300: '#99f6e4',
          400: '#5eead4',
          500: '#4fd1c5',
          600: '#2dd4bf',
        },
        slatex: {
          300: '#cbd5e1',
          400: '#8fa3bf',
          500: '#64748b',
        }
      }
    }
  }
}
