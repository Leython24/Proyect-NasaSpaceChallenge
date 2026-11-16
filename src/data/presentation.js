const numberFormatter = new Intl.NumberFormat('es-PE', { maximumFractionDigits: 2 })

export const metrics = [
  { key: 'pendiente_mediana_deg', label: 'Pendiente mediana', unit: '°' },
  { key: 'area_suave_pct', label: 'Superficie con pendiente suave', unit: ' %', differenceUnit: ' pp' },
  { key: 'desnivel_m', label: 'Desnivel local (P95 − P5)', unit: ' m' },
]

export function formatMetric(value, unit) {
  return Number.isFinite(value) ? numberFormatter.format(value) + unit : 'Pendiente de cálculo'
}

export function formatDifference(a, b, unit) {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return '—'
  return formatMetric(Math.abs(a - b), unit)
}

/** Diferencia relativa |A − B| / max(|A|, |B|). Solo ordena la lectura de la ficha; no es un puntaje. */
export function relativeDifference(a, b) {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null
  const scale = Math.max(Math.abs(a), Math.abs(b))
  return scale === 0 ? 0 : Math.abs(a - b) / scale
}

function normalized(value) {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim()
}

export function sectorsForMission(dataset, mission, query = '') {
  const term = normalized(query)
  return dataset.sectores.filter((sector) => sector.mision === mission &&
    [sector.id, sector.nombre, sector.departamento].some((part) => normalized(part ?? '').includes(term)))
}

export function findSelection(sectors, selectedId, defaultId) {
  return sectors.find((sector) => sector.id === selectedId)
    ?? sectors.find((sector) => sector.id === defaultId)
    ?? sectors[0]
    ?? null
}

export function webLink(value) {
  try {
    const url = new URL(value)
    return ['https:', 'http:'].includes(url.protocol) ? url.href : null
  } catch {
    return null
  }
}
