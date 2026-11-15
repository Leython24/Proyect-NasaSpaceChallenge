import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, BookOpen, Compass, Download, Globe2, Layers3, MapPinned, Mountain, Orbit, Save, ScanLine, Sparkles } from 'lucide-react'

const STEPS = [
  {
    id: 'ubicacion', number: '01', icon: MapPinned, label: 'Elige tu lugar', title: 'Empieza con un punto en el mapa',
    question: '¿Dónde queremos explorar?',
    explanation: 'Selecciona un sector del Perú, escribe sus coordenadas o utiliza el GPS. Las coordenadas responden dónde está el lugar; el modelo digital de elevación nos ayuda a descubrir qué altura tiene y cómo cambia el terreno.',
    observation: 'En la Tierra también verás sus coordenadas UTM, útiles para organizar los puntos en Civil 3D.',
  },
  {
    id: 'superficie', number: '02', icon: Layers3, label: 'Mira el relieve', title: 'De números a montañas y valles',
    question: '¿Qué nos cuenta una curva de nivel?',
    explanation: 'Imagina cortar una montaña en capas horizontales. Cada línea une puntos de igual altura. Cuando las curvas están juntas, el suelo cambia de altura rápidamente; cuando se separan, el terreno suele ser más suave. Alterna entre planta 2D y superficie 3D para verlo.',
    observation: 'La cuadrícula muestra dónde se conocen alturas y dónde el visor interpola entre ellas; no es un levantamiento de campo.',
  },
  {
    id: 'interpretacion', number: '03', icon: Compass, label: 'Entiende la zona', title: 'Descubre si el terreno es suave o inclinado',
    question: '¿Sería fácil cruzar esta zona?',
    explanation: 'La pendiente mide cuánto subimos o bajamos respecto a una distancia horizontal. Aquí verás el desnivel, la orientación aproximada de descenso y una lectura inicial del tipo de relieve, con criterios útiles para comprender rutas y movilidad.',
    observation: 'El azimut automático es una orientación topográfica de referencia; no define el eje de una carretera.',
  },
  {
    id: 'comparar', number: '04', icon: Orbit, label: 'Compara planetas', title: '¿Qué lugar de la Tierra se parece a Marte o a la Luna?',
    question: 'Dos mundos, una misma pregunta',
    explanation: 'Observa las cuadrículas una junto a otra, compara pendientes, área suave, desnivel y perfiles. Selecciona Jezero, Gale, Shackleton u otra referencia del catálogo para pensar dónde sería útil practicar una misión de exploración.',
    observation: 'Las superficies planetarias sin DEM se muestran como aproximaciones visuales, claramente etiquetadas; las curvas reales necesitan alturas por celda.',
  },
  {
    id: 'biblioteca', number: '05', icon: Save, label: 'Guarda y comparte', title: 'Construye tu propia colección de análogos',
    question: '¿Qué investigaremos después?',
    explanation: 'Guarda nuevas zonas, recupera tus análisis, importa cuadrículas DEM y conserva las comparaciones. Exporta copias JSON, reportes, imágenes y puntos PNEZD para continuar tu trabajo con el equipo.',
    observation: 'Los lugares se guardan en este navegador; exporta un respaldo JSON para moverlos a otra computadora.',
  },
]

const sectionTargets = { ubicacion: 'ubicacion', superficie: 'superficie', interpretacion: 'interpretacion', comparar: 'comparar', biblioteca: 'biblioteca' }

