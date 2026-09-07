import { useState } from 'react'
import { useAuth } from '../lib/AuthContext.jsx'

// Supabase devuelve los errores de auth en inglés. Los traducimos a algo
// que se entienda, sin decir nunca si el correo existe o no.
function traducirError(error) {
  const m = (error?.message || '').toLowerCase()
  if (m.includes('invalid login credentials')) return 'Correo o contraseña incorrectos.'
  if (m.includes('email not confirmed')) return 'La cuenta todavía no está confirmada.'
  if (m.includes('too many requests') || m.includes('rate limit'))
    return 'Demasiados intentos. Espera un momento y vuelve a intentar.'
  if (m.includes('failed to fetch') || m.includes('network'))
    return 'Sin conexión con el servidor. Revisa tu internet.'
  return error?.message || 'No se pudo iniciar sesión.'
}

export default function Login() {
  const { entrar } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [verPass, setVerPass] = useState(false)
  const [error, setError] = useState(null)
  const [enviando, setEnviando] = useState(false)

  async function onSubmit(e) {
    e.preventDefault()
    if (enviando) return
    setError(null)

    if (!email.trim() || !password) {
      setError('Escribe tu correo y contraseña.')
      return
    }

    setEnviando(true)
    const err = await entrar(email, password)
    if (err) {
      setError(traducirError(err))
      setEnviando(false)
      return
    }
    // Si funcionó no apagamos 'enviando': onAuthStateChange desmonta esta
    // pantalla enseguida y apagarlo solo provoca un parpadeo del botón.
  }

  return (
    <div className="login-screen">
      <form className="login-card" onSubmit={onSubmit}>
        <div className="login-brand">
          <h1>ZENTEC</h1>
          <p>Sistema de gestión</p>
        </div>

        {error && (
          <div className="alert alert-error" role="alert">
            <i className="ti ti-alert-circle" />
            <span>{error}</span>
          </div>
        )}

        <div className="form-group">
          <label htmlFor="email">Correo</label>
          <input
            id="email"
            type="email"
            autoComplete="username"
            autoFocus
            value={email}
            onChange={e => setEmail(e.target.value)}
            disabled={enviando}
          />
        </div>

        <div className="form-group">
          <label htmlFor="password">Contraseña</label>
          <div className="input-con-boton">
            <input
              id="password"
              type={verPass ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              disabled={enviando}
            />
            <button
              type="button"
              className="ver-pass"
              onClick={() => setVerPass(v => !v)}
              aria-label={verPass ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              tabIndex={-1}
            >
              <i className={verPass ? 'ti ti-eye-off' : 'ti ti-eye'} />
            </button>
          </div>
        </div>

        <button type="submit" className="btn btn-primary login-btn" disabled={enviando}>
          {enviando ? 'Entrando...' : 'Entrar'}
        </button>

        <p className="login-pie">
          ¿Olvidaste tu contraseña? Pídele a un administrador que la restablezca.
        </p>
      </form>
    </div>
  )
}
