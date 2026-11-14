import { Component, Suspense, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { Html, OrbitControls, useTexture } from '@react-three/drei'
import { Focus, Minus, Plus } from 'lucide-react'
import { SRGBColorSpace, Vector3 } from 'three'
import PlanetCanvas from './PlanetCanvas.jsx'

function globePoint([lat, lon], radius) {
  const latitude = lat * Math.PI / 180
  const longitude = lon * Math.PI / 180
  const horizontal = radius * Math.cos(latitude)
  return [horizontal * Math.cos(longitude), radius * Math.sin(latitude), -horizontal * Math.sin(longitude)]
}

function PlanetSurface({ mission, onReference }) {
  const surface = useRef()
  const texture = useTexture('/assets/' + mission.texture + '.webp')
  texture.colorSpace = SRGBColorSpace
  return (
    <>
      <mesh ref={surface}>
        <sphereGeometry args={[2, 96, 64]} />
        <meshStandardMaterial map={texture} roughness={1} />
      </mesh>
      <Html position={globePoint(mission.target, 2.025)} occlude={[surface]} zIndexRange={[10, 1]}>
        <button type="button" className="orbital-marker" onClick={onReference} title="Ubicación ilustrativa">
          <span className="marker-dot" aria-hidden="true" />
          <span>{mission.marker}</span>
        </button>
      </Html>
    </>
  )
}

class CanvasBoundary extends Component {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

function hasWebGL() {
  try {
    const context = document.createElement('canvas').getContext('webgl2')
    return Boolean(context)
  } catch {
    return false
  }
}

export default function Planet({ mission, onReference }) {
  const controls = useRef()
  const view = mission.title === 'Luna' ? [-58, 125] : [12, 91]
  const [webgl] = useState(hasWebGL)
  const [orientation, setOrientation] = useState(() => [...view, 1])
  const fallback = <PlanetCanvas mission={mission} orientation={orientation} onReference={onReference} onRotate={(dLat, dLon) =>
    setOrientation(([lat, lon, scale]) => [Math.min(90, Math.max(-90, lat + dLat)), (lon + dLon + 360) % 360, scale])
  } />
  function zoom(factor) {
    const orbit = controls.current
    if (!orbit) {
      setOrientation(([lat, lon, scale]) => [lat, lon, Math.min(1.95, Math.max(.6, scale / factor))])
      return
    }
    const camera = orbit.object
    const relative = new Vector3().subVectors(camera.position, orbit.target)
    const distance = Math.min(12, Math.max(4.6, relative.length() * factor))
    camera.position.copy(relative.setLength(distance).add(orbit.target))
    orbit.update()
  }

  return (
    <section className="planet-stage" aria-label={'Explorador visual de ' + mission.title}>
      <div className="planet-caption"><span className="live-dot" /> EXPLORADOR PLANETARIO</div>
      <div className="planet-canvas">
        {webgl ? <CanvasBoundary fallback={fallback}>
          <Canvas camera={{ position: globePoint(view, 7.3), fov: 41 }} dpr={[1, 1.65]} frameloop="demand" fallback={fallback}>
            <ambientLight intensity={0.76} />
            <directionalLight position={globePoint([40, mission.title === 'Luna' ? 155 : 112], 7)} intensity={2.35} />
            <Suspense fallback={null}><PlanetSurface mission={mission} onReference={onReference} /></Suspense>
            <OrbitControls ref={controls} enablePan={false} enableDamping minDistance={4.6} maxDistance={12} />
          </Canvas>
        </CanvasBoundary> : fallback}
      </div>
      <div className="planet-toolbar" aria-label="Controles del planeta">
        <button type="button" onClick={() => { controls.current?.reset(); setOrientation([...view, 1]) }} title="Restablecer vista" aria-label="Restablecer vista"><Focus size={19} /></button>
        <button type="button" onClick={() => zoom(.82)} title="Acercar planeta" aria-label="Acercar planeta"><Plus size={20} /></button>
        <button type="button" onClick={() => zoom(1.22)} title="Alejar planeta" aria-label="Alejar planeta"><Minus size={20} /></button>
      </div>
      <div className="orbit-foot"><span>{mission.title === 'Luna' ? 'POLO SUR LUNAR' : 'EXPLORACIÓN MARCIANA'}</span><span>Arrastra para girar · Vista ilustrativa</span></div>
    </section>
  )
}
