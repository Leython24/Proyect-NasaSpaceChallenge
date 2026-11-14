import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { buildDemo } from './catalog.js'
import { findSelection, formatDifference, formatMetric, sectorsForMission, webLink } from './presentation.js'

const geojson = JSON.parse(readFileSync(new URL('./sectores.geojson', import.meta.url)))
const demo = buildDemo(geojson)

test('both missions show their own nine sectors and references', () => {
  assert.equal(sectorsForMission(demo, 'marte').length, 9)
  assert.equal(sectorsForMission(demo, 'luna').length, 9)
  assert.deepEqual(sectorsForMission(demo, 'luna', 'an-05').map(({ referencia_id }) => referencia_id), ['SHA-01'])
})

test('search is accent-insensitive and selection falls back to a visible sector', () => {
  assert.equal(sectorsForMission(demo, 'marte', 'pÍura').length, 9)
  const filtered = sectorsForMission(demo, 'marte', 'SE-02')
  assert.equal(findSelection(filtered, 'SE-05', 'SE-05').id, 'SE-02')
  assert.equal(findSelection([], 'SE-05', 'SE-05'), null)
})

test('zero is a measurement and missing values remain pending', () => {
  assert.equal(formatMetric(0, '°'), '0°')
  assert.equal(formatMetric(null, '°'), 'Pendiente de cálculo')
  assert.equal(formatDifference(null, 2, ' m'), '—')
  assert.equal(formatDifference(10, 18, ' pp'), '8 pp')
  assert.ok(demo.sectores.every((sector) => sector.desnivel_m === null))
})

test('source links are restricted to web URLs', () => {
  assert.equal(webLink('javascript:alert(1)'), null)
  assert.equal(webLink('https://www.nasa.gov/'), 'https://www.nasa.gov/')
})
