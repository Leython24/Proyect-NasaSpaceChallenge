import { useCallback, useEffect, useRef, useState } from 'react'
import { Cloud, CloudOff, FolderOpen, LogIn, LogOut, RefreshCw, Users } from 'lucide-react'
import { configurationIssue, supabase } from '../data/supabase.js'
import {
  REFERENCE_BY_MISSION,
  describeCloudError,
  fetchMemberships,
  listTeamAnalyses,
  loadTeamAnalysis,
  saveTeamAnalysis,
} from '../data/teamAnalyses.js'

/**
 * Sesión de Supabase Auth. El cliente la guarda en el navegador y la renueva,
 * así que sigue activa al recargar; aquí solo se escucha su estado.
 */
export function useCloudSession() {
  const [state, setState] = useState(() => ({ status: supabase ? 'loading' : 'unavailable', session: null }))
  useEffect(() => {
    if (!supabase) return undefined
    let active = true
    supabase.auth.getSession().then(({ data }) => {
      if (active) setState({ status: 'ready', session: data.session ?? null })
    })
    // Solo se actualiza el estado: llamar a Supabase dentro de este aviso puede bloquearlo.
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setState({ status: 'ready', session: session ?? null })
    })
    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [])
  const signIn = useCallback(async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (error) {
      throw new Error(/invalid login credentials/i.test(error.message)
        ? 'Correo o contraseña incorrectos.'
        : /email not confirmed/i.test(error.message)
          ? 'La cuenta aún no confirmó su correo.'
          : describeCloudError(error))
    }
  }, [])
  const signOut = useCallback(() => supabase.auth.signOut(), [])
  return { ...state, user: state.session?.user ?? null, signIn, signOut }
}

/**
 * Estado compartido de «Guardar para el equipo» (equipos, guardado y lista).
 * requestAnalysis() pide al analizador el cálculo actual, ya validado.
 */
export function useTeamCloud({ requestAnalysis, notifySaved, openInLab, missionKey, resultKey }) {
  const auth = useCloudSession()
  const userId = auth.user?.id ?? null
  const [teams, setTeams] = useState({ status: 'idle', list: [], message: '' })
  const [teamId, setTeamId] = useState(null)
  const [save, setSave] = useState({ status: 'idle', message: '', savedAt: null, recordId: null })
  const [library, setLibrary] = useState({ status: 'idle', items: [], message: '' })
  const [opening, setOpening] = useState(null)
  const saving = useRef(false)

  useEffect(() => {
    if (!userId) {
      setTeams({ status: 'idle', list: [], message: '' })
      setTeamId(null)
      setLibrary({ status: 'idle', items: [], message: '' })
      return
    }
    let active = true
    setTeams((previous) => ({ ...previous, status: 'loading' }))
    fetchMemberships(supabase, userId)
      .then((list) => {
        if (!active) return
        setTeams({ status: 'ready', list, message: '' })
        setTeamId((current) => (list.some((team) => team.id === current) ? current : list[0]?.id ?? null))
      })
      .catch((error) => active && setTeams({ status: 'error', list: [], message: describeCloudError(error) }))
    return () => {
      active = false
    }
  }, [userId])

  // Un cálculo nuevo deja el estado «guardado» del anterior sin efecto.
  useEffect(() => {
    setSave((previous) => (previous.status === 'saving' ? previous : { status: 'idle', message: '', savedAt: null, recordId: null }))
  }, [resultKey])

  const refreshLibrary = useCallback(async () => {
    if (!teamId) return
    setLibrary((previous) => ({ ...previous, status: 'loading' }))
    try {
      setLibrary({ status: 'ready', items: await listTeamAnalyses(supabase, teamId), message: '' })
    } catch (error) {
      setLibrary((previous) => ({ ...previous, status: 'error', message: describeCloudError(error) }))
    }
  }, [teamId])
  useEffect(() => {
    if (teamId) refreshLibrary()
  }, [teamId, refreshLibrary])

  const saveForTeam = useCallback(async () => {
    if (saving.current || !teamId) return
    saving.current = true
    setSave((previous) => ({ ...previous, status: 'saving', message: '' }))
    let record = null
    try {
      // El analizador guarda primero la ficha local y devuelve siempre el mismo id
      // para este lugar: reintentar actualiza el registro de la nube, no lo duplica.
      record = await requestAnalysis()
      await saveTeamAnalysis(supabase, record, teamId, [REFERENCE_BY_MISSION[missionKey] ?? REFERENCE_BY_MISSION.marte])
      const savedAt = new Date().toISOString()
      notifySaved(record, savedAt)
      setSave({ status: 'saved', message: '', savedAt, recordId: record.id })
      refreshLibrary()
    } catch (error) {
      setSave({
        status: 'error',
        message: describeCloudError(error),
        savedAt: null,
        recordId: record?.id ?? null,
        localKept: Boolean(record),
      })
    } finally {
      saving.current = false
    }
  }, [teamId, missionKey, requestAnalysis, notifySaved, refreshLibrary])

  const openAnalysis = useCallback(async (id) => {
    setOpening(id)
    try {
      const record = await loadTeamAnalysis(supabase, id)
      openInLab(record, record.authorId === userId)
      setLibrary((previous) => ({ ...previous, message: '' }))
      return true
    } catch (error) {
      setLibrary((previous) => ({ ...previous, message: describeCloudError(error) }))
      return false
    } finally {
      setOpening(null)
    }
  }, [openInLab, userId])

  return { auth, teams, teamId, setTeamId, save, saveForTeam, library, refreshLibrary, openAnalysis, opening }
}

