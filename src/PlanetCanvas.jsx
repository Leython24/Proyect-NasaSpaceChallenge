import { useEffect, useRef, useState } from 'react'

const radians = Math.PI / 180
const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

function projectedMarker(target, orientation) {
  const [lat, lon] = target.map((value) => value * radians)
  const [viewLat, viewLon, zoom] = orientation
  const center = viewLat * radians
  const delta = lon - viewLon * radians
  const depth = Math.cos(lat) * Math.cos(delta) * Math.cos(center) + Math.sin(lat) * Math.sin(center)
  if (depth <= 0) return null
  const radius = 44.5 * zoom
  const x = 50 + radius * Math.cos(lat) * Math.sin(delta)
  const y = 50 - radius * (Math.sin(lat) * Math.cos(center) - Math.cos(lat) * Math.cos(delta) * Math.sin(center))
  return x > 4 && x < 96 && y > 4 && y < 96 ? { left: x + '%', top: y + '%' } : null
}

export default function PlanetCanvas({ mission, orientation, onRotate, onReference }) {
  const canvas = useRef()
  const gesture = useRef()
  const [texture, setTexture] = useState(null)
  const [resolution, setResolution] = useState(360)

  useEffect(() => {
    let active = true
    const image = new Image()
    image.onload = () => {
      if (!active) return
      const scratch = document.createElement('canvas')
      scratch.width = image.width
      scratch.height = image.height
      const context = scratch.getContext('2d')
      if (!context) return
      context.drawImage(image, 0, 0)
      setTexture(context.getImageData(0, 0, image.width, image.height))
    }
    image.src = '/assets/' + mission.texture + '.webp'
    const observer = new ResizeObserver(([entry]) => {
      setResolution(clamp(Math.round(Math.min(entry.contentRect.width, entry.contentRect.height)), 120, 480))
    })
    observer.observe(canvas.current)
    return () => { active = false; observer.disconnect() }
  }, [mission.texture])

  useEffect(() => {
    if (!texture) return
    const context = canvas.current.getContext('2d')
    if (!context) return
    const [lat, lon, zoom] = orientation
    const latitude = lat * radians
    const longitude = lon * radians
    const sin = Math.sin(latitude), cos = Math.cos(latitude)
    const image = context.createImageData(resolution, resolution)
    const radius = resolution * .445 * zoom
    const center = (resolution - 1) / 2
    for (let row = 0; row < resolution; row++) {
      const y = (center - row) / radius
      for (let col = 0; col < resolution; col++) {
        const x = (col - center) / radius
        const squared = x * x + y * y
        if (squared > 1) continue
        const z = Math.sqrt(1 - squared)
        const sampleLat = Math.asin(clamp(y * cos + z * sin, -1, 1))
        const sampleLon = longitude + Math.atan2(x, z * cos - y * sin)
        const u = ((sampleLon / (2 * Math.PI) + .5) % 1 + 1) % 1
        const ix = Math.floor(u * texture.width)
        const iy = Math.min(texture.height - 1, Math.floor((.5 - sampleLat / Math.PI) * texture.height))
        const source = (iy * texture.width + ix) * 4, target = (row * resolution + col) * 4
        const light = .32 + .81 * Math.max(0, -.46 * x + .5 * y + .73 * z)
        for (let channel = 0; channel < 3; channel++) image.data[target + channel] = texture.data[source + channel] * light
        image.data[target + 3] = clamp((1 - Math.sqrt(squared)) * radius * 255, 0, 255)
      }
    }
    context.putImageData(image, 0, 0)
  }, [texture, orientation, resolution])

  const marker = projectedMarker(mission.target, orientation)
  return <div className="software-globe">
    {!texture && <img className="planet-fallback" src={'/assets/' + mission.texture + '-vista.webp'} alt="" />}
    <div className="globe-square">
    <canvas ref={canvas} width={resolution} height={resolution} aria-label={'Globo interactivo de ' + mission.title} tabIndex={0}
      onPointerDown={(event) => {
        if (event.button !== 0) return
        gesture.current = [event.clientX, event.clientY]
        event.currentTarget.setPointerCapture(event.pointerId)
      }}
      onPointerMove={(event) => {
        if (!gesture.current) return
        const [x, y] = gesture.current
        gesture.current = [event.clientX, event.clientY]
        onRotate((event.clientY - y) * .36, (x - event.clientX) * .43)
      }}
      onPointerUp={() => { gesture.current = null }} onLostPointerCapture={() => { gesture.current = null }}
      onKeyDown={(event) => {
        const delta = {ArrowLeft: [0, -8], ArrowRight: [0, 8], ArrowUp: [8, 0], ArrowDown: [-8, 0]}[event.key]
        if (delta) { event.preventDefault(); onRotate(...delta) }
      }}
    />
    {texture && marker && <button type="button" className="orbital-marker software-marker" style={marker} onClick={onReference}
      title="Ubicación ilustrativa">
      <span className="marker-dot" aria-hidden="true" /><span>{mission.marker}</span>
    </button>}
    </div>
  </div>
}
