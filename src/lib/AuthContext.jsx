import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from './supabase.js'

const AuthContext = createContext(null)

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}

export function AuthProvider({ children }) {
  const [sesion, setSesion] = useState(null)
  const [perfil, setPerfil] = useState(null)
  // 'cargando' arranca en true para no parpadear el login mientras
  // supabase-js recupera la sesión de localStorage.
  const [cargando, setCargando] = useState(true)

  // supabase-js dispara onAuthStateChange muchas veces por sesión: al
  // renovar el token, al volver el foco a la pestaña, al cambiar de
  // visibilidad. Sin estos dos candados, cada evento repetía la consulta
  // del perfil y se acumulaban cientos de peticiones idénticas.
  const ultimoUsuario = useRef(null)
  const perfilesDisponible = useRef(true)

  const cargarPerfil = useCallback(async (userId) => {
    if (!userId) {
      setPerfil(null)
      ultimoUsuario.current = null
      return
    }
    // Mismo usuario que la última vez: el perfil que ya está en memoria sirve.
    if (ultimoUsuario.current === userId) return
    // La tabla perfiles todavía no existe: no tiene caso volver a preguntar.
    if (!perfilesDisponible.current) return

    const { data, error } = await supabase
      .from('perfiles')
      .select('id, nombre, rol, activo')
      .eq('id', userId)
      .maybeSingle()

    if (error) {
      // 42P01 = la tabla no existe; PGRST205 = PostgREST no la encuentra en
      // su caché de esquema. En ambos casos es que falta crearla, así que se
      // deja de consultar hasta que se recargue la página.
      if (error.code === '42P01' || error.code === 'PGRST205' || error.code === 'PGRST106') {
        perfilesDisponible.current = false
        console.warn('La tabla `perfiles` no existe: el panel funciona sin roles.')
      } else {
        console.warn('No se pudo leer el perfil del usuario:', error.message)
      }
      setPerfil(null)
      ultimoUsuario.current = userId
      return
    }

    ultimoUsuario.current = userId
    setPerfil(data)
  }, [])

  useEffect(() => {
    let vigente = true

    supabase.auth.getSession().then(async ({ data }) => {
      if (!vigente) return
      setSesion(data.session)
      await cargarPerfil(data.session?.user?.id)
      if (vigente) setCargando(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange(async (evento, nuevaSesion) => {
      if (!vigente) return
      setSesion(nuevaSesion)
      // TOKEN_REFRESHED no cambia de usuario, así que no toca el perfil.
      if (evento !== 'TOKEN_REFRESHED') {
        await cargarPerfil(nuevaSesion?.user?.id)
      }
      if (vigente) setCargando(false)
    })

    return () => { vigente = false; sub.subscription.unsubscribe() }
  }, [cargarPerfil])

  async function entrar(email, password) {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password
    })
    return error
  }

  async function salir() {
    await supabase.auth.signOut()
    setSesion(null)
    setPerfil(null)
    ultimoUsuario.current = null
  }

  const valor = {
    sesion,
    usuario: sesion?.user ?? null,
    perfil,
    rol: perfil?.rol ?? null,
    esAdmin: perfil?.rol === 'admin',
    cargando,
    entrar,
    salir
  }

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>
}
