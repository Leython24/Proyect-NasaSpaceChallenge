// El acento («mint») se resuelve con variables CSS: cambia con el cuerpo activo
// (Tierra, Marte o Luna) sin reescribir las clases de cada componente.
const accent = (shade) => `rgb(var(--accent-${shade}) / <alpha-value>)`

export default {
  content: ['./index.html', './src/**/*.{jsx,js}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['"Space Grotesk"', 'Inter', 'system-ui', 'sans-serif'],
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
          200: accent(200),
          300: accent(300),
          400: accent(400),
          500: accent(500),
          600: accent(600),
        },
        slatex: {
          300: '#cbd5e1',
          400: '#94a8c4',
          500: '#71829b',
        },
      },
      transitionDuration: { 180: '180ms', 220: '220ms' },
    },
  },
}
