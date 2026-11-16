/** Herramientas del laboratorio: las cifras solo salen de un DEM real o de un CSV del usuario. */
export const RAD = Math.PI / 180
export const BODY_RADIUS = { tierra: 6371008.8, marte: 3389500, luna: 1737400 }
export const EARTH_PROVIDER = 'Open Topo Data · SRTM 30 m'
export const GENTLE_LIMIT_DEG = 8
export const pretty = (value, digits = 1) => Number.isFinite(value)
  ? value.toLocaleString('es-PE', { maximumFractionDigits: digits, minimumFractionDigits: digits }) : '—'

export function wrapLongitude(lon) { return ((lon + 180) % 360 + 360) % 360 - 180 }
export function validCoord(lat, lon) { return Number.isFinite(lat) && Number.isFinite(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 360 }

export function centerOfGeometry(geometry) {
  const rings = geometry?.type === 'MultiPolygon' ? geometry.coordinates?.[0]?.[0] : geometry?.coordinates?.[0]
  if (!Array.isArray(rings) || !rings.length) return null
  const points = rings.length > 1 && rings[0][0] === rings[rings.length - 1][0] && rings[0][1] === rings[rings.length - 1][1] ? rings.slice(0, -1) : rings
  return { lat: points.reduce((s, p) => s + p[1], 0) / points.length, lon: points.reduce((s, p) => s + p[0], 0) / points.length }
}

/** Geodésica directa sobre la esfera del cuerpo; estable también cerca de los polos lunares. */
export function offsetCoordinate(body, lat, lon, east, north) {
  const distance = Math.hypot(east, north), radius = BODY_RADIUS[body]
  if (!radius) throw Error('Cuerpo celeste desconocido.')
  if (!distance) return { lat, lon: wrapLongitude(lon) }
  const bearing = Math.atan2(east, north), delta = distance / radius, phi = lat * RAD, lambda = lon * RAD
  const phi2 = Math.asin(Math.sin(phi) * Math.cos(delta) + Math.cos(phi) * Math.sin(delta) * Math.cos(bearing))
  const lambda2 = lambda + Math.atan2(Math.sin(bearing) * Math.sin(delta) * Math.cos(phi), Math.cos(delta) - Math.sin(phi) * Math.sin(phi2))
  return { lat: phi2 / RAD, lon: wrapLongitude(lambda2 / RAD) }
}

export function localCoordinate(body, origin, point) {
  const phi1 = origin.lat * RAD, phi2 = point.lat * RAD
  const dlon = wrapLongitude(point.lon - origin.lon) * RAD
  const dphi = phi2 - phi1
  const a = Math.sin(dphi / 2) ** 2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin(dlon / 2) ** 2
  const d = 2 * Math.atan2(Math.sqrt(Math.max(0, a)), Math.sqrt(Math.max(0, 1 - a)))
  const bearing = Math.atan2(Math.sin(dlon) * Math.cos(phi2), Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(dlon))
  return { x: BODY_RADIUS[body] * d * Math.sin(bearing), y: BODY_RADIUS[body] * d * Math.cos(bearing) }
}

/** Transformación UTM WGS84: únicamente corresponde a la Tierra. */
export function toUTM(lat, lon) {
  if (!validCoord(lat, lon) || lat < -80 || lat > 84) return null
  const longitude = wrapLongitude(lon), zone = Math.max(1, Math.min(60, Math.floor((longitude + 180) / 6) + 1))
  const a = 6378137, f = 1 / 298.257223563, e2 = f * (2 - f), ep2 = e2 / (1 - e2)
  const phi = lat * RAD, central = (zone * 6 - 183) * RAD, sin = Math.sin(phi), cos = Math.cos(phi), tan = Math.tan(phi)
  const N = a / Math.sqrt(1 - e2 * sin * sin), T = tan * tan, C = ep2 * cos * cos, A = cos * (longitude * RAD - central), k = .9996
  const M = a * ((1 - e2 / 4 - 3 * e2 ** 2 / 64 - 5 * e2 ** 3 / 256) * phi - (3 * e2 / 8 + 3 * e2 ** 2 / 32 + 45 * e2 ** 3 / 1024) * Math.sin(2 * phi) + (15 * e2 ** 2 / 256 + 45 * e2 ** 3 / 1024) * Math.sin(4 * phi) - (35 * e2 ** 3 / 3072) * Math.sin(6 * phi))
  const east = 500000 + k * N * (A + (1 - T + C) * A ** 3 / 6 + (5 - 18 * T + T ** 2 + 72 * C - 58 * ep2) * A ** 5 / 120)
  let north = k * (M + N * tan * (A ** 2 / 2 + (5 - T + 9 * C + 4 * C ** 2) * A ** 4 / 24 + (61 - 58 * T + T ** 2 + 600 * C - 330 * ep2) * A ** 6 / 720))
  if (lat < 0) north += 10000000
  return { zone, hemisphere: lat < 0 ? 'S' : 'N', east, north, epsg: (lat < 0 ? 32700 : 32600) + zone }
}

/** XYZ geocéntricas esféricas orientativas para Marte/Luna; no son elevación. */
export function planetaryXYZ(body, lat, lon) {
  if (!BODY_RADIUS[body]) return null
  const radius = BODY_RADIUS[body], phi = lat * RAD, lambda = lon * RAD
  return { x: radius * Math.cos(phi) * Math.cos(lambda), y: radius * Math.cos(phi) * Math.sin(lambda), z: radius * Math.sin(phi) }
}

export function createEmptyGrid(body, lat, lon, width = 2000, count = 9) {
  if (!validCoord(lat, lon)) throw Error('Coordenadas fuera de rango.')
  if (!(width >= 100 && width <= 20000)) throw Error('La ventana debe medir entre 100 m y 20 km.')
  const spacing = width / (count - 1)
  const points = Array.from({ length: count * count }, (_, k) => {
    const row = Math.floor(k / count), col = k % count
    const x = (col - (count - 1) / 2) * spacing, y = ((count - 1) / 2 - row) * spacing
    return { ...offsetCoordinate(body, lat, lon, x, y), x, y, z: null }
  })
  return { body, lat, lon, count, width, height: width, spacingX: spacing, spacingY: spacing, points }
}

async function fetchJson(url, signal) {
  const response = await fetch(url, { signal, cache: 'no-store' })
  if (!response.ok) throw Error('Servidor de elevación respondió HTTP ' + response.status)
  return response.json()
}

// Resultados completos por entrada (coordenadas + ventana). Solo se guardan
// consultas terminadas: una cancelada o fallida no contamina la caché.
const earthTerrainCache = new Map()
const EARTH_CACHE_LIMIT = 24
export function clearEarthTerrainCache() { earthTerrainCache.clear() }

export async function getEarthTerrain(lat, lon, width = 2000, signal) {
  const key = `${Number(lat).toFixed(7)},${Number(lon).toFixed(7)},${width}`
  if (earthTerrainCache.has(key)) return earthTerrainCache.get(key)
  const result = await queryEarthTerrain(lat, lon, width, signal)
  if (earthTerrainCache.size >= EARTH_CACHE_LIMIT) earthTerrainCache.delete(earthTerrainCache.keys().next().value)
  earthTerrainCache.set(key, result)
  return result
}

async function queryEarthTerrain(lat, lon, width, signal) {
  const grid = createEmptyGrid('tierra', lat, lon, width, 9)
  const locations = grid.points.map((p) => `${p.lat.toFixed(7)},${p.lon.toFixed(7)}`).join('|')
  let elevation, source, resolution
  try {
    const json = await fetchJson('https://api.opentopodata.org/v1/srtm30m?' + new URLSearchParams({ locations, interpolation: 'bilinear' }), signal)
    if (json.status !== 'OK' || !Array.isArray(json.results) || json.results.length !== grid.points.length || json.results.some((p) => p.elevation === null || !Number.isFinite(Number(p.elevation)))) throw Error('Datos incompletos')
    elevation = json.results.map((p) => Number(p.elevation)); source = 'SRTM 30 m · Open Topo Data'; resolution = '≈30 m'
  } catch (error) {
    if (signal?.aborted) throw error
    const params = new URLSearchParams({ latitude: grid.points.map((p) => p.lat.toFixed(7)).join(','), longitude: grid.points.map((p) => p.lon.toFixed(7)).join(',') })
    const json = await fetchJson('https://api.open-meteo.com/v1/elevation?' + params, signal)
    if (!Array.isArray(json.elevation) || json.elevation.length !== grid.points.length || json.elevation.some((z) => z === null || !Number.isFinite(Number(z)))) throw Error('No se encontraron alturas válidas en las dos fuentes terrestres.')
    elevation = json.elevation.map(Number); source = 'Copernicus GLO-90 · Open-Meteo'; resolution = '≈90 m'
  }
  return { ...grid, points: grid.points.map((p, i) => ({ ...p, z: elevation[i] })), source, resolution, kind: 'DEM consultado por Internet' }
}

function parseNumeric(s) { const n = Number(String(s ?? '').trim().replace(',', '.')); return Number.isFinite(n) && String(s ?? '').trim() !== '' ? n : null }
function splitRow(line, separator) { return line.split(separator).map((x) => x.replace(/^"|"$/g, '').trim()) }

/** CSV de muestras reales. Columnas x,y,z en metros o lat,lon,z en grados/m. No inventar píxeles ausentes. */
export function parseTerrainCSV(text, body, center, sourceName = 'DEM del equipo') {
  const rows = text.replace(/^\uFEFF/, '').split(/\r?\n/).map((x) => x.trim()).filter((x) => x && !x.startsWith('#'))
  if (rows.length < 10) throw Error('Se necesita una cuadrícula con al menos 3 × 3 puntos y encabezados.')
  const separator = rows[0].includes(';') ? ';' : rows[0].includes('\t') ? '\t' : ','
  const fields = splitRow(rows.shift(), separator).map((x) => x.toLowerCase().replace(/\s+/g, '_'))
  const find = (...keys) => fields.findIndex((x) => keys.includes(x))
  const xi = find('x', 'este', 'east', 'easting', 'x_m'), yi = find('y', 'norte', 'north', 'northing', 'y_m')
  const lati = find('lat', 'latitude', 'latitud'), loni = find('lon', 'lng', 'longitude', 'longitud')
  const zi = find('z', 'elevation', 'elevacion', 'altura', 'cota', 'height', 'elevation_m')
  if (zi < 0 || !((xi >= 0 && yi >= 0) || (lati >= 0 && loni >= 0))) throw Error('Encabezados esperados: x,y,z (metros locales) o lat,lon,z (grados y metros).')
  const raw = rows.map((line) => {
    const row = splitRow(line, separator), z = parseNumeric(row[zi])
    const coords = xi >= 0 && yi >= 0 ? { x: parseNumeric(row[xi]), y: parseNumeric(row[yi]) } : (() => {
      const lat = parseNumeric(row[lati]), lon = parseNumeric(row[loni])
      return lat === null || lon === null ? { x: null, y: null } : localCoordinate(body, center, { lat, lon })
    })()
    return { ...coords, z }
  })
  if (raw.some((p) => p.x === null || p.y === null || p.z === null || !Number.isFinite(p.x) || !Number.isFinite(p.y))) throw Error('Hay coordenadas o elevaciones vacías/no numéricas.')
  const xValues = [...new Set(raw.map((p) => Math.round(p.x * 1000) / 1000))].sort((a, b) => a - b)
  const yValues = [...new Set(raw.map((p) => Math.round(p.y * 1000) / 1000))].sort((a, b) => b - a)
  if (xValues.length < 3 || yValues.length < 3 || xValues.length > 121 || yValues.length > 121) throw Error('La cuadrícula necesita de 3 a 121 columnas y filas.')
  if (xValues.length !== yValues.length) throw Error('Por ahora el visor requiere una cuadrícula cuadrada (N × N).')
  if (xValues.length * yValues.length !== raw.length) throw Error('Faltan puntos o hay duplicados: se requiere la cuadrícula regular completa.')
  const avg = (arr) => arr.reduce((s, v) => s + v, 0) / arr.length
  const dxs = xValues.slice(1).map((x, i) => x - xValues[i]), dys = yValues.slice(1).map((y, i) => yValues[i] - y)
  const dx = avg(dxs), dy = avg(dys)
  if (Math.max(...dxs.map((v) => Math.abs(v - dx))) > Math.max(.01, dx * .02) || Math.max(...dys.map((v) => Math.abs(v - dy))) > Math.max(.01, dy * .02)) throw Error('Las muestras deben tener separación regular en X e Y (o exportarse así desde QGIS).')
  const lookup = new Map(raw.map((p) => [`${Math.round(p.x * 1000)},${Math.round(p.y * 1000)}`, p.z]))
  const points = []
  for (const y of yValues) for (const x of xValues) {
    const z = lookup.get(`${Math.round(x * 1000)},${Math.round(y * 1000)}`)
    if (!Number.isFinite(z)) throw Error('La cuadrícula contiene celdas faltantes o repetidas.')
    points.push({ x, y, z, ...offsetCoordinate(body, center.lat, center.lon, x, y) })
  }
  return { body, lat: center.lat, lon: center.lon, count: xValues.length, width: xValues.at(-1) - xValues[0], height: yValues[0] - yValues.at(-1), spacingX: dx, spacingY: dy, points, source: sourceName, resolution: `Separación ≈${pretty(Math.max(dx, dy), 1)} m`, kind: 'DEM importado por usuario (sin verificación independiente)' }
}

export function terrainStats(grid, gentleLimit = GENTLE_LIMIT_DEG) {
  if (!grid || grid.points.some((p) => !Number.isFinite(p.z))) return null
  const n = grid.count, dx = grid.spacingX, dy = grid.spacingY, z = (r, c) => grid.points[r * n + c].z
  const angles = [], grades = []
  for (let row = 1; row < n - 1; row++) for (let col = 1; col < n - 1; col++) {
    const gx = ((z(row - 1, col + 1) + 2 * z(row, col + 1) + z(row + 1, col + 1)) - (z(row - 1, col - 1) + 2 * z(row, col - 1) + z(row + 1, col - 1))) / (8 * dx)
    const gy = ((z(row - 1, col - 1) + 2 * z(row - 1, col) + z(row - 1, col + 1)) - (z(row + 1, col - 1) + 2 * z(row + 1, col) + z(row + 1, col + 1))) / (8 * dy)
    angles.push(Math.atan(Math.hypot(gx, gy)) / RAD)
    grades.push(Math.hypot(gx, gy) * 100)
  }
  const zs = grid.points.map((p) => p.z).sort((a, b) => a - b)
  const sorted = [...angles].sort((a, b) => a - b)
  const pct = (array, fraction) => { const offset = (array.length - 1) * fraction, lo = Math.floor(offset); return array[lo] + (array[Math.min(lo + 1, array.length - 1)] - array[lo]) * (offset - lo) }
  return {
    pendiente_mediana_deg: pct(sorted, .5), area_suave_pct: angles.filter((v) => v < gentleLimit).length / angles.length * 100,
    desnivel_m: pct(zs, .95) - pct(zs, .05), min: zs[0], max: zs.at(-1), mean: zs.reduce((a, b) => a + b, 0) / zs.length,
    centerZ: grid.points[Math.floor(n / 2) * n + Math.floor(n / 2)].z, maxSlope: Math.max(...angles), centerGradePct: grades[Math.floor(grades.length / 2)]
  }
}

export function interpolate(grid, u, v) {
  const n = grid.count, col = Math.max(0, Math.min(n - 1.00001, u * (n - 1))), row = Math.max(0, Math.min(n - 1.00001, v * (n - 1)))
  const c = Math.floor(col), r = Math.floor(row), tx = col - c, ty = row - r
  const z = (rr, cc) => grid.points[rr * n + cc].z
  return z(r, c) * (1 - tx) * (1 - ty) + z(r, c + 1) * tx * (1 - ty) + z(r + 1, c) * (1 - tx) * ty + z(r + 1, c + 1) * tx * ty
}

export function exportGridCSV(grid, mode = 'local') {
  if (!grid) return ''
  if (mode === 'pnezd' && grid.body === 'tierra') {
    const positions = grid.points.map(({ lat, lon }) => toUTM(lat, lon))
    const epsg = positions[0]?.epsg
    if (!epsg || positions.some((point) => point?.epsg !== epsg) || grid.points.some(({ z }) => !Number.isFinite(z))) return ''
    return positions.map(({ north, east }, i) =>
      `${i + 101},${north.toFixed(3)},${east.toFixed(3)},${grid.points[i].z.toFixed(3)},TIERRA_DEM`).join('\n')
  }
  return ['x,y,z,lat,lon', ...grid.points.map((p) => `${p.x.toFixed(3)},${p.y.toFixed(3)},${p.z.toFixed(3)},${p.lat.toFixed(7)},${p.lon.toFixed(7)}`)].join('\n')
}
