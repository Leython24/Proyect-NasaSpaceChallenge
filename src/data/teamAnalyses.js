// Análisis topográficos guardados para el equipo (Supabase).
//
// GeoPendiente (iframe) entrega el análisis por postMessage; aquí se valida
// todo lo que llega antes de enviarlo a la base, y se convierte en ambos
// sentidos entre el formato del analizador y las tablas en 3FN.

export const LAB_SOURCE = 'geo-pendiente-lab'
export const REACT_SOURCE = 'geoanalogos-react'

const DEM_SOURCES = { SRTM: 'srtm-v3-opentopodata', Copernicus: 'copernicus-glo90-open-meteo' }
const DEM_SOURCES_BACK = Object.fromEntries(Object.entries(DEM_SOURCES).map(([key, id]) => [id, key]))
export const REFERENCE_BY_MISSION = { marte: 'JEZ-01', luna: 'SHA-01' }
const METHODS = new Set(['horn-3x3'])
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const SECTOR = /^(SE|AN)-0[1-9]$/

export class AnalysisValidationError extends Error {}
const fail = (message) => {
  throw new AnalysisValidationError(message)
}

/** Solo acepta mensajes del iframe de GeoPendiente servido desde el mismo origen. */
export function isTrustedLabMessage(event, frameWindow, origin) {
  return Boolean(
    event &&
      frameWindow &&
      event.origin === origin &&
      event.source === frameWindow &&
      event.data &&
      typeof event.data === 'object' &&
      event.data.source === LAB_SOURCE &&
      typeof event.data.type === 'string',
  )
}

/** Número finito, o null si es null/undefined. Cualquier otra cosa es un error. */
function nullableNumber(value, label, { min = -Infinity, max = Infinity, maxExclusive = false } = {}) {
  if (value === null || value === undefined) return null
  if (typeof value !== 'number' || !Number.isFinite(value)) fail(`${label} no es un número válido.`)
  if (value < min || (maxExclusive ? value >= max : value > max)) fail(`${label} está fuera de rango.`)
  return value
}
function requiredNumber(value, label, range) {
  const number = nullableNumber(value, label, range)
  if (number === null) fail(`Falta ${label}.`)
  return number
}

/**
 * Valida el análisis que envía GeoPendiente. Distingue null (sin dato) de 0
 * (medición igual a cero) y rechaza tipos inesperados en lugar de corregirlos.
 */
