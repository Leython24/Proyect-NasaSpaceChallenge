# GeoAnálogos Perú

Explorador estudiantil del NASA International Space Apps Challenge 2026. Permite seleccionar Marte o Luna, buscar sectores del Perú y consultar la comparación propuesta, el ensayo y sus fuentes.

La demo contiene 18 polígonos exploratorios de 2 × 2 km, nueve en Sechura y nueve en Andagua. Jezero y el borde de Shackleton son referencias de trabajo. Las métricas sin evidencia se muestran como «Pendiente de cálculo». Los globos y marcadores son ilustrativos.

## Ejecutar

Requiere Node.js 20.19+ dentro de la versión 20, o Node.js 22.12 o posterior.

```sh
npm ci
npm run dev
npm test
npm run build
```

Abre la dirección indicada por Vite. El globo usa Three.js con React Three Fiber si hay WebGL 2. En equipos sin WebGL 2, el globo puede girar y cambiar de escala en Canvas 2D. El mapa usa Leaflet con la cuadrícula GeoJSON.

## Conectar Supabase

1. Aplica `supabase/migrations/202611140001_catalogo.sql` a una base nueva, con el editor SQL de Supabase o el flujo de migraciones del equipo.
2. Crea `.env.local` a partir de `.env.example` y añade solo la URL del proyecto y la clave publicable. Reinicia Vite al cambiar esas variables.
3. Carga `fuentes`, luego `referencias`, luego `sectores`. En los GeoJSON de trabajo, convierte cada Feature en una fila guardando solo su objeto `geometry` como `geometria`. Las coordenadas terrestres son WGS 84, orden [longitud, latitud]. Usa valores numéricos o `null`.
4. Marca como publicados los registros listos para la web, incluidas sus referencias y fuentes. Las políticas de Supabase exponen solo lectura de registros publicados. Los secretos, incluyendo `service_role`, se guardan fuera de las variables VITE y del repositorio.

Sin variables, se abre la demo local. Con variables, la web consulta Supabase y presenta por separado los estados de carga, consulta fallida y catálogo vacío. Un error ofrece abrir la demo de forma explícita.

## Análisis y evidencia

QGIS o Python calculan las métricas antes de cargar la base. Comparen ventanas físicas equivalentes con una escala de análisis común y documenten cobertura, resolución, umbral de pendiente suave y proyección por cuerpo. Registren pendiente mediana en grados, superficie suave en porcentaje y desnivel P95 − P5 en metros. La columna Diferencia muestra la diferencia absoluta. El porcentaje se compara en puntos porcentuales. Conserven los resultados sin medir como nulos. La interpretación del ensayo requiere revisar la distribución del relieve y las condiciones que quedan fuera del análisis.

- Tierra: [NASA Earthdata · NASADEM_HGT v001](https://data.nasa.gov/dataset/nasadem-merged-dem-global-1-arc-second-v001). Teselas s06w081 y s16w073.
- Marte: [NASA / USGS · CTX de Jezero](https://stac.astrogeology.usgs.gov/api/collections/mro_ctx_controlled_usgs_dtms/items/P02_001820_1984_XI_18N282W__P06_003442_1987_XI_18N282W).
- Luna: [NASA PGDA / LRO · LOLA Site04](https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/).
- Mapa base: [NASA Earth Observatory · Blue Marble Next Generation](https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/) y contorno de [Natural Earth](https://www.naturalearthdata.com/).
- Texturas planetarias: [Solar System Scope](https://www.solarsystemscope.com/textures/), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Convertidas a WebP y reiluminadas en las vistas de respaldo.
- Imágenes: [Jezero](https://www.jpl.nasa.gov/images/pia24331-perseverances-landing-spot-in-jezero-crater/) de NASA/JPL-Caltech/Universidad de Arizona y [Shackleton](https://www.nasa.gov/solar-system/nasas-shadowcam-images-lunar-south-pole-region/) de NASA/KARI/ASU.

## Desplegar en Vercel

Importa el repositorio en Vercel con el preset Vite. El comando de compilación es `npm run build` y el directorio de salida es `dist`. Configura las variables publicables de Supabase en el entorno de despliegue cuando la base esté lista.
