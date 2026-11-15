import assert from 'node:assert/strict'
import test from 'node:test'
import {
  centerOfGeometry, createEmptyGrid, exportGridCSV, getEarthTerrain, localCoordinate,
  offsetCoordinate, parseTerrainCSV, planetaryXYZ, terrainStats, toUTM,
} from './topography.js'

test('sector center keeps original geographic coordinate order lon, lat', () => {
  const geometry = { type: 'Polygon', coordinates: [[[-78.5, -7], [-78.4, -7], [-78.4, -7.1], [-78.5, -7.1], [-78.5, -7]]] }
  const center = centerOfGeometry(geometry)
  assert.ok(Math.abs(center.lat + 7.05) < 1e-9)
  assert.ok(Math.abs(center.lon + 78.45) < 1e-9)
})

test('Peru WGS84 point is projected into expected UTM hemisphere and zone', () => {
  const utm = toUTM(-7.1638, -78.5003)
  assert.equal(utm.zone, 17)
  assert.equal(utm.hemisphere, 'S')
  assert.equal(utm.epsg, 32717)
  assert.ok(utm.east >= 100000 && utm.east <= 900000)
  assert.ok(utm.north >= 0 && utm.north <= 10000000)
})

test('Mars and Moon latitude and longitude are converted only with their own radius', () => {
  const nearSouthPole = offsetCoordinate('luna', -89.67, 129.78, 900, 900)
  assert.ok(Number.isFinite(nearSouthPole.lat) && Number.isFinite(nearSouthPole.lon))
  const back = localCoordinate('luna', { lat: -89.67, lon: 129.78 }, nearSouthPole)
  assert.ok(Math.abs(back.x - 900) < 2)
  assert.ok(Math.abs(back.y - 900) < 2)
  assert.ok(planetaryXYZ('marte', 0, 0).x > planetaryXYZ('luna', 0, 0).x)
})

test('flat real sample grid yields zero calculated gradient, full smooth surface and no invented heights', () => {
  const empty = createEmptyGrid('tierra', -5.6, -80.6)
  assert.ok(empty.points.every((p) => p.z === null))
  assert.equal(terrainStats(empty), null)
  const grid = { ...empty, points: empty.points.map((p) => ({ ...p, z: 420 })) }
  assert.equal(terrainStats(grid).pendiente_mediana_deg, 0)
  assert.equal(terrainStats(grid).area_suave_pct, 100)
  assert.equal(terrainStats(grid).desnivel_m, 0)
  assert.equal(exportGridCSV(grid, 'pnezd').split('\n').length, 81)
})

test('regular imported CSV has correct shape and slope for an inclined plane', () => {
  let lines = ['x,y,z']
  for (const y of [10, 0, -10]) for (const x of [-10, 0, 10]) lines.push([x, y, 150 + .1 * x].join(','))
  const grid = parseTerrainCSV(lines.join('\n'), 'marte', { lat: 18.38, lon: 77.58 }, 'test.csv')
  const m = terrainStats(grid)
  assert.equal(grid.count, 3)
  assert.ok(Math.abs(m.pendiente_mediana_deg - Math.atan(.1) * 180 / Math.PI) < .0001)
  assert.equal(m.area_suave_pct, 100)
  assert.ok(m.desnivel_m > 0)
  assert.throws(() => parseTerrainCSV('x,y,z\n0,0,10', 'luna', { lat: -89.67, lon: 129.78 }), /al menos/)
})

test('PNEZD cannot mix UTM zones or include points outside UTM', () => {
  for (const [lat, lon] of [[-5, -78], [85, 0]]) {
    const raw = createEmptyGrid('tierra', lat, lon)
    const grid = { ...raw, points: raw.points.map((point) => ({ ...point, z: 500 })) }
    assert.equal(exportGridCSV(grid, 'pnezd'), '')
  }
})

test('the network client accepts only real numeric DEM response values', async () => {
  const previous = globalThis.fetch
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ status: 'OK', results: Array.from({ length: 81 }, (_, i) => ({ elevation: i })) }) })
  try {
    const result = await getEarthTerrain(-7.1, -78.5, 2000)
    assert.equal(result.points.length, 81)
    assert.equal(result.points[0].z, 0)
    assert.equal(result.points.at(-1).z, 80)
  } finally { globalThis.fetch = previous }
})
