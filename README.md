# Órbita · Análogos Planetarios

Explorador 3D de GeoAnálogos Perú para el NASA International Space Apps Challenge. El recorrido es elegir un mundo, explorar una región y comparar sus características con candidatos del catálogo. Incluye 18 ventanas de 2 × 2 km en Sechura (Piura) y Andagua (Arequipa), asociadas respectivamente con Jezero y el borde de Shackleton como hipótesis de estudio.

## Ejecutar en Visual Studio Code

Requiere Node.js 20.19+ dentro de la versión 20, o Node.js 22.12 o posterior. Abre la carpeta raíz del repositorio.

```sh
npm ci
npm run dev
npm test
npm run build
```

Vite indica la dirección de desarrollo. Para probar el resultado de producción, ejecuta `npm run preview` después de la compilación.

## Recorrido de la aplicación

- **Sistema planetario.** Globos 3D de Luna, Marte y Tierra con selección de cuerpo celeste, zoom y escala visual.
- **Exploración.** Rotación, zoom, inclinación, búsqueda por nombres o coordenadas y fichas de regiones. Al consultar una coordenada terrestre, la ficha puede mostrar elevación de Copernicus DEM y temperatura del aire a 2 m de Open-Meteo. Para una comparación, el usuario selecciona una región del catálogo.
- **Capas.** Mosaicos ópticos y altimetría en color de Luna y Marte. Blue Marble, relieve sombreado y una captura VIIRS del 15 de junio de 2024 en Tierra. La opción Orbital NASA muestra la imagen de la región seleccionada. Las capas globales se sirven con la aplicación.
- **Relieve regional.** Jezero y Shackleton ofrecen mallas de elevación navegables derivadas de CTX y LOLA. La cuadrícula de visualización tiene 96 × 96 muestras y exageración vertical ×4. Se omiten las celdas sin cobertura. La malla es una vista de la zona cubierta por cada producto.
- **Comparación.** Tabla ordenable por índice general, geología, topografía, temperatura o ambiente. Los candidatos se pueden abrir en un globo 3D o en un mapa Leaflet. En Jezero y Shackleton, el filtro «Sectores del Perú» muestra los nueve polígonos de cada zona con sus métricas, ensayo, límites y fuentes.

## Implementación

React y Vite controlan la navegación y los componentes. Three.js dibuja las esferas con WebGL 2 cuando está disponible. La proyección en Canvas conserva la rotación, los marcadores y la selección de coordenadas en otros equipos. El relieve regional usa una malla de alturas proyectada en Canvas. Leaflet muestra los polígonos GeoJSON y los marcadores del mapa.

Los módulos de exploración y comparación están en `src/orbita/`. Los polígonos, las medidas y el cliente Supabase están en `src/data/`. Los mosaicos, imágenes, cuadrículas de visualización y sus créditos se encuentran en `public/assets/` y en esta documentación.

## Método y alcance de los resultados

El índice del catálogo mundial es exploratorio. Se aplica similitud coseno al perfil geológico (35 %), distancia con tolerancia de 45° y una coincidencia descriptiva de relieve para topografía (25 %), distancia con tolerancia de 210 °C entre puntos medios de rangos térmicos (20 %) y distancia normalizada entre índices descriptivos de aridez y hielo para ambiente (20 %). Los pesos y tolerancias son hipótesis del prototipo. Las cifras de contexto del catálogo requieren verificación por producto y área antes de usarlas como mediciones. Un criterio sin datos compatibles se muestra como «—» y el índice general requiere los cuatro criterios.

Para los sectores peruanos, QGIS o Python calculan las métricas antes de publicarlas. Comparen ventanas físicas equivalentes con escala común y documenten cobertura, resolución, umbral de pendiente suave, proyección y datum para cada cuerpo. Las métricas son pendiente mediana en grados, porcentaje de superficie con pendiente suave y desnivel P95 − P5 en metros. La columna Diferencia aplica resta absoluta, en puntos porcentuales para el área suave. Los valores aún sin medir se mantienen nulos y la web muestra «Pendiente de cálculo». Las condiciones de gravedad, atmósfera, iluminación y radiación forman parte de los límites del ensayo.

## Conectar Supabase

1. Aplica `supabase/migrations/202611140001_catalogo.sql` a una base nueva siguiendo el flujo de migraciones del equipo.
2. Crea `.env.local` a partir de `.env.example`. Añade `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY`. Reinicia Vite.
3. Carga `fuentes`, `referencias` y `sectores`, en ese orden. Guarda el objeto `geometry` de cada Feature como `geometria`. Las coordenadas son WGS 84 con orden [longitud, latitud]. Usa números o `null`.
4. Marca como publicados los registros listos para la web y sus dependencias. Las políticas exponen solo lectura de registros publicados. Conserva `service_role` fuera del cliente y del repositorio.

La app usa los registros publicados para actualizar el catálogo local por identificador. Si Supabase está sin configurar o la consulta falla, el catálogo local sigue disponible.

## Fuentes y créditos

- Mosaicos planetarios y altimetría en color del LRO WAC, LOLA, Viking MDIM 2.1 y MOLA. Capas globales ensambladas y convertidas a WebP a partir de teselas del nivel 2. [NASA Solar System Treks](https://trek.nasa.gov/)
- Capas de la Tierra y vistas regionales derivadas de Blue Marble, Blue Marble Shaded Relief y VIIRS, distribuidas como mosaicos del nivel 2. [NASA Earthdata GIBS](https://www.earthdata.nasa.gov/data/projects/gibs)
- Elevación de ventanas terrestres. Teselas s06w081 y s16w073. [NASA Earthdata · NASADEM_HGT v001](https://data.nasa.gov/dataset/nasadem-merged-dem-global-1-arc-second-v001)
- Relieve de Jezero y su producto controlado. [USGS · Modelo de elevación CTX de Jezero](https://stac.astrogeology.usgs.gov/api/collections/mro_ctx_controlled_usgs_dtms/items/P02_001820_1984_XI_18N282W__P06_003442_1987_XI_18N282W)
- Relieve del polo sur lunar, producto ajustado de 5 m/píxel para Site04. [NASA PGDA / LRO · LOLA Site04](https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/)
- Fotos de referencia de [Jezero](https://www.jpl.nasa.gov/images/pia24331-perseverances-landing-spot-in-jezero-crater/) (NASA/JPL-Caltech/Universidad de Arizona), [Shackleton](https://www.nasa.gov/solar-system/nasas-shadowcam-images-lunar-south-pole-region/) (NASA/KARI/ASU) y [Curiosity en Gale](https://commons.wikimedia.org/wiki/File:Curiosity_Self-Portrait_at_%27Big_Sky%27_Drilling_Site.jpg) (NASA/JPL-Caltech/MSSS).
- Texturas y vistas iniciales heredadas de Marte y Luna. [Solar System Scope · CC BY 4.0](https://www.solarsystemscope.com/textures/)
- Contexto meteorológico y elevación de coordenadas terrestres. [Open-Meteo](https://open-meteo.com/en/docs)

## Desplegar en Vercel

Importa el repositorio con el preset Vite. Usa `npm run build` y el directorio de salida `dist`. Configura la URL y la clave publicable de Supabase en el entorno de despliegue cuando la base esté lista.