export function parseLabAnalysis(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) fail('El analizador no envió un análisis.')
  if (typeof raw.id !== 'string' || !UUID.test(raw.id)) fail('El análisis no tiene un identificador válido.')
  if (typeof raw.localId !== 'string' || !raw.localId || raw.localId.length > 90) fail('El análisis no está en la biblioteca local.')
  const name = typeof raw.name === 'string' ? raw.name.trim().slice(0, 100) : ''
  if (!name) fail('El análisis no tiene nombre.')
  const lat = requiredNumber(raw.lat, 'la latitud', { min: -80, max: 84 })
  const lon = requiredNumber(raw.lon, 'la longitud', { min: -180, max: 180 })
  if (raw.sectorId != null && !(typeof raw.sectorId === 'string' && SECTOR.test(raw.sectorId))) fail('El sector no es válido.')
  if (!DEM_SOURCES[raw.source]) fail('La fuente DEM no es reconocida.')
  if (!METHODS.has(raw.method)) fail('El método de cálculo no es reconocido.')
  const rows = requiredNumber(raw.rows, 'el número de filas', { min: 3, max: 50 })
  const cols = requiredNumber(raw.cols, 'el número de columnas', { min: 3, max: 50 })
  if (!Number.isInteger(rows) || !Number.isInteger(cols)) fail('La cuadrícula debe tener filas y columnas enteras.')
  const spacing = requiredNumber(raw.spacing, 'el espaciado', { min: Number.MIN_VALUE, max: 100000 })
  if (!Array.isArray(raw.samples) || raw.samples.length !== rows * cols) fail(`La cuadrícula debe tener ${rows} × ${cols} muestras.`)
  const samples = raw.samples.map((value, index) => nullableNumber(value, `la muestra ${index + 1}`, { min: -12000, max: 9000 }))
  if (samples.every((value) => value === null)) fail('La cuadrícula no tiene ninguna elevación.')
  const m = raw.metrics && typeof raw.metrics === 'object' ? raw.metrics : fail('Faltan las métricas.')
  const metrics = {
    slopeLocalPct: nullableNumber(m.slopeLocalPct, 'la pendiente local', { min: 0 }),
    slopeMeanPct: nullableNumber(m.slopeMeanPct, 'la pendiente media', { min: 0 }),
    slopeMedianPct: nullableNumber(m.slopeMedianPct, 'la pendiente mediana', { min: 0 }),
    slopeMinPct: nullableNumber(m.slopeMinPct, 'la pendiente mínima', { min: 0 }),
    slopeMaxPct: nullableNumber(m.slopeMaxPct, 'la pendiente máxima', { min: 0 }),
    aspectDeg: nullableNumber(m.aspectDeg, 'la orientación', { min: 0, max: 360, maxExclusive: true }),
    windows: nullableNumber(m.windows, 'el número de ventanas', { min: 1, max: 2500 }),
  }
  if (metrics.slopeMinPct !== null && metrics.slopeMaxPct !== null && metrics.slopeMinPct > metrics.slopeMaxPct) {
    fail('La pendiente mínima supera a la máxima.')
  }
  const calculatedAt = typeof raw.calculatedAt === 'string' && !Number.isNaN(Date.parse(raw.calculatedAt)) ? raw.calculatedAt : null
  if (!calculatedAt) fail('Falta la fecha del cálculo.')
  return {
    id: raw.id.toLowerCase(), localId: raw.localId, name, lat, lon,
    sectorId: raw.sectorId ?? null, source: raw.source, method: raw.method,
    rows, cols, spacing, samples, metrics, calculatedAt,
  }
}

/** Argumentos de la función guardar_analisis (una sola transacción en la base). */
export function toRpcArgs(record, teamId, referenceIds = []) {
  if (typeof teamId !== 'string' || !UUID.test(teamId)) fail('Elige un equipo válido.')
  const m = record.metrics
  return {
    p_analisis: {
      id: record.id,
      equipo_id: teamId,
      sector_id: record.sectorId,
      nombre: record.name,
      latitud_deg: record.lat,
      longitud_deg: record.lon,
      fuente_dem_id: DEM_SOURCES[record.source],
      metodo_id: record.method,
      filas: record.rows,
      columnas: record.cols,
      espaciado_m: record.spacing,
      pendiente_local_pct: m.slopeLocalPct,
      pendiente_media_pct: m.slopeMeanPct,
      pendiente_mediana_pct: m.slopeMedianPct,
      pendiente_min_pct: m.slopeMinPct,
      pendiente_max_pct: m.slopeMaxPct,
      orientacion_deg: m.aspectDeg,
      ventanas_horn: m.windows,
      calculado_en: record.calculatedAt,
    },
    p_muestras: record.samples.map((elevacion_m, index) => ({
      fila: Math.floor(index / record.cols),
      columna: index % record.cols,
      elevacion_m,
    })),
    p_referencias: [...new Set(referenceIds.filter((id) => typeof id === 'string' && /^[A-Z]{3}-\d{2}$/.test(id)))],
  }
}

const toNumber = (value) => (value === null || value === undefined ? null : Number(value))

