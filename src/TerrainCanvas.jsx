import { useEffect, useRef, useState } from 'react'
import { interpolate, pretty, terrainStats } from './data/topography.js'

const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
const lerp = (a, b, t) => a + (b - a) * t
function terrainColor(t, body, shade = 0) {
  const palette = body === 'marte'
    ? [[67, 43, 45], [132, 67, 57], [193, 109, 72], [223, 159, 98], [253, 217, 151]]
    : body === 'luna' ? [[31, 48, 66], [68, 89, 110], [117, 146, 162], [177, 192, 201], [241, 246, 244]]
      : [[19, 66, 85], [30, 113, 109], [105, 165, 122], [201, 181, 108], [238, 209, 153]]
  const p = clamp(t, 0, 1) * (palette.length - 1), lo = Math.floor(p), hi = Math.min(lo + 1, palette.length - 1)
  const blend = p - lo
  const rgb = palette[lo].map((v, i) => clamp(Math.round(lerp(v, palette[hi][i], blend) + shade), 0, 255))
  return `rgb(${rgb.join(',')})`
}

function contourSegments(sampler, divisions, min, max, levels) {
  const dz = (max - min) / levels
  if (dz < .001) return []
  const output = []
  const z = Array.from({ length: divisions + 1 }, (_, row) => Array.from({ length: divisions + 1 }, (_, col) => sampler(col / divisions, row / divisions)))
  for (let level = 1; level < levels; level++) {
    const height = min + level * dz
    for (let row = 0; row < divisions; row++) for (let col = 0; col < divisions; col++) {
      const v = [z[row][col], z[row][col + 1], z[row + 1][col + 1], z[row + 1][col]]
      const xy = [[col, row], [col + 1, row], [col + 1, row + 1], [col, row + 1]]
      const crosses = []
      for (let k = 0; k < 4; k++) {
        const next = (k + 1) % 4
        if ((v[k] < height) !== (v[next] < height)) {
          const t = (height - v[k]) / (v[next] - v[k])
          crosses.push({ u: lerp(xy[k][0], xy[next][0], t) / divisions, v: lerp(xy[k][1], xy[next][1], t) / divisions, z: height })
        }
      }
      if (crosses.length >= 2) {
        output.push({ a: crosses[0], b: crosses[1], level })
        if (crosses.length === 4) output.push({ a: crosses[2], b: crosses[3], level })
      }
    }
  }
  return output
}

