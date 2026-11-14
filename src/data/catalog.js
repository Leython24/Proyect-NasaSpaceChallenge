export const missions = {
  marte: {
    title: 'Marte', referenceLabel: 'Referencia en Marte', region: 'Sechura',
    department: 'Piura', ref: 'JEZ-01', defaultSector: 'SE-05',
    texture: 'mars', target: [18.38, 77.58], marker: 'Cráter Jezero', referenceImage: 'jezero',
    imageCredit: 'NASA / JPL-Caltech / Universidad de Arizona',
    imageAlt: 'Imagen orbital del sitio de aterrizaje de Perseverance en Jezero',
    trial: 'Evaluar la navegación de un rover al pasar de una planicie a una ladera.',
    limit: 'La comparación del relieve no mide el agarre de las ruedas ni reproduce la gravedad o la atmósfera de Marte.',
    center: [-5.65722, -80.6119],
  },
  luna: {
    title: 'Luna', referenceLabel: 'Referencia en la Luna', region: 'Andagua',
    department: 'Arequipa', ref: 'SHA-01', defaultSector: 'AN-05',
    texture: 'moon', target: [-89.67, 129.78], marker: 'Borde de Shackleton', referenceImage: 'shackleton',
    imageCredit: 'NASA / KARI / ASU',
    imageAlt: 'Vista de ShadowCam de la pared y el suelo del cráter Shackleton',
    trial: 'Evaluar el control de un rover al subir y bajar una ladera.',
    limit: 'La comparación del relieve no reproduce la gravedad, el vacío ni la iluminación del polo sur lunar.',
    center: [-15.42, -72.33],
  },
}

export const localSources = [
  { id: 'nasadem', institucion: 'NASA Earthdata', producto: 'NASADEM_HGT v001', url: 'https://data.nasa.gov/dataset/nasadem-merged-dem-global-1-arc-second-v001', resolucion: '1 segundo de arco', uso: 'Modelo de elevación de las zonas peruanas', },
  { id: 'ctx', institucion: 'NASA / USGS Astrogeology', producto: 'MRO CTX · Jezero', url: 'https://stac.astrogeology.usgs.gov/api/collections/mro_ctx_controlled_usgs_dtms/items/P02_001820_1984_XI_18N282W__P06_003442_1987_XI_18N282W', resolucion: '≈ 20 m/píxel', uso: 'Elevación de la referencia marciana' },
  { id: 'lola', institucion: 'NASA PGDA / LRO', producto: 'LOLA · Site04 Shackleton rim', url: 'https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/', resolucion: '5 m/píxel', uso: 'Elevación de la referencia lunar' },
]

export const visualSources = [
  { id: 'map', institucion: 'NASA Earth Observatory', producto: 'Blue Marble Next Generation', url: 'https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/', uso: 'Mapa base terrestre' },
  { id: 'mars-texture', institucion: 'Solar System Scope · CC BY 4.0', producto: 'Textura de Marte', url: 'https://www.solarsystemscope.com/textures/', uso: 'Visualización 3D ilustrativa' },
  { id: 'moon-texture', institucion: 'Solar System Scope · CC BY 4.0', producto: 'Textura de la Luna', url: 'https://www.solarsystemscope.com/textures/', uso: 'Visualización 3D lunar' },
  { id: 'hi-rise', institucion: 'NASA / JPL-Caltech / Universidad de Arizona', producto: 'Imagen orbital de Jezero', url: 'https://www.jpl.nasa.gov/images/pia24331-perseverances-landing-spot-in-jezero-crater/', uso: 'Imagen de referencia de Marte' },
  { id: 'shadowcam', institucion: 'NASA / KARI / ASU', producto: 'Imagen de Shackleton', url: 'https://www.nasa.gov/solar-system/nasas-shadowcam-images-lunar-south-pole-region/', uso: 'Imagen de referencia lunar' },
]

export const localReferences = Object.entries(missions).map(([mision, mission]) => ({
  id: mission.ref, mision, nombre: mission.marker,
  fuente_id: mision === 'marte' ? 'ctx' : 'lola',
  pendiente_mediana_deg: null, area_suave_pct: null, desnivel_m: null,
}))

export function buildDemo(geojson) {
  return {
    sectores: geojson.features.map(({ properties, geometry }) => ({
      ...properties, geometria: geometry, referencia_id: missions[properties.mision].ref,
      fuente_id: 'nasadem', ensayo: missions[properties.mision].trial,
    })),
    referencias: localReferences,
    fuentes: localSources,
  }
}
