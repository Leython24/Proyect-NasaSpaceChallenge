import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          // El ayudante CommonJS se comparte: si cae en el bloque de Leaflet,
          // obliga a descargar el mapa en el arranque.
          if (id.includes('commonjsHelpers')) return 'runtime'
          // React va en su propio bloque: de lo contrario Rollup lo arrastra al
          // bloque de react-leaflet y el mapa vuelve a cargarse en el arranque.
          if (/\/node_modules\/(react|react-dom|scheduler)\//.test(id)) return 'react'
          if (id.includes('/node_modules/three/')) return 'three'
          if (/\/node_modules\/(@?react-)?leaflet\//.test(id)) return 'leaflet'
        },
      },
    },
  },
})