export default function TerrainCanvas({ grid, name }) {
  const canvas = useRef(null)
  const drag = useRef(null)
  const [mode, setMode] = useState('3d')
  const [azimuth, setAzimuth] = useState(-.7)
  const [zoom, setZoom] = useState(1)
  const [vertical, setVertical] = useState(2)
  const [showGrid, setShowGrid] = useState(true)
  const [showContours, setShowContours] = useState(true)
  const [hover, setHover] = useState(null)
  const stats = terrainStats(grid)

  useEffect(() => {
    const node = canvas.current
    if (!node || !grid || !stats) return
    const rect = node.getBoundingClientRect(), W = Math.max(270, rect.width), H = Math.max(240, rect.height), dpr = Math.min(2, window.devicePixelRatio || 1)
    node.width = Math.round(W * dpr); node.height = Math.round(H * dpr)
    const ctx = node.getContext('2d')
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    const bg = ctx.createLinearGradient(0, 0, W, H); bg.addColorStop(0, '#0c2336'); bg.addColorStop(1, '#09101e')
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H)
    const pad = 34, min = stats.min, max = stats.max, range = Math.max(1, max - min)
    const sampler = (u, v) => interpolate(grid, u, v)
    const segments = showContours ? contourSegments(sampler, 32, min, max, 11) : []
    let project
    if (mode === '2d') {
      const side = Math.min(W - 66, H - 68) * zoom
      const ox = W / 2 - side / 2, oy = H / 2 - side / 2
      project = (p) => ({ x: ox + side * p.u, y: oy + side * p.v })
      const divisions = 50
      for (let row = 0; row < divisions; row++) for (let col = 0; col < divisions; col++) {
        const u = col / divisions, v = row / divisions, z = sampler((col + .5) / divisions, (row + .5) / divisions)
        ctx.fillStyle = terrainColor((z - min) / range, grid.body)
        ctx.fillRect(ox + side * u, oy + side * v, side / divisions + .8, side / divisions + .8)
      }
      if (showGrid) {
        ctx.lineWidth = .6; ctx.strokeStyle = '#e2faff66'
        for (let j = 0; j <= 8; j++) {
          const q = j / 8, a = project({ u: q, v: 0 }), b = project({ u: q, v: 1 }), c = project({ u: 0, v: q }), d = project({ u: 1, v: q })
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.moveTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.stroke()
        }
      }
      ctx.strokeStyle = '#afecff'; ctx.lineWidth = 1.1; ctx.strokeRect(ox, oy, side, side)
      ctx.fillStyle = '#b7d6e4'; ctx.font = '11px system-ui'; ctx.textAlign = 'center'
      ctx.fillText(`${pretty(grid.width / 1000, 2)} km E–O`, W / 2, Math.min(H - 11, oy + side + 19))
    } else {
      const size = Math.min(W / 2.55, H / 2.3) * zoom
      const cos = Math.cos(azimuth), sin = Math.sin(azimuth)
      const relief = Math.min(size * .58, size * .8 * vertical * Math.min(1, range / Math.max(20, grid.width * .08)))
      project = (p) => {
        const x = (p.u - .5) * 2, y = (.5 - p.v) * 2
        const lateral = x * cos + y * sin, depth = -x * sin + y * cos
        return { x: W / 2 + lateral * size, y: H * .60 + depth * size * .39 - (p.z - min) / range * relief, depth }
      }
      const divisions = 34, faces = []
      for (let row = 0; row < divisions; row++) for (let col = 0; col < divisions; col++) {
        const u = col / divisions, v = row / divisions, step = 1 / divisions
        const centerZ = sampler(u + step / 2, v + step / 2)
        const A = { u, v, z: sampler(u, v) }, B = { u: u + step, v, z: sampler(u + step, v) }, C = { u: u + step, v: v + step, z: sampler(u + step, v + step) }, D = { u, v: v + step, z: sampler(u, v + step) }
        const projected = [A, B, C, D].map(project)
        const brightness = ((B.z - A.z) - (D.z - A.z)) / Math.max(1, grid.spacingX) * 4
        faces.push({ depth: projected.reduce((s, p) => s + p.depth, 0) / 4, pts: projected, fill: terrainColor((centerZ - min) / range, grid.body, clamp(brightness * 10, -19, 19)) })
      }
      faces.sort((a, b) => b.depth - a.depth)
      for (const face of faces) {
        ctx.fillStyle = face.fill; ctx.beginPath(); ctx.moveTo(face.pts[0].x, face.pts[0].y)
        for (let k = 1; k < 4; k++) ctx.lineTo(face.pts[k].x, face.pts[k].y)
        ctx.closePath(); ctx.fill()
      }
      if (showGrid) {
        ctx.lineWidth = .7; ctx.strokeStyle = '#d5ecff91'
        for (let j = 0; j <= 8; j++) for (const direction of [0, 1]) {
          ctx.beginPath()
          for (let k = 0; k <= 80; k++) {
            const u = direction ? k / 80 : j / 8, v = direction ? j / 8 : k / 80
            const p = project({ u, v, z: sampler(u, v) }); if (!k) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y)
          }
          ctx.stroke()
        }
      }
    }
    if (showContours && max - min > .01) {
      ctx.strokeStyle = mode === '2d' ? '#e9faf9c9' : '#f8fbe7bd'; ctx.lineWidth = mode === '2d' ? 1.1 : .85
      ctx.beginPath()
      for (const segment of segments) {
        const a = project(segment.a), b = project(segment.b)
        ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y)
      }
      ctx.stroke()
    }
    ctx.font = '700 11px system-ui'; ctx.textAlign = 'left'; ctx.fillStyle = '#e8f8ff'
    ctx.fillText(name.toUpperCase(), 13, 18)
    ctx.font = '10px system-ui'; ctx.fillStyle = '#bdd2e1'
    ctx.fillText(`${grid.count} × ${grid.count} muestras · ${grid.resolution}`, 13, 33)
    ctx.fillText(`Z ${pretty(min)} – ${pretty(max)} m`, 13, 47)
    ctx.fillStyle = '#fff'; ctx.font = 'bold 13px system-ui'; ctx.textAlign = 'right'
    ctx.fillText('N ↑', W - 12, 20)
    if (mode === '3d') { ctx.font = '10px system-ui'; ctx.fillStyle = '#a6c3d8'; ctx.fillText(`${pretty(grid.width / 1000, 2)} × ${pretty(grid.height / 1000, 2)} km`, W - 12, H - 13) }
    if (hover && mode === '2d') {
      const at = project({ u: hover.u, v: hover.v }); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(at.x, at.y, 3, 0, 2 * Math.PI); ctx.fill()
    }
  }, [grid, stats?.min, stats?.max, mode, azimuth, zoom, vertical, showGrid, showContours, hover, name])

  function handlePointerDown(e) {
    if (mode !== '3d') return
    drag.current = { x: e.clientX, a: azimuth }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  function handleMove(e) {
    if (drag.current) { setAzimuth(drag.current.a + (e.clientX - drag.current.x) / 130); return }
    if (mode === '2d' && grid) {
      const rect = e.currentTarget.getBoundingClientRect(), side = Math.min(rect.width - 66, rect.height - 68) * zoom
      const u = (e.clientX - rect.left - rect.width / 2 + side / 2) / side, v = (e.clientY - rect.top - rect.height / 2 + side / 2) / side
      setHover(u >= 0 && u <= 1 && v >= 0 && v <= 1 ? { u, v } : null)
    }
  }
  return <div className="terrain-display">
    <div className="terrain-tools" role="group" aria-label={'Herramientas topográficas de ' + name}>
      <button type="button" className={mode === '3d' ? 'is-active' : ''} onClick={() => setMode('3d')}>Superficie 3D</button>
      <button type="button" className={mode === '2d' ? 'is-active' : ''} onClick={() => setMode('2d')}>Curvas en planta</button>
      <label><input type="checkbox" checked={showGrid} onChange={(e) => setShowGrid(e.target.checked)} /> Grilla</label>
      <label><input type="checkbox" checked={showContours} onChange={(e) => setShowContours(e.target.checked)} /> Curvas</label>
    </div>
    {grid ? <>
      <canvas ref={canvas} className="terrain-canvas" onPointerDown={handlePointerDown} onPointerMove={handleMove} onPointerUp={() => { drag.current = null }} onPointerCancel={() => { drag.current = null }} onPointerLeave={() => setHover(null)} onWheel={(e) => { if (e.cancelable) e.preventDefault(); setZoom((z) => clamp(z + (e.deltaY < 0 ? .09 : -.09), .58, 1.55)) }} aria-label={`Relieve de ${name}, visualización interpolada desde DEM`} />
      <div className="terrain-actions"><button type="button" onClick={() => setZoom((z) => clamp(z + .15, .58, 1.55))}>+ Ampliar</button><button type="button" onClick={() => setZoom((z) => clamp(z - .15, .58, 1.55))}>− Reducir</button>{mode === '3d' && <label>Exageración Z <input type="range" min="1" max="5" step=".5" value={vertical} onChange={(e) => setVertical(+e.target.value)} /></label>}</div>
      {hover && mode === '2d' && <p className="canvas-probe">Cota interpolada: {pretty(interpolate(grid, hover.u, hover.v), 2)} m · X {pretty((hover.u - .5) * grid.width)} m · Y {pretty((.5 - hover.v) * grid.height)} m</p>}
    </> : <div className="terrain-unavailable"><strong>Sin superficie altimétrica todavía</strong><p>Introduce las coordenadas y consulta un DEM para la Tierra, o importa la cuadrícula del DEM de {name} para calcular sus curvas reales. No se generan elevaciones ficticias.</p></div>}
    <small className="terrain-disclaimer">Curvas e intermedios interpolados; no representan mediciones adicionales. La escala vertical 3D es ilustrativa.</small>
  </div>
}
