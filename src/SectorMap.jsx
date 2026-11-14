import { useEffect } from 'react'
import { CRS, divIcon } from 'leaflet'
import { GeoJSON, ImageOverlay, MapContainer, Marker, useMap } from 'react-leaflet'

import peru from './data/peru.json'

const baseBounds = [[-22, -89], [4, -61]]
const peruBounds = [[-19, -83], [0, -67.3]]
const overviewPin = divIcon({ className: 'map-sector-pin', html: '<span></span>', iconSize: [20, 20], iconAnchor: [10, 10] })

function Viewport({ selection, focus }) {
  const map = useMap()
  useEffect(() => {
    function fit() {
      if (focus && selection?.geometria) {
        const geometry = selection.geometria
        const positions = geometry.type === 'MultiPolygon' ? geometry.coordinates.flat(2) : geometry.coordinates.flat()
        const bounds = positions.map(([longitude, latitude]) => [latitude, longitude])
        if (bounds.length) {
          map.fitBounds(bounds, { padding: [34, 34], maxZoom: 11, animate: false })
          return
        }
      }
      map.fitBounds(peruBounds, { padding: [4, 4], animate: false })
    }
    fit()
    const observer = new ResizeObserver(() => { map.invalidateSize({ pan: false }); fit() })
    observer.observe(map.getContainer())
    return () => observer.disconnect()
  }, [map, selection, focus])
  return null
}

export default function SectorMap({ sectors, selected, onSelect, focus, center }) {
  const collection = {
    type: 'FeatureCollection',
    features: sectors.filter((sector) => sector.geometria).map((sector) => ({
      type: 'Feature', geometry: sector.geometria, properties: { id: sector.id },
    })),
  }
  const ring = selected?.geometria
  const vertices = ring?.type === 'MultiPolygon' ? ring.coordinates[0]?.[0] : ring?.coordinates[0]
  const point = vertices?.length
    ? [vertices.reduce((sum, item) => sum + item[1], 0) / vertices.length, vertices.reduce((sum, item) => sum + item[0], 0) / vertices.length]
    : center
  function style(feature) {
    const active = feature.properties.id === selected?.id
    return { color: active ? '#c3ff56' : '#eafaeb', weight: active ? 3 : 1.5, fillColor: '#bfff42', fillOpacity: active ? .26 : .10 }
  }
  return (
    <MapContainer crs={CRS.EPSG4326} center={[-9, -75]} zoom={4} minZoom={3} maxZoom={12} className="leaflet-view" zoomControl={false} scrollWheelZoom={false} maxBounds={baseBounds} maxBoundsViscosity={.9} aria-label="Mapa de sectores del Perú">
      <ImageOverlay url="/assets/peru.webp" bounds={baseBounds} attribution="NASA Blue Marble · Natural Earth" />
      <GeoJSON data={peru} interactive={false} style={{ color: '#eff4e8', weight: 1.15, fill: false, opacity: .85 }} />
      <Viewport selection={selected} focus={focus} />
      <GeoJSON key={sectors.map((sector) => sector.id).join(',')} data={collection} style={style} eventHandlers={{ click(event) {
        const id = event.layer?.feature?.properties.id ?? event.propagatedFrom?.feature?.properties.id
        if (id) onSelect(id)
      } }} />
      {selected && !focus && <Marker position={point} icon={overviewPin} title={selected.nombre} alt={selected.nombre} eventHandlers={{ click: () => onSelect(selected.id) }} />}
    </MapContainer>
  )
}
