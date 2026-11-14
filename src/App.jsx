import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, ChevronRight, CircleHelp, Compass, ExternalLink, Flag, Globe, Layers3, MapPin, Mars, Moon, Mountain, Search, X } from 'lucide-react'
import SectorMap from './SectorMap.jsx'
import { buildDemo, missions, visualSources } from './data/catalog.js'
import grid from './data/sectores.geojson?raw'
import { findSelection, formatDifference, formatMetric, metrics, sectorsForMission, webLink } from './data/presentation.js'
import { loadPublishedCatalog, remoteRequested } from './data/supabase.js'

const Planet = lazy(() => import('./Planet.jsx'))
const demo = buildDemo(JSON.parse(grid))
const initialCatalog = remoteRequested ? null : demo

function ReferenceImage({ mission }) {
  return <figure className="reference-image">
    <img src={'/assets/' + mission.referenceImage + '.webp'} alt={mission.imageAlt} />
    <figcaption>{mission.imageCredit}</figcaption>
  </figure>
}

function SourcesDialog({ open, onClose, sources }) {
  const dialog = useRef()
  useEffect(() => {
    if (open && !dialog.current.open) dialog.current.showModal()
    if (!open && dialog.current.open) dialog.current.close()
  }, [open])
  return <dialog ref={dialog} className="sources-dialog" onClose={onClose} onClick={(event) => {
    if (event.target === event.currentTarget) onClose()
  }}>
    <section className="sources-panel" aria-labelledby="sources-title">
      <header>
        <div><div className="eyebrow">EVIDENCIA Y CRÉDITOS</div><h2 id="sources-title">Fuentes de la comparación</h2></div>
        <button type="button" className="icon-button" aria-label="Cerrar fuentes" onClick={onClose}><X size={21} /></button>
      </header>
      <div className="source-list">
        {sources.map((source) => <article key={source.id} className="source-item">
          <Layers3 size={19} aria-hidden="true" />
          <div><h3>{source.producto}</h3><p>{source.institucion}{source.resolucion ? ' · ' + source.resolucion : ''}</p>{source.uso && <p>{source.uso}</p>}</div>
          {webLink(source.url) && <a href={webLink(source.url)} target="_blank" rel="noreferrer" aria-label={'Abrir fuente de ' + source.producto}><ExternalLink size={19} /></a>}
        </article>)}
      </div>
    </section>
  </dialog>
}

function Comparison({ mission, sector, reference, onBack, onSources }) {
  const heading = useRef()
  useEffect(() => {
    heading.current?.focus({ preventScroll: true })
    if (window.matchMedia('(max-width: 670px)').matches) {
      heading.current?.closest('article').scrollIntoView({ block: 'start' })
    }
  }, [sector.id])
  const pending = metrics.some(({ key }) => !Number.isFinite(sector?.[key]) || !Number.isFinite(reference?.[key]))
  return <article className="panel comparison">
    <header className="comparison-header">
      <button className="link-button" onClick={onBack} type="button"><ArrowLeft size={17} /> Volver al mapa</button>
      <span className="mini-label">{mission.title}</span>
    </header>
    <h2 ref={heading} tabIndex={-1}>Comparación del terreno</h2>
    <p className="comparison-subtitle">Resultados del sector <strong>{sector.id}</strong> y su referencia planetaria.</p>
    <div className="comparison-sites">
      <div><span>SECTOR EN PERÚ</span><strong>{sector.nombre}</strong><small>{sector.departamento}</small></div>
      <div><span>{mission.referenceLabel.toUpperCase()}</span><strong>{reference?.nombre ?? mission.marker}</strong><small>Modelo de elevación</small></div>
    </div>
    <table className="metric-table">
      <thead><tr><th scope="col">Métrica</th><th scope="col">Perú</th><th scope="col">{mission.title}</th><th scope="col">Diferencia</th></tr></thead>
      <tbody>{metrics.map(({ key, label, unit, differenceUnit }) => <tr key={key}>
        <th scope="row">{label}</th>
        <td data-heading="Perú">{formatMetric(sector[key], unit)}</td>
        <td data-heading={mission.title}>{formatMetric(reference?.[key], unit)}</td>
        <td data-heading="Diferencia">{formatDifference(sector[key], reference?.[key], differenceUnit ?? unit)}</td>
      </tr>)}</tbody>
    </table>
    <section className="interpretation">
      <div><h3>Qué se parece</h3><p>{sector.similitud ?? (pending ? 'La similitud topográfica se determinará con las mediciones de ambos sectores.' : 'Compara los valores y sus diferencias para reconocer los rasgos topográficos más cercanos.')}</p></div>
      <div><h3>Límites de la analogía</h3><p>{sector.limites ?? mission.limit}</p></div>
      <div className="trial"><Flag size={19} aria-hidden="true" /><div><h3>Qué podríamos ensayar</h3><p>{sector.ensayo ?? mission.trial}</p></div></div>
    </section>
    <button className="primary-button" onClick={onSources} type="button"><Layers3 size={17} /> Ver fuentes <ArrowRight size={17} /></button>
  </article>
}

