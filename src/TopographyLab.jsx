import { useEffect, useMemo, useRef, useState } from 'react'
import { Crosshair, Download, FileUp, Globe2, LocateFixed, MapPinned, MountainSnow, RefreshCcw, ScanLine } from 'lucide-react'
import TerrainCanvas from './TerrainCanvas.jsx'
import { centerOfGeometry, exportGridCSV, GENTLE_LIMIT_DEG, getEarthTerrain, localCoordinate, parseTerrainCSV, planetaryXYZ, pretty, terrainStats, toUTM, validCoord } from './data/topography.js'

const INFO = {
  marte: {
    name: 'Marte', source: 'CTX · modelo de terreno de Jezero (NASA / USGS)',
    url: 'https://astrogeology.usgs.gov/search/map/mars_2020_terrain_relative_navigation_ctx_dtm_mosaic',
    warning: 'Marte: longitud este y latitud planetocéntrica. No usar UTM terrestre. Los datos CTX/HiRISE requieren reproyección y extracción previa.',
  },
  luna: {
    name: 'Luna', source: 'LOLA Site04 · borde de Shackleton (NASA GSFC)',
    url: 'https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/',
    warning: 'Luna: coordenadas planetocéntricas; Site04 se distribuye en proyección polar lunar, no en UTM. Convertir antes de importar.',
  },
}

function download(name, content, type = 'text/csv;charset=utf-8') {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob), anchor = document.createElement('a')
  anchor.href = url; anchor.download = name; document.body.append(anchor); anchor.click(); anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
function numberValue(text) { const s = String(text).trim(); return s ? Number(s.replace(',', '.')) : NaN }
function Field({ title, value, onChange, step = 'any' }) {
  return <label className="topo-field"><span>{title}</span><input type="number" step={step} value={value} onChange={(e) => onChange(e.target.value)} /></label>
}
function MiniMetric({ title, first, second, unit = '', differenceUnit = unit, compare, digits = 1 }) {
  return <tr><th scope="row">{title}</th><td>{pretty(first, digits)}{Number.isFinite(first) ? unit : ''}</td><td>{pretty(second, digits)}{Number.isFinite(second) ? unit : ''}</td><td>{compare && Number.isFinite(first) && Number.isFinite(second) ? pretty(Math.abs(first - second), digits) + differenceUnit : '—'}</td></tr>
}
function ProfilePlot({ earth, other, counterpart }) {
  if (!earth || !other) return <div className="topo-profile-empty"><ScanLine size={20} /><p>El perfil superpuesto se habilita cuando ambas zonas tienen un DEM numérico.</p></div>
  const W = 800, H = 215, pad = 28, count = 101
  const sample = (g, position) => {
    const n = g.count, mid = Math.floor(n / 2)
    const column = position * (n - 1), c = Math.min(n - 2, Math.floor(column)), t = column - c
    return g.points[mid * n + c].z * (1 - t) + g.points[mid * n + c + 1].z * t
  }
  const line = (g) => {
    const z = Array.from({ length: count }, (_, i) => sample(g, i / (count - 1)))
    const bottom = Math.min(...z)
    return z.map((v, i) => ({ x: pad + i * (W - 2 * pad) / (count - 1), z: v - bottom }))
  }
  const a = line(earth), b = line(other), ymax = Math.max(1, ...a.map((p) => p.z), ...b.map((p) => p.z))
  const path = (points) => points.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${(H - pad - p.z / ymax * (H - 2 * pad)).toFixed(1)}`).join(' ')
  return <div className="topo-profile"><div className="topo-profile-legend"><span><i className="profile-earth" /> Tierra</span><span><i className="profile-planet" /> {counterpart}</span></div><svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Perfil transversal este-oeste de la Tierra y ${counterpart}; cotas relativas al mínimo de cada perfil`}>
    {[0, .25, .5, .75, 1].map((t) => <g key={t}><line x1={pad} x2={W - pad} y1={H - pad - t * (H - 2 * pad)} y2={H - pad - t * (H - 2 * pad)} stroke="#9ac1d044" /><text x="2" y={H - pad - t * (H - 2 * pad) + 4} fill="#98b6c8" fontSize="12">{pretty(t * ymax, 0)}</text></g>)}
    <path d={path(a)} stroke="#75dbb6" strokeWidth="3" fill="none" /><path d={path(b)} stroke="#edaa83" strokeWidth="3" fill="none" />
    <text x={pad} y={H - 5} fill="#accbda" fontSize="12">Oeste</text><text x={W - pad} y={H - 5} fill="#accbda" fontSize="12" textAnchor="end">Este</text>
  </svg><p>Elevaciones relativas al punto mínimo de cada perfil. No se mezclan los datums verticales de planetas distintos.</p></div>
}