/** Convierte un análisis guardado (vista + muestras + comparaciones) al formato del analizador. */
export function fromCloud(row, samples, comparisons = []) {
  const rows = Number(row.filas)
  const cols = Number(row.columnas)
  const grid = new Array(rows * cols).fill(null)
  for (const sample of samples) {
    const index = Number(sample.fila) * cols + Number(sample.columna)
    if (index >= 0 && index < grid.length) grid[index] = toNumber(sample.elevacion_m)
  }
  return {
    id: row.id,
    name: row.nombre,
    lat: toNumber(row.latitud_deg),
    lon: toNumber(row.longitud_deg),
    sectorId: row.sector_id ?? null,
    source: DEM_SOURCES_BACK[row.fuente_dem_id] ?? null,
    method: row.metodo_id,
    rows,
    cols,
    spacing: toNumber(row.espaciado_m),
    samples: grid,
    metrics: {
      slopeLocalPct: toNumber(row.pendiente_local_pct),
      slopeMeanPct: toNumber(row.pendiente_media_pct),
      slopeMedianPct: toNumber(row.pendiente_mediana_pct),
      slopeMinPct: toNumber(row.pendiente_min_pct),
      slopeMaxPct: toNumber(row.pendiente_max_pct),
      aspectDeg: toNumber(row.orientacion_deg),
      windows: toNumber(row.ventanas_horn),
    },
    references: comparisons.map((comparison) => comparison.referencia_id),
    calculatedAt: row.calculado_en,
    authorId: row.autor_id,
  }
}

/** Mensaje comprensible para los errores de red, sesión o permisos. */
export function describeCloudError(error) {
  if (!error) return 'Error desconocido.'
  if (error instanceof AnalysisValidationError) return error.message
  const code = error.code ?? ''
  const message = String(error.message ?? error)
  if (/Failed to fetch|NetworkError|network|fetch failed|timed out/i.test(message)) {
    return 'No hay conexión con Supabase. El análisis sigue guardado en este navegador; reintenta cuando vuelva la conexión.'
  }
  if (code === '42501' || /row-level security|permission denied/i.test(message)) {
    return 'Tu cuenta no tiene permiso para guardar este análisis: debes pertenecer al equipo y ser el autor del registro.'
  }
  if (code === '28000' || code === 'PGRST301' || /JWT|session/i.test(message)) return 'Tu sesión expiró. Vuelve a iniciar sesión y reintenta.'
  if (code === 'PGRST202' || code === 'PGRST205' || code === '42883' || code === '42P01') {
    return 'La base todavía no tiene las tablas de equipos. Aplica la migración 202611150001_equipos_analisis.sql.'
  }
  if (code === '22023' || code === '23514' || code === '23503') return `La base rechazó los datos: ${message}`
  return `Supabase respondió: ${message}`
}

// ---------------------------------------------------------------------------
// Consultas (reciben el cliente para poder probarlas sin red).
// ---------------------------------------------------------------------------
export async function fetchMemberships(client, userId) {
  const { data, error } = await client
    .from('miembros_equipo')
    .select('equipo_id, rol, equipos(nombre)')
    .eq('usuario_id', userId)
  if (error) throw error
  return (data ?? [])
    .map((row) => ({ id: row.equipo_id, role: row.rol, name: row.equipos?.nombre ?? 'Equipo' }))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))
}

export async function saveTeamAnalysis(client, record, teamId, referenceIds) {
  const args = toRpcArgs(record, teamId, referenceIds)
  const { data, error } = await client.rpc('guardar_analisis', args)
  if (error) throw error
  return data
}

export async function listTeamAnalyses(client, teamId) {
  const { data, error } = await client
    .from('v_analisis_topograficos')
    .select('id, nombre, autor_id, sector_id, fuente_producto, espaciado_m, pendiente_media_pct, desnivel_m, cobertura_pct, actualizado_en')
    .eq('equipo_id', teamId)
    .order('actualizado_en', { ascending: false })
    .limit(50)
  if (error) throw error
  return data ?? []
}

export async function loadTeamAnalysis(client, id) {
  const [analysis, samples, comparisons] = await Promise.all([
    client.from('v_analisis_topograficos').select('*').eq('id', id).maybeSingle(),
    client.from('muestras_dem').select('fila, columna, elevacion_m').eq('analisis_id', id).order('fila').order('columna'),
    client.from('comparaciones_guardadas').select('referencia_id').eq('analisis_id', id),
  ])
  const failure = [analysis, samples, comparisons].find((response) => response.error)
  if (failure) throw failure.error
  if (!analysis.data) throw new AnalysisValidationError('El análisis no existe o tu cuenta no pertenece a su equipo.')
  return fromCloud(analysis.data, samples.data ?? [], comparisons.data ?? [])
}