export default function GeoPendienteExperience({ missionKey, sector, coordinates, scrollContainer, onClose, onOpenPrecision }) {
  const [activeId, setActiveId] = useState('ubicacion')
  const [ready, setReady] = useState(false)
  const [frameHeight, setFrameHeight] = useState(900)
  const [siteName, setSiteName] = useState('')
  const iframeRef = useRef(null)
  const containerRef = useRef(null)
  const current = STEPS.find((x) => x.id === activeId) ?? STEPS[0]
  const Icon = current.icon
  const bodyName = missionKey === 'luna' ? 'la Luna' : 'Marte'
  const missionEmoji = missionKey === 'luna' ? '🌙' : '🔴'
  const standalone = `${import.meta.env.BASE_URL}laboratorio-geopendiente.html`
  const { lat, lon } = coordinates ?? {}

  const send = useCallback((message) => {
    if (!iframeRef.current?.contentWindow) return
    iframeRef.current.contentWindow.postMessage({ source: 'geoanalogos-react', ...message }, window.location.origin)
  }, [])

  useEffect(() => {
    if (!ready) return
    send({ type: 'select', mission: missionKey, sectorId: sector?.id, lat, lon })
  }, [ready, missionKey, sector?.id, lat, lon, send])

  useEffect(() => {
    function receive(event) {
      if (event.origin !== window.location.origin || event.source !== iframeRef.current?.contentWindow) return
      const data = event.data
      if (data?.source !== 'geo-pendiente-lab') return
      if (data.type === 'ready') setReady(true)
      if (data.type === 'height' && Number.isFinite(data.height)) setFrameHeight(Math.max(480, Math.min(25000, data.height)))
      if (data.type === 'selected' && typeof data.site === 'string') setSiteName(data.site)
      if (data.type === 'scroll' && Number.isFinite(data.top)) {
        const container = scrollContainer.current
        const frame = iframeRef.current
        if (!container || !frame) return
        const frameOffset = frame.getBoundingClientRect().top - container.getBoundingClientRect().top
        container.scrollTo({ top: Math.max(0, container.scrollTop + frameOffset + data.top - 12), behavior: 'smooth' })
      }
    }
    window.addEventListener('message', receive)
    return () => window.removeEventListener('message', receive)
  }, [scrollContainer])

  function goTo(id) {
    setActiveId(id)
    if (ready) send({ type: 'navigate', section: sectionTargets[id] })
    else containerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return <section className="geostudio" ref={containerRef} aria-label="Explorador de análogos topográficos">
    <header className="geostudio-head">
      <button type="button" className="geostudio-back" onClick={onClose}><ArrowLeft size={16} /> Volver a Órbita</button>
      <div className="geostudio-brand"><span><Sparkles size={16} /> EXPERIENCIA INTERACTIVA · NASA SPACE APPS</span><h1>Viaja de tu terreno a <em>{bodyName}</em></h1><p>Convierte coordenadas en relieve, descubre por qué importa cada pendiente y busca parecidos entre lugares de la Tierra, Marte y la Luna. Todo con el analizador original de GeoPendiente.</p></div>
      <div className="geostudio-planet-orbs" aria-hidden="true"><span className="orb-earth">🌎</span><span className="orb-trail">∙ ∙ ∙</span><span className="orb-other">{missionEmoji}</span></div>
    </header>

    <div className="geostudio-journey">
      <div className="geostudio-journey-title"><div><BookOpen size={18} /><strong>Tu recorrido de exploración</strong></div><p>Elige una etapa. Cada botón te lleva a sus herramientas dentro de la aplicación.</p></div>
      <nav className="geostudio-steps" aria-label="Etapas del explorador">
        {STEPS.map(({ id, number, icon: StepIcon, label }) => <button key={id} type="button" className={'geostudio-step ' + (id === activeId ? 'is-current' : '')} aria-current={id === activeId ? 'step' : undefined} onClick={() => goTo(id)}><span className="step-number">{number}</span><StepIcon size={19}/><span>{label}</span></button>)}
      </nav>
    </div>

    <section className="geostudio-explainer" aria-live="polite">
      <div className="geostudio-explainer-main"><div className="geostudio-stage"><Icon size={17}/><span>ETAPA {current.number} · {current.label.toUpperCase()}</span></div><h2>{current.title}</h2><h3>{current.question}</h3><p>{current.explanation}</p><div className="geostudio-fact"><ScanLine size={18}/><span>{current.observation}</span></div><button type="button" className="geostudio-focus" onClick={() => goTo(activeId)}>Ir a la herramienta <ArrowRight size={17}/></button></div>
      <div className="geostudio-explainer-side"><div className="geostudio-mini-label">TU EXPEDICIÓN ACTUAL</div><strong>{sector?.nombre ?? 'Lugar de estudio'}</strong><span>{sector?.id ?? 'Coordenadas personalizadas'} · Perú</span><div className="geostudio-link-line"><Globe2 size={18}/><i/> <Mountain size={18}/><span>{bodyName}</span></div><p>{siteName ? `Ficha activa en el analizador: ${siteName}.` : `Se conectará el sector seleccionado con las referencias de ${bodyName}.`}</p><button type="button" onClick={() => goTo('comparar')}>Ver comparación <ArrowRight size={15}/></button></div>
    </section>

    <div className="geostudio-reading-guide" role="note"><div><strong>Lo que necesitas saber</strong><p>Las elevaciones terrestres se consultan en modelos digitales. Los valores de Marte y Luna provienen de referencias científicas del catálogo; cuando falte un DEM numérico, las superficies visuales estimadas se diferencian de las curvas reales. Comparar no significa que ambos terrenos sean idénticos.</p></div><button type="button" onClick={onOpenPrecision}>Abrir también el laboratorio técnico <ArrowRight size={16}/></button></div>

    <div className="geostudio-tool-title"><div><span className="geostudio-kicker"><Layers3 size={16}/> ANALIZADOR COMPLETO</span><h2>Laboratorio GeoPendiente</h2><p>Se mantienen sus herramientas originales: GPS, coordenadas UTM, DEM, relieve 2D/3D, curvas, azimut, clasificación, biblioteca, comparaciones y exportaciones.</p></div><span className="geostudio-live"><span className={ready ? 'ready' : ''}/>{ready ? 'Herramientas conectadas' : 'Iniciando herramientas'}</span></div>
    <div className="geostudio-frame-shell">
      <iframe
        ref={iframeRef}
        title="Analizador GeoPendiente completo integrado en GeoAnálogos Perú"
        src={`${standalone}?embed=1`}
        className="geostudio-frame"
        style={{ height: `${frameHeight}px` }}
      />
    </div>
    <a className="text-sm text-mint-300 underline" href={standalone} target="_blank" rel="noreferrer">Abrir GeoPendiente en otra pestaña</a>
    <footer className="geostudio-footer"><div><strong>¿Vas a presentar tus resultados?</strong><p>Explica primero dónde está la zona, luego qué muestran sus curvas, después la pendiente y por último qué se parece —o no— al planeta elegido.</p></div><button type="button" onClick={() => goTo('biblioteca')}><Download size={17}/> Guardar o exportar datos</button></footer>
  </section>
}