export default function TopographyLab({ missionKey, mission, sector, coordinates, reference, onClose }) {
  const terrestrialCenter = coordinates ?? centerOfGeometry(sector?.geometria) ?? { lat: mission.center[0], lon: mission.center[1] }
  const [earthLat, setEarthLat] = useState(String(terrestrialCenter.lat.toFixed(6)))
  const [earthLon, setEarthLon] = useState(String(terrestrialCenter.lon.toFixed(6)))
  const [planetLat, setPlanetLat] = useState(String(mission.target[0]))
  const [planetLon, setPlanetLon] = useState(String(mission.target[1]))
  const [sideMeters, setSideMeters] = useState('2000')
  const [earth, setEarth] = useState(null)
  const [other, setOther] = useState(null)
  const [fetching, setFetching] = useState(false)
  const [message, setMessage] = useState('')
  const [fileError, setFileError] = useState('')
  const abort = useRef(null)
  const earthFile = useRef(null), planetFile = useRef(null)
  const ground = terrainStats(earth), extraterrestrial = terrainStats(other)
  const otherName = INFO[missionKey].name
  const sizeOK = earth && other && ['width', 'height', 'spacingX', 'spacingY'].every(
    (key) => Math.abs(earth[key] - other[key]) <= Math.max(.01, earth[key] * .01),
  )
  const pnezd = useMemo(() => exportGridCSV(earth, 'pnezd'), [earth])
  const utm = toUTM(numberValue(earthLat), numberValue(earthLon))
  const planetCoords = planetaryXYZ(missionKey, numberValue(planetLat), numberValue(planetLon))
  const localPlanet = validCoord(numberValue(planetLat), numberValue(planetLon)) ? localCoordinate(missionKey, { lat: mission.target[0], lon: mission.target[1] }, { lat: numberValue(planetLat), lon: numberValue(planetLon) }) : null

  useEffect(() => {
    abort.current?.abort()
    setEarth(null); setOther(null)
    setEarthLat(String(terrestrialCenter.lat.toFixed(6)))
    setEarthLon(String(terrestrialCenter.lon.toFixed(6)))
    setPlanetLat(String(mission.target[0])); setPlanetLon(String(mission.target[1]))
    setMessage(''); setFileError(''); setFetching(false)
  }, [sector?.id, missionKey])
  useEffect(() => () => abort.current?.abort(), [])

  async function calculateEarth(e) {
    e.preventDefault()
    const lat = numberValue(earthLat), lon = numberValue(earthLon), span = Number(sideMeters)
    if (!validCoord(lat, lon) || !Number.isFinite(span) || span < 100 || span > 20000) { setMessage('Introduce coordenadas geográficas válidas y un lado de 100 a 20 000 m.'); return }
    abort.current?.abort()
    const request = new AbortController()
    abort.current = request
    setEarth(null); setMessage('Consultando 81 elevaciones de la zona terrestre…'); setFetching(true)
    try {
      const result = await getEarthTerrain(lat, lon, span, request.signal)
      if (request.signal.aborted) return
      setEarth(result); setMessage('DEM terrestre consultado: ' + result.source + ' (' + result.resolution + ').')
    } catch (error) { if (!request.signal.aborted) setMessage('No se pudieron obtener las elevaciones: ' + error.message + '. Comprueba Internet; también puedes cargar un CSV de un DEM.') }
    finally { if (!request.signal.aborted) setFetching(false) }
  }

  function editEarth(setValue, value) {
    abort.current?.abort()
    setFetching(false)
    setEarth(null)
    setMessage('')
    setValue(value)
  }

  function useSector() {
    abort.current?.abort(); setFetching(false); setEarth(null)
    setEarthLat(String(terrestrialCenter.lat.toFixed(6))); setEarthLon(String(terrestrialCenter.lon.toFixed(6))); setMessage('Centro de la zona del proyecto restaurado.')
  }
  function geolocate() {
    if (!navigator.geolocation) { setMessage('Este navegador no admite geolocalización.'); return }
    setMessage('Solicitando permiso para usar la ubicación del dispositivo…')
    navigator.geolocation.getCurrentPosition((position) => {
      abort.current?.abort(); setEarth(null); setFetching(false)
      setEarthLat(String(position.coords.latitude.toFixed(7))); setEarthLon(String(position.coords.longitude.toFixed(7)))
      setMessage('Ubicación recibida. Precisión estimada del GPS: ±' + pretty(position.coords.accuracy, 0) + ' m. Pulsa «Calcular superficie terrestre».')
    }, (error) => setMessage('No se obtuvo la ubicación: ' + (error.code === 1 ? 'permiso denegado o se requiere HTTPS/localhost.' : error.message)), { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 })
  }
  async function importFile(event, body) {
    const file = event.target.files?.[0]; if (!file) return
    try {
      const center = body === 'tierra' ? { lat: numberValue(earthLat), lon: numberValue(earthLon) } : { lat: numberValue(planetLat), lon: numberValue(planetLon) }
      if (!validCoord(center.lat, center.lon)) throw Error('Primero escribe las coordenadas del centro del DEM.')
      const text = await file.text()
      const grid = parseTerrainCSV(text, body, center, file.name)
      if (body === 'tierra') { abort.current?.abort(); setEarth(grid); setFetching(false) } else setOther(grid)
      setFileError(''); setMessage('Cuadrícula cargada de «' + file.name + '»: ' + grid.count * grid.count + ' valores numéricos. Procedencia por verificar con la documentación del DEM.')
    } catch (error) { setFileError('Archivo no válido: ' + error.message) }
    finally { event.target.value = '' }
  }

  return <section className="topo-lab" id="laboratorio-topografico" aria-label="Laboratorio topográfico comparativo">
    <div className="topo-head"><div><p className="eyebrow">NASA SPACE APPS · ANÁLISIS DE TERRENO</p><h2><MountainSnow size={24} /> Laboratorio topográfico comparativo</h2><p>Coordenadas, grilla del relieve, curvas de nivel, superficies 3D y métricas para dos regiones de la misma extensión.</p></div><button className="topo-dismiss" type="button" onClick={onClose}>Ocultar laboratorio ×</button></div>
    <div className="topo-coordinates">
      <form className="topo-control" onSubmit={calculateEarth}>
        <div className="topo-control-title"><Globe2 size={19} /><div><strong>Tierra · {sector?.nombre ?? mission.region}</strong><small>Coordenadas WGS84 (EPSG:4326)</small></div></div>
        <div className="topo-form-grid"><Field title="Latitud (°)" value={earthLat} onChange={(v) => editEarth(setEarthLat, v)} /><Field title="Longitud (°)" value={earthLon} onChange={(v) => editEarth(setEarthLon, v)} /></div>
        <div className="topo-buttons"><button type="button" className="topo-muted-button" onClick={useSector}><MapPinned size={14} /> Usar sector</button><button type="button" className="topo-muted-button" onClick={geolocate}><LocateFixed size={14} /> Mi GPS</button></div>
        <div className="topo-form-grid small-field"><Field title="Lado de ventana (m)" value={sideMeters} onChange={(v) => editEarth(setSideMeters, v)} step="100" /><div className="topo-meta"><strong>{utm ? `Zona UTM ${utm.zone}${utm.hemisphere} · EPSG:${utm.epsg}` : 'Zona UTM no disponible'}</strong><span>{utm ? `E ${pretty(utm.east, 2)} m · N ${pretty(utm.north, 2)} m` : 'Solo entre 80°S y 84°N'}</span></div></div>
        <button type="submit" className="topo-primary" disabled={fetching}><Crosshair size={16} /> {fetching ? 'Consultando elevaciones…' : 'Calcular superficie terrestre'}</button>
        <div className="topo-upload"><input ref={earthFile} type="file" accept=".csv,.txt,text/csv" aria-label="Importar DEM terrestre como CSV" onChange={(e) => importFile(e, 'tierra')} hidden /><button type="button" className="topo-muted-button" onClick={() => earthFile.current?.click()}><FileUp size={15} /> Importar CSV terrestre</button>{pnezd && <button type="button" className="topo-muted-button" onClick={() => download('Tierra_PNEZD.txt', pnezd, 'text/plain;charset=utf-8')}><Download size={15} /> PNEZD / Civil 3D</button>}</div>
        {earth && !pnezd && <p className="topo-source-caption">PNEZD requiere que todos los puntos estén dentro de una misma zona UTM y hemisferio.</p>}
      </form>
      <div className="topo-control planet-coordinates">
        <div className="topo-control-title"><MountainSnow size={19} /><div><strong>{otherName} · {reference?.nombre ?? mission.marker}</strong><small>Coordenadas planetarias independientes (°)</small></div></div>
        <div className="topo-form-grid"><Field title="Latitud planetaria (°)" value={planetLat} onChange={(v) => { setPlanetLat(v); setOther(null) }} /><Field title="Longitud este (°)" value={planetLon} onChange={(v) => { setPlanetLon(v); setOther(null) }} /></div>
        <div className="topo-meta topo-planet-xyz">{validCoord(numberValue(planetLat), numberValue(planetLon)) && planetCoords ? <><strong>XYZ planetocéntrico esférico, referencia del cuerpo</strong><span>X {pretty(planetCoords.x, 1)} m · Y {pretty(planetCoords.y, 1)} m · Z {pretty(planetCoords.z, 1)} m</span><span>Desplazamiento horizontal desde el punto de referencia: {pretty(localPlanet?.x, 1)} m E · {pretty(localPlanet?.y, 1)} m N</span></> : 'Introduce latitud/longitud válidas.'}</div>
        <p className="topo-source-caption">{INFO[missionKey].warning}</p>
        <div className="topo-upload"><input ref={planetFile} type="file" accept=".csv,.txt,text/csv" aria-label={'Importar DEM de ' + otherName} onChange={(e) => importFile(e, missionKey)} hidden /><button type="button" className="topo-primary" onClick={() => planetFile.current?.click()}><FileUp size={15} /> Importar DEM CSV de {otherName}</button></div>
        <div className="topo-buttons"><a href={INFO[missionKey].url} target="_blank" rel="noopener noreferrer">DEM recomendado: {INFO[missionKey].source} ↗</a>{other && <button type="button" className="topo-muted-button" onClick={() => download(`${otherName}_XYZ.csv`, exportGridCSV(other))}><Download size={15} /> XYZ local</button>}</div>
      </div>
    </div>
    {message && <p className="topo-alert" role="status">{message}</p>}{fileError && <p className="topo-alert is-error" role="alert">{fileError}</p>}
    <div className="topo-visuals"><article className="topo-visual-card"><h3><Globe2 size={18} /> Relieve de la Tierra</h3><p>{earth?.source ?? 'Pendiente: consultar o cargar DEM'}</p><TerrainCanvas grid={earth} name="Tierra" /></article><article className="topo-visual-card"><h3><MountainSnow size={18} /> Relieve de {otherName}</h3><p>{other?.source ?? 'Pendiente: importar DEM científico (no se simulan cotas)'}</p><TerrainCanvas grid={other} name={otherName} /></article></div>
    <div className="topo-summary"><div className="topo-summary-title"><h3>Comparación de características del terreno</h3><span>Ventanas equivalentes: {sizeOK ? 'sí' : 'aún no verificadas'}</span></div><div className="topo-table-scroll"><table><thead><tr><th>Métrica</th><th>Tierra</th><th>{otherName}</th><th>Diferencia absoluta</th></tr></thead><tbody>
      <MiniMetric title="Cota central" first={ground?.centerZ} second={extraterrestrial?.centerZ} unit=" m" compare={false} />
      <MiniMetric title="Pendiente mediana" first={ground?.pendiente_mediana_deg} second={extraterrestrial?.pendiente_mediana_deg} unit="°" compare={sizeOK} />
      <MiniMetric title={`Área suave (< ${GENTLE_LIMIT_DEG}°)`} first={ground?.area_suave_pct} second={extraterrestrial?.area_suave_pct} unit=" %" differenceUnit=" pp" compare={sizeOK} />
      <MiniMetric title="Desnivel P95 − P5" first={ground?.desnivel_m} second={extraterrestrial?.desnivel_m} unit=" m" compare={sizeOK} />
      <MiniMetric title="Pendiente máxima estimada" first={ground?.maxSlope} second={extraterrestrial?.maxSlope} unit="°" compare={sizeOK} />
    </tbody></table></div>
    {earth && other && !sizeOK && <p className="topo-alert">Para calcular diferencias, prepara los dos DEM con las mismas dimensiones físicas y la misma separación de puntos.</p>}
    <p className="topo-interpretation">Se comparan pendientes y desniveles, no altitudes absolutas entre cuerpos con datums distintos. Se utiliza una diferencia de porcentaje expresada en puntos porcentuales (pp). Las pendientes son estimaciones de la resolución de cada DEM.</p>
    <h3>Perfil topográfico este–oeste · comparación de formas</h3><ProfilePlot earth={sizeOK ? earth : null} other={sizeOK ? other : null} counterpart={otherName} />
    </div>
    <details className="topo-help"><summary>¿Cómo obtengo los datos verdaderos de Marte o la Luna para trazar curvas?</summary><p>Descarga el DEM georreferenciado de las fuentes oficiales indicadas arriba. En QGIS, recorta una ventana del tamaño seleccionado (por ejemplo 2 × 2 km), usa la proyección y el datum específicos del cuerpo, genera una malla regular y exporta un CSV con columnas <code>x,y,z</code>. Las coordenadas X e Y deben expresarse en metros locales relativos al centro de la ventana; Z es la elevación real del DEM en metros. También se admite <code>lat,lon,z</code> con coordenadas planetarias correctamente transformadas. Si cargas el CSV planetario, obtendrás curvas de nivel, relieve 3D y comparación con el DEM terrestre. La app no convierte automáticamente GeoTIFF ni verifica el origen del archivo cargado.</p><button type="button" className="topo-muted-button" onClick={() => download('Plantilla_DEM_planetario.csv', 'x,y,z\n', 'text/csv;charset=utf-8')}><Download size={14} /> Plantilla CSV (encabezados, sin alturas ficticias)</button></details>
    <p className="topo-footnote">Uso académico y exploratorio: sin DEM planetario no hay pendientes calculables del otro cuerpo. Para un estudio técnico se requiere comprobar resolución, incertidumbre, datum vertical, proyección, cobertura y calidad del DEM.</p>
  </section>
}
