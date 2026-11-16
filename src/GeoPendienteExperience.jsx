import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ArrowLeft, Compass, ExternalLink, FlaskConical, Layers3, MapPinned, Orbit, Save } from 'lucide-react'
import { prefersReducedMotion } from './orbita/theme.js'
import { TeamCloudPanel, useTeamCloud } from './orbita/TeamCloud.jsx'
import { REACT_SOURCE, isTrustedLabMessage, parseLabAnalysis } from './data/teamAnalyses.js'

/** Cinco pestañas funcionales: cada una muestra en el analizador las secciones de su etapa. */
export const TABS = [
  {
    id: 'ubicacion', number: '01', icon: MapPinned, label: 'Ubicación',
    lead: 'Elige un sector o escribe coordenadas WGS84 y pulsa «Calcular elevación y pendiente». El resumen aparece debajo.',
  },
  {
    id: 'relieve', number: '02', icon: Layers3, label: 'Relieve',
    lead: 'Mapa, curvas de nivel y visor 3D. Arrastra para girar, usa la rueda o el control de escala y vuelve con «Restablecer».',
  },
  {
    id: 'pendientes', number: '03', icon: Compass, label: 'Pendientes',
    lead: 'Indicadores de pendiente, clasificación descriptiva, orografía MTC DG-2018 y cobertura de la cuadrícula.',
  },
  {
    id: 'comparacion', number: '04', icon: Orbit, label: 'Comparación',
    lead: 'Curvas, perfil e indicadores frente a la referencia planetaria elegida, con sus fuentes. Comparar no implica que los terrenos sean idénticos.',
  },
  {
    id: 'biblioteca', number: '05', icon: Save, label: 'Biblioteca y exportación',
    lead: 'Análisis guardados para tu equipo, lugares guardados en este navegador, importación de DEM y descargas: PNEZD, CSV, JSON y reportes.',
  },
]

export const REFERENCES = {
  marte: { label: 'Marte', site: 'Jezero', short: 'Marte · Jezero' },
  luna: { label: 'Luna', site: 'Shackleton', short: 'Luna · Shackleton' },
}

const nf = (value, digits = 1) =>
  Number.isFinite(value) ? value.toLocaleString('es-PE', { minimumFractionDigits: digits, maximumFractionDigits: digits }) : '—'