const when = (iso) =>
  iso ? new Date(iso).toLocaleString('es-PE', { dateStyle: 'medium', timeStyle: 'short' }) : ''
const nf = (value, digits = 1) =>
  value === null || value === undefined || !Number.isFinite(Number(value))
    ? 'sin dato'
    : Number(value).toLocaleString('es-PE', { minimumFractionDigits: digits, maximumFractionDigits: digits })

function SignInForm({ onSignIn }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [state, setState] = useState({ busy: false, message: '' })
  async function submit(event) {
    event.preventDefault()
    setState({ busy: true, message: '' })
    try {
      await onSignIn(email, password)
      setState({ busy: false, message: '' })
    } catch (error) {
      setState({ busy: false, message: error.message })
    }
  }
  return (
    <form className="gp-cloud-login" onSubmit={submit}>
      <label>
        <span className="o-stat-label">Correo</span>
        <input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
      </label>
      <label>
        <span className="o-stat-label">Contraseña</span>
        <input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} />
      </label>
      <button type="submit" className="o-btn-primary" disabled={state.busy}>
        {state.busy ? <span className="o-spinner" aria-hidden="true" /> : <LogIn size={16} aria-hidden="true" />} Iniciar sesión
      </button>
      {state.message && <p className="gp-cloud-msg is-error" role="alert">{state.message}</p>}
    </form>
  )
}

