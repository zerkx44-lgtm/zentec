import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_KEY

if (!url || !key) {
  throw new Error(
    'Faltan VITE_SUPABASE_URL o VITE_SUPABASE_KEY. Revisa el archivo .env.'
  )
}

export const supabase = createClient(url, key, {
  auth: {
    // La sesión vive en localStorage y se renueva sola: al recargar la
    // página o volver al día siguiente, Marcos sigue dentro.
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'zentec-panel-auth'
  }
})