export default function App() {
  const [catalog, setCatalog] = useState(initialCatalog)
  const [status, setStatus] = useState(remoteRequested ? 'cargando' : 'demo')
  const [request, setRequest] = useState(0)
  const [missionKey, setMissionKey] = useState('marte')
  const [selectedId, setSelectedId] = useState('SE-05')
  const [query, setQuery] = useState('')
  const [focused, setFocused] = useState(false)
  const [comparison, setComparison] = useState(false)
  const [showSources, setShowSources] = useState(false)
  const mapHeading = useRef()
  const mission = missions[missionKey]

  useEffect(() => {
    if (!remoteRequested) return
    let active = true
    loadPublishedCatalog().then((records) => {
      if (active) { setCatalog(records); setStatus('publicado') }
    }).catch(() => {
      if (active) setStatus('error')
    })
    return () => { active = false }
  }, [request])

  const records = catalog ?? { sectores: [], referencias: [], fuentes: [] }
  const sectors = sectorsForMission(records, missionKey, query)
  const selected = findSelection(sectors, selectedId, mission.defaultSector)
  const reference = records.referencias.find(({ id }) => id === (selected?.referencia_id ?? mission.ref))
  const usedSources = new Set([selected?.fuente_id, reference?.fuente_id])
  const sources = [...records.fuentes.filter(({ id }) => usedSources.has(id)), ...visualSources.filter(({ id }) =>
    id === 'map' || (missionKey === 'marte' ? ['mars-texture', 'hi-rise'].includes(id) : ['moon-texture', 'shadowcam'].includes(id)))]

  function changeMission(next) {
    if (next === missionKey) return
    setMissionKey(next)
    setSelectedId(missions[next].defaultSector)
    setQuery('')
    setFocused(false)
    setComparison(false)
  }

  function selectSector(id) {
    setSelectedId(id)
    setFocused(true)
    setComparison(true)
  }

  function returnToMap() {
    setComparison(false)
    mapHeading.current?.focus({ preventScroll: true })
    if (window.matchMedia('(max-width: 670px)').matches) {
      mapHeading.current?.closest('article').scrollIntoView({ block: 'start' })
    }
  }

  const fallback = <img className="planet-fallback startup" src={'/assets/' + mission.texture + '-vista.webp'} alt={'Vista ilustrativa de ' + mission.title} />
  return <div className={'application ' + missionKey}>
    <aside className="sidebar">
      <div className="brand"><Mountain size={33} strokeWidth={1.75} /><strong>GeoAnálogos<br />Perú</strong></div>
      <button type="button" className="sidebar-item active" onClick={() => { setComparison(false); setFocused(false) }}><Compass size={19} /> Explorar</button>
      <button type="button" className="sidebar-item" onClick={() => setShowSources(true)}><Layers3 size={19} /> Fuentes</button>
      <div className="sidebar-bottom"><Globe size={19} /><span>NASA Space Apps<br /><b>Proyecto estudiantil</b></span></div>
    </aside>
    <div className="main-area">
      <header className="topbar">
        <div className="mobile-brand"><Mountain size={22} /> GeoAnálogos Perú</div>
        <div className="mission-switch" role="group" aria-label="Seleccionar misión">
          <button type="button" aria-pressed={missionKey === 'marte'} onClick={() => changeMission('marte')}><Mars size={21} /> Marte</button>
          <button type="button" aria-pressed={missionKey === 'luna'} onClick={() => changeMission('luna')}><Moon size={21} /> Luna</button>
        </div>
        <label className="search"><Search size={18} /><span className="sr-only">Buscar sector</span><input type="search" placeholder="Buscar sector" value={query} onChange={(event) => { setQuery(event.target.value); setComparison(false) }} /></label>
      </header>
      <main className="dashboard">
        {status === 'error' && <div className="connection-status" role="alert">
          <span>Ocurrió un error al consultar Supabase.</span>
          <button type="button" onClick={() => { setStatus('cargando'); setRequest(request + 1) }}>Reintentar</button>
          <button type="button" onClick={() => { setCatalog(demo); setStatus('demo') }}>Abrir demostración</button>
        </div>}
        <div className="intro">
          <div><p className="eyebrow">ANÁLOGOS TERRESTRES</p><h1>Explora el terreno</h1></div>
          <span className="mode-label"><span /> {status === 'demo' ? 'Modo demostración' : status === 'publicado' ? 'Datos publicados' : status === 'cargando' ? 'Cargando datos' : 'Conexión pendiente'}</span>
        </div>
        <div className={'explorer ' + (comparison && selected ? 'has-comparison' : '')}>
          <article className="panel map-panel">
            <div className="card-kicker"><MapPin size={15} /> TIERRA</div>
            <h2 ref={mapHeading} tabIndex={-1}>Sectores del Perú</h2>
            <p className="panel-copy">{mission.region}, {mission.department}</p>
            <div className="map-wrap">
              <SectorMap sectors={sectors} center={mission.center} selected={selected} onSelect={selectSector} focus={focused} />
            </div>
            {status === 'cargando' ? <p className="panel-copy" role="status">Cargando sectores…</p>
              : !sectors.length ? <p className="panel-copy" role="status">{status === 'error' ? 'No se pudo consultar el catálogo.' : query ? 'No hay sectores que coincidan con la búsqueda.' : 'Todavía no hay sectores publicados para esta misión.'}</p>
              : <>
                <div className="map-legend"><span className="legend-swatch" /> Sector seleccionado</div>
                <label className="sector-picker"><span className="sr-only">Seleccionar sector peruano</span><select value={selected?.id ?? ''} onChange={(event) => selectSector(event.target.value)}>
                  {sectors.map((sector) => <option key={sector.id} value={sector.id}>{sector.nombre} · {sector.id}</option>)}
                </select></label>
                <button type="button" className="link-button map-toggle" onClick={() => setFocused(!focused)}>{focused ? 'Ver todo el Perú' : 'Acercar al sector'} <ChevronRight size={15} /></button>
              </>}
          </article>
          <Suspense fallback={<div className="planet-stage">{fallback}</div>}>
            <Planet key={missionKey} mission={mission} onReference={() => selected && selectSector(selected.id)} />
          </Suspense>
          {comparison && selected ? <Comparison mission={mission} sector={selected} reference={reference} onBack={returnToMap} onSources={() => setShowSources(true)} />
            : <article className="panel reference-panel">
              <div className="card-kicker"><Globe size={15} /> {mission.referenceLabel.toUpperCase()}</div>
              <h2>{reference?.nombre ?? mission.marker}</h2>
              <ReferenceImage mission={mission} />
              <div className="reference-explanation"><CircleHelp size={17} /><p>{mission.trial}</p></div>
              <button type="button" className="primary-button" disabled={!selected} onClick={() => selected && selectSector(selected.id)}>
                Comparar con {mission.region} <ArrowRight size={17} />
              </button>
            </article>}
        </div>
      </main>
    </div>
    <SourcesDialog open={showSources} onClose={() => setShowSources(false)} sources={sources} />
  </div>
}