/** Panel de «Guardar para el equipo». `showLibrary` añade la lista de análisis del equipo. */
export function TeamCloudPanel({ cloud, hasResult, showLibrary = false, onOpened }) {
  const { auth, teams, teamId, setTeamId, save, saveForTeam, library, refreshLibrary, openAnalysis, opening } = cloud

  if (auth.status === 'unavailable') {
    return (
      <section className="gp-cloud is-muted" aria-label="Guardar para el equipo">
        <div className="gp-cloud-head"><CloudOff size={16} aria-hidden="true" /> <span className="o-kicker">Guardar para el equipo</span></div>
        <p className="o-legend mt-1">{configurationIssue} Puedes explorar, calcular y usar la biblioteca local; la nube del equipo no está disponible.</p>
      </section>
    )
  }

  const team = teams.list.find((item) => item.id === teamId)
  return (
    <section className="gp-cloud" aria-label="Guardar para el equipo" aria-busy={save.status === 'saving' || undefined}>
      <div className="gp-cloud-head">
        <span className="inline-flex items-center gap-2"><Cloud size={16} aria-hidden="true" /> <span className="o-kicker">Guardar para el equipo</span></span>
        {auth.user && (
          <span className="gp-cloud-user">
            {auth.user.email}
            <button type="button" className="o-btn-ghost" onClick={auth.signOut}><LogOut size={14} aria-hidden="true" /> Salir</button>
          </span>
        )}
      </div>

      {auth.status === 'loading' && <p className="o-legend mt-1"><span className="o-spinner" aria-hidden="true" /> Recuperando la sesión…</p>}

      {auth.status === 'ready' && !auth.user && (
        <>
          <p className="o-body mt-1">Explorar y calcular no requiere cuenta. Para guardar en la nube, inicia sesión con una cuenta que pertenezca a tu equipo.</p>
          <SignInForm onSignIn={auth.signIn} />
        </>
      )}

      {auth.user && teams.status === 'loading' && <p className="o-legend mt-1"><span className="o-spinner" aria-hidden="true" /> Consultando tus equipos…</p>}
      {auth.user && teams.status === 'error' && <p className="gp-cloud-msg is-error" role="alert">{teams.message}</p>}
      {auth.user && teams.status === 'ready' && teams.list.length === 0 && (
        <p className="gp-cloud-msg" role="status">
          <Users size={14} aria-hidden="true" /> Tu cuenta no pertenece a ningún equipo. Pide a un administrador que te agregue; mientras tanto, tus análisis se guardan en la biblioteca local.
        </p>
      )}

      {auth.user && team && (
        <>
          <div className="gp-cloud-row">
            {teams.list.length > 1 ? (
              <label className="gp-cloud-team">
                <span className="o-stat-label">Equipo</span>
                <select value={teamId} onChange={(event) => setTeamId(event.target.value)}>
                  {teams.list.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </label>
            ) : (
              <span className="gp-badge"><Users size={13} aria-hidden="true" /> {team.name}{team.role === 'admin' ? ' · administración' : ''}</span>
            )}
            <button type="button" className="o-btn-primary" onClick={saveForTeam} disabled={!hasResult || save.status === 'saving'}>
              {save.status === 'saving' ? <span className="o-spinner" aria-hidden="true" /> : <Cloud size={16} aria-hidden="true" />}
              {save.status === 'saving' ? 'Guardando…' : save.status === 'saved' ? 'Guardar de nuevo' : 'Guardar para el equipo'}
            </button>
          </div>
          <div aria-live="polite">
            {!hasResult && save.status === 'idle' && <p className="o-legend mt-2">Calcula un terreno para poder guardarlo.</p>}
            {save.status === 'saved' && (
              <p className="gp-cloud-msg is-ok" role="status">✓ Guardado para «{team.name}» el {when(save.savedAt)}. La copia local sigue en la biblioteca de este navegador.</p>
            )}
            {save.status === 'error' && (
              <div className="gp-cloud-msg is-error" role="alert">
                <p>{save.message}</p>
                {save.localKept && <p className="mt-1">El análisis quedó guardado en la biblioteca local.</p>}
                <button type="button" className="o-btn-secondary mt-2" onClick={saveForTeam}>
                  <RefreshCw size={14} aria-hidden="true" /> Reintentar (actualiza el mismo registro)
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {showLibrary && auth.user && team && (
        <div className="gp-cloud-library">
          <div className="gp-cloud-head">
            <span className="o-stat-label">Análisis del equipo</span>
            <button type="button" className="o-btn-ghost" onClick={refreshLibrary} disabled={library.status === 'loading'}>
              <RefreshCw size={14} aria-hidden="true" /> Actualizar
            </button>
          </div>
          {library.message && <p className="gp-cloud-msg is-error" role="alert">{library.message}</p>}
          {library.status === 'loading' && library.items.length === 0 && <p className="o-legend"><span className="o-spinner" aria-hidden="true" /> Cargando…</p>}
          {library.status === 'ready' && library.items.length === 0 && <p className="o-legend">Tu equipo aún no ha guardado análisis.</p>}
          {library.items.length > 0 && (
            <ul className="gp-cloud-list">
              {library.items.map((item) => (
                <li key={item.id}>
                  <div className="min-w-0">
                    <strong>{item.nombre}</strong>
                    <small>
                      {item.autor_id === auth.user.id ? 'Tuyo' : 'De otro miembro'} · {when(item.actualizado_en)} · {item.fuente_producto} · media {nf(item.pendiente_media_pct)} % · desnivel {nf(item.desnivel_m, 0)} m · cobertura {nf(item.cobertura_pct, 0)} %
                    </small>
                  </div>
                  <button
                    type="button"
                    className="o-btn-secondary"
                    disabled={opening === item.id}
                    onClick={async () => { if (await openAnalysis(item.id)) onOpened?.() }}
                  >
                    {opening === item.id ? <span className="o-spinner" aria-hidden="true" /> : <FolderOpen size={14} aria-hidden="true" />} Abrir
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  )
}
