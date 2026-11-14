import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL?.trim()
const publicKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()

export const remoteRequested = Boolean(url || publicKey)
function configuredClient() {
  if (!url || !publicKey) return null
  try {
    return createClient(url, publicKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    })
  } catch {
    return null
  }
}

const client = configuredClient()

export async function loadPublishedCatalog() {
  if (!client) throw new Error('Configura la URL y la clave publicable de Supabase.')
  const responses = await Promise.all([
    client.from('sectores').select('*').order('id'),
    client.from('referencias').select('*'),
    client.from('fuentes').select('*'),
  ])
  const failure = responses.find(({ error }) => error)
  if (failure) throw new Error(failure.error.message)
  const [sectores, referencias, fuentes] = responses.map(({ data }) => data)
  return { sectores, referencias, fuentes }
}
