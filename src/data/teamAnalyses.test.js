import test from 'node:test'
import assert from 'node:assert/strict'
import {
  AnalysisValidationError,
  describeCloudError,
  fromCloud,
  isTrustedLabMessage,
  parseLabAnalysis,
  saveTeamAnalysis,
  toRpcArgs,
} from './teamAnalyses.js'

const TEAM = '10000000-0000-4000-8000-000000000001'
const grid = Array.from({ length: 49 }, (_, index) => (index === 24 ? 0 : 10 + index))
const valid = () => ({
  id: '2f1c4a8e-9b7d-4c3e-8a1f-0d2e3c4b5a69',
  localId: 'usr-abc',
  name: 'Sechura · SE-05',
  lat: -5.65722,
  lon: -80.6119,
  sectorId: 'SE-05',
  source: 'Copernicus',
  method: 'horn-3x3',
  rows: 7,
  cols: 7,
  spacing: 90,
  samples: grid,
  metrics: { slopeLocalPct: 0, slopeMeanPct: 1.5, slopeMedianPct: 1.2, slopeMinPct: 0, slopeMaxPct: 3, aspectDeg: null, windows: 25 },
  calculatedAt: '2026-11-15T20:00:00.000Z',
})

test('acepta un análisis válido y conserva la diferencia entre 0 y sin dato', () => {
  const record = parseLabAnalysis(valid())
  assert.equal(record.metrics.slopeLocalPct, 0)
  assert.equal(record.metrics.aspectDeg, null)
  assert.equal(record.samples[24], 0)
})

test('rechaza datos mal formados en lugar de corregirlos', () => {
  const cases = [
    ['id inválido', { id: 'abc' }],
    ['texto en lugar de número', { lat: '-5.6' }],
    ['latitud fuera de UTM', { lat: 85 }],
    ['fuente desconocida', { source: 'Otra' }],
    ['método desconocido', { method: 'zevenbergen' }],
    ['cuadrícula incompleta', { samples: grid.slice(0, 48) }],
    ['muestra NaN', { samples: [...grid.slice(0, 48), Number.NaN] }],
    ['sector inventado', { sectorId: 'XX-01' }],
    ['pendiente negativa', { metrics: { ...valid().metrics, slopeMeanPct: -1 } }],
    ['orientación de 360°', { metrics: { ...valid().metrics, aspectDeg: 360 } }],
    ['sin fecha', { calculatedAt: 'ayer' }],
  ]
  for (const [label, patch] of cases) {
    assert.throws(() => parseLabAnalysis({ ...valid(), ...patch }), AnalysisValidationError, label)
  }
  assert.throws(() => parseLabAnalysis(null), AnalysisValidationError)
})

test('convierte al formato de guardar_analisis con filas y columnas', () => {
  const args = toRpcArgs(parseLabAnalysis(valid()), TEAM, ['JEZ-01', 'JEZ-01', 'mal'])
  assert.equal(args.p_analisis.fuente_dem_id, 'copernicus-glo90-open-meteo')
  assert.equal(args.p_analisis.pendiente_local_pct, 0)
  assert.equal(args.p_analisis.orientacion_deg, null)
  assert.equal(args.p_muestras.length, 49)
  assert.deepEqual(args.p_muestras[24], { fila: 3, columna: 3, elevacion_m: 0 })
  assert.deepEqual(args.p_muestras[48], { fila: 6, columna: 6, elevacion_m: 58 })
  assert.deepEqual(args.p_referencias, ['JEZ-01'])
  assert.throws(() => toRpcArgs(parseLabAnalysis(valid()), 'equipo'), AnalysisValidationError)
})

test('ida y vuelta con la base conserva cuadrícula, nulos y ceros', () => {
  const record = parseLabAnalysis({ ...valid(), samples: [null, ...grid.slice(1)] })
  const args = toRpcArgs(record, TEAM, ['JEZ-01'])
  // Simula lo que devuelve PostgREST: numeric como texto o número.
  const row = { ...args.p_analisis, autor_id: 'x', filas: 7, columnas: 7, latitud_deg: '-5.6572200', espaciado_m: '90' }
  const back = fromCloud(row, [...args.p_muestras].reverse(), [{ referencia_id: 'JEZ-01' }])
  assert.deepEqual(back.samples, record.samples)
  assert.equal(back.samples[0], null)
  assert.equal(back.metrics.slopeLocalPct, 0)
  assert.equal(back.metrics.aspectDeg, null)
  assert.equal(back.lat, -5.65722)
  assert.equal(back.source, 'Copernicus')
  assert.deepEqual(back.references, ['JEZ-01'])
})

test('reintentar envía el mismo identificador (sin duplicar)', async () => {
  const calls = []
  const client = { rpc: async (name, args) => (calls.push([name, args.p_analisis.id]), { data: args.p_analisis.id, error: null }) }
  const record = parseLabAnalysis(valid())
  await saveTeamAnalysis(client, record, TEAM, ['JEZ-01'])
  await saveTeamAnalysis(client, record, TEAM, ['JEZ-01'])
  assert.deepEqual(calls.map(([, id]) => id), [record.id, record.id])
  assert.equal(calls[0][0], 'guardar_analisis')
})

test('solo confía en mensajes del iframe del mismo origen', () => {
  const frame = {}
  const event = { origin: 'http://localhost:5173', source: frame, data: { source: 'geo-pendiente-lab', type: 'analysis' } }
  assert.equal(isTrustedLabMessage(event, frame, 'http://localhost:5173'), true)
  assert.equal(isTrustedLabMessage({ ...event, origin: 'https://evil.example' }, frame, 'http://localhost:5173'), false)
  assert.equal(isTrustedLabMessage({ ...event, source: {} }, frame, 'http://localhost:5173'), false)
  assert.equal(isTrustedLabMessage({ ...event, data: { source: 'otro', type: 'analysis' } }, frame, 'http://localhost:5173'), false)
  assert.equal(isTrustedLabMessage({ ...event, data: 'texto' }, frame, 'http://localhost:5173'), false)
})

test('explica los errores de red, permisos y migración pendiente', () => {
  assert.match(describeCloudError(new TypeError('Failed to fetch')), /sigue guardado en este navegador/)
  assert.match(describeCloudError({ code: '42501', message: 'new row violates row-level security policy' }), /pertenecer al equipo/)
  assert.match(describeCloudError({ code: 'PGRST202', message: 'Could not find the function' }), /migración/)
})