/** Barra de pestañas con indicador deslizante, flechas del teclado y desplazamiento propio. */
function TabBar({ active, onChange }) {
  const bar = useRef(null)
  const indicator = useRef(null)
  const place = useCallback(() => {
    const button = bar.current?.querySelector(`[data-tab="${active}"]`)
    if (!button || !indicator.current) return
    indicator.current.style.width = `${button.offsetWidth}px`
    indicator.current.style.transform = `translateX(${button.offsetLeft}px)`
    // Solo se desplaza la barra (nunca la página) para mostrar la pestaña activa.
    const left = button.offsetLeft - bar.current.clientWidth / 2 + button.offsetWidth / 2
    bar.current.scrollTo({ left, behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
  }, [active])
  useLayoutEffect(() => {
    place()
    const observer = new ResizeObserver(place)
    observer.observe(bar.current)
    return () => observer.disconnect()
  }, [place])

  function onKeyDown(event) {
    const index = TABS.findIndex((tab) => tab.id === active)
    const next = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: TABS.length - 1 }[event.key]
    if (next === undefined) return
    event.preventDefault()
    const tab = TABS[(next + TABS.length) % TABS.length]
    onChange(tab.id)
    bar.current.querySelector(`[data-tab="${tab.id}"]`)?.focus()
  }

  return (
    <div ref={bar} className="o-tabs gp-tabs" role="tablist" aria-label="Etapas de GeoPendiente" onKeyDown={onKeyDown}>
      <span ref={indicator} className="o-tab-indicator" aria-hidden="true" />
      {TABS.map(({ id, number, icon: Icon, label }) => (
        <button
          key={id}
          type="button"
          role="tab"
          id={`gp-tab-${id}`}
          data-tab={id}
          aria-selected={id === active}
          aria-controls="gp-panel"
          tabIndex={id === active ? 0 : -1}
          className="o-tab"
          onClick={() => onChange(id)}
        >
          <span className="o-tab-num">{number}</span>
          <Icon size={16} aria-hidden="true" />
          {label}
        </button>
      ))}
    </div>
  )
}

/** Resumen del cálculo vigente: elevación, pendientes, orografía, fuente y cobertura. */
export function ResultSummary({ state, compact = false, onGoTo, flashKey }) {
  const { status, summary, message, kind } = state
  const ref = useRef(null)
  useEffect(() => {
    if (!flashKey || !ref.current) return
    ref.current.classList.remove('o-flash')
    void ref.current.offsetWidth
    ref.current.classList.add('o-flash')
  }, [flashKey])

  if (status !== 'ready' || !summary) {
    return (
      <section ref={ref} className={`gp-summary is-empty ${compact ? 'is-compact' : ''}`} aria-live="polite" aria-busy={status === 'busy'}>
        <div className="gp-summary-head">
          <span className="o-kicker">Resumen del cálculo</span>
          {status === 'busy' && <span className="gp-badge"><span className="o-spinner" aria-hidden="true" /> Consultando elevaciones…</span>}
        </div>
        <p className="o-body mt-1">
          {status === 'busy'
            ? 'Se consultan 49 elevaciones del modelo digital (7 × 7 puntos) alrededor de la coordenada.'
            : kind === 'error' && message
              ? message
              : 'Aún no hay resultados para esta selección. Pulsa «Calcular elevación y pendiente» junto a las coordenadas.'}
        </p>
      </section>
    )
  }
  const s = summary
  const stats = [
    ['Elevación central', `${nf(s.elevation, 0)} m`, 'Cota DEM estimada en el punto'],
    ['Pendiente local', `${nf(s.slopeLocalPct)} %`, `${nf(s.slopeLocalDeg)}° · Horn 3 × 3 en el centro`],
    ['Pendiente media', `${nf(s.slopeMeanPct)} %`, `≈ ${nf(s.slopeMeanDeg)}° · ${s.windows} ventanas internas`],
    ['Pendiente mediana', `${nf(s.slopeMedianPct)} %`, `≈ ${nf(s.slopeMedianDeg)}° · mismas ${s.windows} ventanas`],
    ['Orografía (MTC DG-2018)', s.orography || '—', s.terrainClass || 'Clasificación orientativa'],
    ['Fuente DEM', s.source, `${s.provider ? `${s.provider} · ` : ''}resolución ${s.resolution}`],
  ]
  return (
    <section ref={ref} className={`gp-summary ${compact ? 'is-compact' : ''}`} aria-live="polite">
      <div className="gp-summary-head">
        <span className="o-kicker">Resumen del cálculo</span>
        <span className="gp-badge is-ok">{s.site || `${nf(s.lat, 5)}°, ${nf(s.lon, 5)}°`}</span>
      </div>
      <div className="gp-stats">
        {stats.map(([label, value, note]) => (
          <div key={label} className="o-stat">
            <div className="o-stat-label">{label}</div>
            <div className="o-stat-value">{value}</div>
            <div className="o-legend mt-0.5">{note}</div>
          </div>
        ))}
      </div>
      <p className="o-legend mt-3">
        Cuadrícula de {s.gridN} × {s.gridN} puntos cada {s.spacing} m · cobertura {s.extent} × {s.extent} m ({nf(s.areaHa, 2)} ha) ·
        {' '}{s.valid} de {s.total} puntos con cota · desnivel {nf(s.relief, 0)} m. Estimaciones a escala del modelo digital; no sustituyen un levantamiento topográfico.
      </p>
      {!compact && onGoTo && (
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className="o-btn-secondary" onClick={() => onGoTo('relieve')}><Layers3 size={16} aria-hidden="true" /> Ver relieve 3D</button>
          <button type="button" className="o-btn-secondary" onClick={() => onGoTo('pendientes')}><Compass size={16} aria-hidden="true" /> Ver pendientes</button>
          <button type="button" className="o-btn-ghost" onClick={() => onGoTo('comparacion')}><Orbit size={16} aria-hidden="true" /> Comparar</button>
        </div>
      )}
    </section>
  )
}

export default function GeoPendienteExperience({ target, scrollContainer, isVisible = true, onClose, returnLabel = 'Volver a Órbita', onOpenPrecision, onChangeMission }) {
  const { missionKey, sector, coordinates } = target
  const [tab, setTab] = useState('ubicacion')
  const [ready, setReady] = useState(false)
  const [frameHeight, setFrameHeight] = useState(640)
  const [siteName, setSiteName] = useState('')
  const [result, setResult] = useState({ status: 'idle', summary: null, message: '', kind: '' })
  const [flashKey, setFlashKey] = useState(0)
  const iframeRef = useRef(null)
  const tabsRef = useRef(null)
  const standalone = `${import.meta.env.BASE_URL}laboratorio-geopendiente.html`
  const { lat, lon } = coordinates ?? {}
  const current = TABS.find((x) => x.id === tab) ?? TABS[0]

  const send = useCallback((message) => {
    if (!iframeRef.current?.contentWindow) return
    iframeRef.current.contentWindow.postMessage({ source: REACT_SOURCE, ...message }, window.location.origin)
  }, [])

  // Pedidos de análisis al iframe: cada uno espera su respuesta por requestId.
  const pending = useRef(new Map())
  const requestAnalysis = useCallback(() => new Promise((resolve, reject) => {
    if (!iframeRef.current?.contentWindow) {
      reject(new Error('El analizador aún no está listo.'))
      return
    }
    const requestId = crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random())
    const timer = setTimeout(() => {
      pending.current.delete(requestId)
      reject(new Error('El analizador no respondió. Vuelve a intentarlo.'))
    }, 8000)
    pending.current.set(requestId, { resolve, reject, timer })
    send({ type: 'export-analysis', requestId })
  }), [send])
  const notifySaved = useCallback((record, savedAt) => {
    send({ type: 'cloud-saved', localId: record.localId, cloudId: record.id, savedAt })
  }, [send])
  const openInLab = useCallback((record, editable) => {
    send({ type: 'open-analysis', record, editable })
  }, [send])
  const cloud = useTeamCloud({ requestAnalysis, notifySaved, openInLab, missionKey, resultKey: flashKey })

  // Un lugar nuevo (otro sector o coordenada) reemplaza la selección del analizador.
  useEffect(() => {
    if (!ready) return
    send({ type: 'select', mission: missionKey, sectorId: sector?.id, lat, lon })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, sector?.id, lat, lon, target.openedAt, send])
  // Cambiar la referencia planetaria no borra los resultados terrestres.
  useEffect(() => {
    if (ready) send({ type: 'reference', mission: missionKey })
  }, [ready, missionKey, send])
  useEffect(() => {
    if (ready) send({ type: 'tab', tab })
  }, [ready, tab, send])
  // Al volver a mostrar el panel se reajustan mapa y visor dentro del iframe.
  useEffect(() => {
    if (ready && isVisible) send({ type: 'tab', tab })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVisible])

  useEffect(() => {
    function receive(event) {
      if (!isTrustedLabMessage(event, iframeRef.current?.contentWindow, window.location.origin)) return
      const data = event.data
      if (data.type === 'analysis' || data.type === 'analysis-error') {
        const waiting = typeof data.requestId === 'string' && pending.current.get(data.requestId)
        if (!waiting) return
        pending.current.delete(data.requestId)
        clearTimeout(waiting.timer)
        if (data.type === 'analysis-error') waiting.reject(new Error(typeof data.message === 'string' ? data.message.slice(0, 300) : 'El analizador no pudo preparar el análisis.'))
        else {
          try {
            waiting.resolve(parseLabAnalysis(data.record))
          } catch (error) {
            waiting.reject(error)
          }
        }
        return
      }
      if (data.type === 'ready') setReady(true)
      if (data.type === 'height' && Number.isFinite(data.height)) setFrameHeight(Math.max(320, Math.min(20000, data.height)))
      if (data.type === 'selected' && typeof data.site === 'string') setSiteName(data.site)
      if (data.type === 'busy') setResult((previous) => data.busy ? { ...previous, status: 'busy', summary: null } : previous.status === 'busy' ? { ...previous, status: previous.summary ? 'ready' : 'idle' } : previous)
      if (data.type === 'status') setResult((previous) => ({ ...previous, message: data.message, kind: data.kind }))
      if (data.type === 'results') {
        if (data.cleared) setResult({ status: 'idle', summary: null, message: '', kind: '' })
        else if (data.summary) {
          setResult((previous) => ({ ...previous, status: 'ready', summary: data.summary }))
          setFlashKey((value) => value + 1)
        }
      }
    }
    window.addEventListener('message', receive)
    return () => window.removeEventListener('message', receive)
  }, [])

  function goTo(id) {
    setTab(id)
    const container = scrollContainer?.current
    const bar = tabsRef.current
    if (container && bar && container.scrollTop > bar.offsetTop) {
      container.scrollTo({ top: bar.offsetTop - 8, behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
    }
  }

  const reference = REFERENCES[missionKey] ?? REFERENCES.marte
  const coordinateText = Number.isFinite(lat) && Number.isFinite(lon) ? `${nf(lat, 4)}°, ${nf(lon, 4)}°` : null

  return (
    <section className="gp" aria-label="Conoce tu terreno · GeoPendiente">
      <header className="gp-head">
        <button type="button" className="gp-back" onClick={onClose}><ArrowLeft size={16} aria-hidden="true" /> {returnLabel}</button>
        <div className="gp-head-grid">
          <div className="min-w-0">
            <div className="o-kicker">Conoce tu terreno · GeoPendiente</div>
            <h1 className="o-title mt-1">{target.name}</h1>
            <p className="gp-place">
              <span>{target.place}</span>
              {target.code && <span>· {target.code}</span>}
              {coordinateText && !String(target.code).includes('°') && <span>· {coordinateText}</span>}
              {siteName && siteName !== target.name && <span className="gp-badge">Ficha activa: {siteName}</span>}
            </p>
          </div>
          <div className="gp-head-actions">
            <div className="gp-ref" role="radiogroup" aria-label="Referencia planetaria">
              <span className="o-eyebrow">Comparar con</span>
              <div className="gp-ref-options">
                {Object.entries(REFERENCES).map(([key, ref]) => (
                  <button
                    key={key}
                    type="button"
                    role="radio"
                    data-body={key}
                    aria-checked={missionKey === key}
                    className="o-chip"
                    onClick={() => onChangeMission?.(key)}
                  >
                    <span className="h-2 w-2 rounded-full bg-mint-400" aria-hidden="true" /> {ref.short}
                  </button>
                ))}
              </div>
            </div>
            <button type="button" className="o-btn-secondary" onClick={onOpenPrecision}>
              <FlaskConical size={16} aria-hidden="true" /> Laboratorio técnico
            </button>
          </div>
        </div>
      </header>

      <div ref={tabsRef} className="gp-tabs-wrap">
        <TabBar active={tab} onChange={goTo} />
      </div>

      <div id="gp-panel" role="tabpanel" aria-labelledby={`gp-tab-${tab}`} className="gp-panel">
        <p key={tab} className="gp-lead o-swap">
          <current.icon size={16} aria-hidden="true" /> <span>{current.lead}</span>
        </p>
        {tab === 'pendientes' && <ResultSummary state={result} compact flashKey={flashKey} />}
        {tab === 'biblioteca' && (
          <TeamCloudPanel cloud={cloud} hasResult={result.status === 'ready'} showLibrary onOpened={() => goTo('relieve')} />
        )}
        <div className={`gp-frame-shell ${ready ? '' : 'is-loading'}`}>
          {!ready && (
            <div className="gp-frame-loading" role="status"><span className="o-spinner" aria-hidden="true" /> Iniciando las herramientas de GeoPendiente…</div>
          )}
          <iframe
            ref={iframeRef}
            title={`GeoPendiente · ${current.label}`}
            src={`${standalone}?embed=1`}
            className="gp-frame"
            style={{ height: `${frameHeight}px` }}
          />
        </div>
        {tab === 'ubicacion' && <ResultSummary state={result} onGoTo={goTo} flashKey={flashKey} />}
        {tab === 'ubicacion' && <TeamCloudPanel cloud={cloud} hasResult={result.status === 'ready'} />}
      </div>

      <footer className="gp-foot">
        <p className="o-legend">
          Las elevaciones terrestres se consultan en modelos digitales (SRTM 30 m o Copernicus GLO-90). Los valores de {reference.label} provienen de referencias del catálogo; las superficies sin DEM numérico se muestran como aproximaciones visuales etiquetadas.
        </p>
        <a className="gp-ext" href={standalone} target="_blank" rel="noreferrer">
          Abrir GeoPendiente en otra pestaña <ExternalLink size={14} aria-hidden="true" />
        </a>
      </footer>
    </section>
  )
}
