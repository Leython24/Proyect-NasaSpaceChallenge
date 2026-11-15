import terrainMeasurements from './terrainMeasurements.json' with { type: 'json' }

export const missions = {
  marte: {
    title: 'Marte', referenceLabel: 'Referencia en Marte', region: 'Sechura',
    department: 'Piura', ref: 'JEZ-01', defaultSector: 'SE-05',
    texture: 'mars', target: [18.4446, 77.4509], marker: 'Cráter Jezero', referenceImage: 'jezero',
    imageCredit: 'NASA / JPL-Caltech / Universidad de Arizona',
    imageAlt: 'Imagen orbital del sitio de aterrizaje de Perseverance en Jezero',
    trial: 'Evaluar la navegación de un rover al pasar de una planicie a una ladera.',
    limit: 'La comparación del relieve no mide el agarre de las ruedas ni reproduce la gravedad o la atmósfera de Marte.',
    center: [-5.65722, -80.6119],
  },
  luna: {
    title: 'Luna', referenceLabel: 'Referencia en la Luna', region: 'Andagua',
    department: 'Arequipa', ref: 'SHA-01', defaultSector: 'AN-05',
    texture: 'moon', target: [-89.766811452, -171.869897646], marker: 'Borde de Shackleton', referenceImage: 'shackleton',
    imageCredit: 'NASA / KARI / ASU',
    imageAlt: 'Vista de ShadowCam de la pared y el suelo del cráter Shackleton',
    trial: 'Evaluar el control de un rover al subir y bajar una ladera.',
    limit: 'La comparación del relieve no reproduce la gravedad, el vacío ni la iluminación del polo sur lunar.',
    center: [-15.42, -72.33],
  },
}

export const localSources = [
  { id: 'copernicus-glo90', institucion: 'ESA / Copernicus', producto: 'Copernicus GLO-90', url: 'https://doi.org/10.5270/ESA-c5d3d65', resolucion: '≈90 m nativos', uso: 'Elevación de las ventanas peruanas, agregada a una malla de 100 m' },
  { id: 'worldcover', institucion: 'ESA', producto: 'WorldCover 2021', url: 'https://esa-worldcover.org/en/data-access', resolucion: '10 m nativos', uso: 'Máscara de agua permanente para los sectores del Perú' },
  { id: 'ctx', institucion: 'NASA / USGS Astrogeology', producto: 'MRO CTX · Jezero', url: 'https://stac.astrogeology.usgs.gov/api/collections/mro_ctx_controlled_usgs_dtms/items/P02_001820_1984_XI_18N282W__P06_003442_1987_XI_18N282W', resolucion: '≈ 20 m/píxel', uso: 'Elevación de la referencia marciana' },
  { id: 'ctx-trn-jezero-20m', institucion: 'NASA / USGS Astrogeology', producto: 'Mars 2020 TRN CTX DTM · Jezero', url: 'https://astrogeology.usgs.gov/search/map/Mars/Mars2020/JEZ_ctx_B_soc_008_DTM_MOLAtopography_DeltaGeoid_20m_Eqc_latTs0_lon0', resolucion: '≈20 m nativos', uso: 'Elevación de la ventana JEZ-01, agregada a 100 m' },
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
  ...terrainMeasurements[mission.ref],
  id: mission.ref, mision,
  fuente_id: mision === 'marte' ? 'ctx-trn-jezero-20m' : 'lola',
}))

export function buildDemo(geojson) {
  return {
    sectores: geojson.features.map(({ properties, geometry }) => ({
      ...properties, ...terrainMeasurements[properties.id],
      geometria: geometry, referencia_id: missions[properties.mision].ref,
      fuente_id: 'copernicus-glo90', estado: 'medido', ensayo: missions[properties.mision].trial,
    })),
    referencias: localReferences,
    fuentes: localSources,
  }
}
