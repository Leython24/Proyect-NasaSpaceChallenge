import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL?.trim()
const publicKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()

export const remoteRequested = Boolean(url || publicKey)
/** Motivo por el que la nube no está disponible (null si está configurada). */
export const configurationIssue = !remoteRequested
  ? 'Supabase no está configurado en este entorno.'
  : !url
    ? 'Falta VITE_SUPABASE_URL en el entorno.'
    : !publicKey
      ? 'Falta VITE_SUPABASE_PUBLISHABLE_KEY en el entorno.'
      : null

function configuredClient() {
  if (!url || !publicKey) return null
  try {
    // Un solo cliente para el catálogo y para la sesión: la sesión se guarda en
    // el almacenamiento del navegador y se renueva sola, así sobrevive a recargas.
    return createClient(url, publicKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'orbita-auth' },
    })
  } catch {
    return null
  }
}

export const supabase = configuredClient()

export async function loadPublishedCatalog() {
  if (!supabase) throw new Error(configurationIssue ?? 'Configura la URL y la clave publicable de Supabase.')
  const responses = await Promise.all([
    supabase.from('sectores').select('*').order('id'),
    supabase.from('referencias').select('*'),
    supabase.from('fuentes').select('*'),
  ])
  const failure = responses.find(({ error }) => error)
  if (failure) throw new Error(failure.error.message)
  const [sectores, referencias, fuentes] = responses.map(({ data }) => data)
  return { sectores, referencias, fuentes }
}
