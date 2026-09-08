import { useEffect, useState, useRef, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'

// Cuántos mensajes se traen para armar la lista de contactos. Suficiente
// para un negocio de este tamaño, y evita bajarse el historial completo
// solo para saber quién escribió al último.
const MAX_RECIENTES = 1000

function fechaCorta(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d)) return ''
  const hoy = new Date()
  const mismoDia = d.toDateString() === hoy.toDateString()
  if (mismoDia) return d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
  const ayer = new Date(hoy); ayer.setDate(hoy.getDate() - 1)
  if (d.toDateString() === ayer.toDateString()) return 'Ayer'
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit' })
}

function fechaLarga(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d)) return ''
  return d.toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function diaDe(iso) {
  const d = new Date(iso)
  if (isNaN(d)) return ''
  return d.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })
}

// El bot guarda los turnos como 'user' / 'assistant'. Cualquier otra cosa
// se trata como del negocio, para no perder mensajes si aparece otro rol.
const esCliente = (rol) => (rol || '').toLowerCase() === 'user'

export default function Conversaciones() {
  const [contactos, setContactos] = useState([])
  const [prospectos, setProspectos] = useState({})
  const [solicitudes, setSolicitudes] = useState({})
  const [activo, setActivo] = useState(null)
  const [mensajes, setMensajes] = useState([])
  const [cargando, setCargando] = useState(true)
  const [cargandoChat, setCargandoChat] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [msg, setMsg] = useState(null)
  const finRef = useRef(null)
  const [params, setParams] = useSearchParams()

  useEffect(() => { cargarContactos() }, [])

  useEffect(() => {
    finRef.current?.scrollIntoView({ block: 'end' })
  }, [mensajes])

  // Se llega aquí desde Prospectos con ?numero=... para abrir ese chat
  // directo, en vez de dejar al usuario buscándolo en la lista.
  useEffect(() => {
    const numero = params.get('numero')
    if (!numero || cargando || activo) return
    abrirChat(numero)
    setParams({}, { replace: true })
  }, [params, cargando, activo])

  async function cargarContactos() {
    setCargando(true)

    // select('*') a propósito: así la pantalla no se rompe si alguna
    // columna opcional (solicitud_id, push_name) no existe todavía.
    const [{ data: convs, error: e1 }, { data: props }, { data: sols }] = await Promise.all([
      supabase.from('bot_conversaciones').select('*')
        .order('created_at', { ascending: false }).limit(MAX_RECIENTES),
      supabase.from('bot_prospectos').select('*'),
      supabase.from('bot_solicitudes').select('*')
    ])

    if (e1) {
      setMsg({ type: 'error', text: 'No se pudieron cargar las conversaciones: ' + e1.message })
      setCargando(false)
      return
    }

    const porNumero = {}
    for (const p of props || []) {
      if (p.numero) porNumero[p.numero] = p
    }
    setProspectos(porNumero)

    const porId = {}
    for (const sol of sols || []) porId[sol.id] = sol
    setSolicitudes(porId)

    // Los mensajes vienen del más reciente al más viejo, así que el
    // primero que se ve de cada número es su último mensaje.
    const vistos = new Map()
    for (const c of convs || []) {
      if (!c.numero || vistos.has(c.numero)) continue
      vistos.set(c.numero, {
        numero: c.numero,
        ultimo: c.mensaje || '',
        rol: c.rol,
        fecha: c.created_at
      })
    }

    setContactos([...vistos.values()])
    setCargando(false)
  }

  async function abrirChat(numero) {
    setActivo(numero)
    setCargandoChat(true)
    setMensajes([])

    const { data, error } = await supabase
      .from('bot_conversaciones').select('*')
      .eq('numero', numero)
      .order('created_at', { ascending: true })

    if (error) {
      setMsg({ type: 'error', text: 'No se pudo abrir la conversación: ' + error.message })
      setCargandoChat(false)
      return
    }

    setMensajes(data || [])
    setCargandoChat(false)
  }

  const nombreDe = (numero) => {
    const p = prospectos[numero]
    return p?.nombre || p?.push_name || null
  }

  const q = busqueda.toLowerCase().trim()
  // Solo se compara contra el teléfono si se escribieron dígitos: buscar
  // por dígitos vacíos hace que todas las filas con teléfono coincidan.
  const digitos = q.replace(/\D/g, '')
  const filtrados = useMemo(() => contactos.filter(c => {
    if (!q) return true
    const nombre = (nombreDe(c.numero) || '').toLowerCase()
    return (digitos && c.numero.includes(digitos)) ||
           nombre.includes(q) ||
           (c.ultimo || '').toLowerCase().includes(q)
  }), [contactos, q, prospectos])

  // Separadores de día dentro del chat: ubican en el tiempo sin repetir
  // la fecha en cada burbuja.
  const conSeparadores = useMemo(() => {
    const salida = []
    let diaPrevio = null
    let solicitudPrevia = null
    for (const m of mensajes) {
      const dia = diaDe(m.created_at)
      if (dia && dia !== diaPrevio) {
        salida.push({ tipo: 'dia', id: 'dia-' + dia + m.id, texto: dia })
        diaPrevio = dia
      }
      if (m.solicitud_id && m.solicitud_id !== solicitudPrevia) {
        const sol = solicitudes[m.solicitud_id]
        salida.push({
          tipo: 'solicitud',
          id: 'sol-' + m.solicitud_id + m.id,
          servicio: sol?.servicio || 'Solicitud',
          etapa: sol?.etapa,
          detalles: sol?.detalles
        })
        solicitudPrevia = m.solicitud_id
      }
      salida.push({ tipo: 'msg', ...m })
    }
    return salida
  }, [mensajes, solicitudes])

  const contactoActivo = contactos.find(c => c.numero === activo)

  return (
    <>
      <div className="page-header">
        <span className="page-title">Conversaciones</span>
        <button className="btn btn-sm" onClick={cargarContactos} disabled={cargando}>
          <i className="ti ti-refresh" /> Actualizar
        </button>
      </div>

      {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

      <div className="chat-layout">
        <aside className="chat-lista">
          <div className="chat-buscar">
            <input
              placeholder="Buscar por nombre, número o texto..."
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
            />
          </div>

          {cargando ? (
            <div className="loading">Cargando...</div>
          ) : filtrados.length === 0 ? (
            <div className="empty" style={{ padding: '2rem 1rem' }}>
              <i className="ti ti-message-off" />
              <p>{contactos.length === 0 ? 'Sin conversaciones' : 'Nada coincide'}</p>
            </div>
          ) : (
            <div className="chat-contactos">
              {filtrados.map(c => (
                <button
                  key={c.numero}
                  className={'chat-contacto' + (c.numero === activo ? ' activo' : '')}
                  onClick={() => abrirChat(c.numero)}
                >
                  <div className="chat-avatar">
                    {(nombreDe(c.numero) || c.numero).slice(0, 1).toUpperCase()}
                  </div>
                  <div className="chat-contacto-texto">
                    <div className="chat-contacto-linea">
                      <span className="chat-contacto-nombre">
                        {nombreDe(c.numero) || c.numero}
                      </span>
                      <span className="chat-contacto-hora">{fechaCorta(c.fecha)}</span>
                    </div>
                    <div className="chat-contacto-ultimo">
                      {esCliente(c.rol) ? '' : 'Bot: '}{c.ultimo}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </aside>

        <section className="chat-panel">
          {!activo ? (
            <div className="empty">
              <i className="ti ti-messages" />
              <p>Elige una conversación de la lista</p>
            </div>
          ) : (
            <>
              <header className="chat-encabezado">
                <div>
                  <div className="chat-titulo">{nombreDe(activo) || activo}</div>
                  <div className="chat-subtitulo">
                    {nombreDe(activo) ? activo + ' · ' : ''}
                    {mensajes.length} mensaje{mensajes.length === 1 ? '' : 's'}
                  </div>
                </div>
                <a
                  className="btn btn-sm"
                  href={`https://wa.me/${activo.length === 10 ? '521' + activo : activo}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <i className="ti ti-brand-whatsapp" /> Abrir en WhatsApp
                </a>
              </header>

              <div className="chat-mensajes">
                {cargandoChat ? (
                  <div className="loading">Cargando conversación...</div>
                ) : conSeparadores.map(m => (
                  m.tipo === 'dia' ? (
                    <div className="chat-dia" key={m.id}><span>{m.texto}</span></div>
                  ) : m.tipo === 'solicitud' ? (
                    <div className="chat-solicitud" key={m.id}>
                      <div className="chat-solicitud-titulo">
                        <i className="ti ti-file-text" />
                        <span>{m.servicio}</span>
                        {m.etapa && <span className={'badge ' + (m.etapa === 'descartada' ? 'badge-gray' : 'badge-blue')}>{m.etapa}</span>}
                      </div>
                      {m.detalles && <div className="chat-solicitud-detalle">{m.detalles}</div>}
                    </div>
                  ) : (
                    <div key={m.id} className={'burbuja ' + (esCliente(m.rol) ? 'de-cliente' : 'de-bot')}>
                      <div className="burbuja-texto">{m.mensaje}</div>
                      <div className="burbuja-hora">{fechaLarga(m.created_at)}</div>
                    </div>
                  )
                ))}
                <div ref={finRef} />
              </div>
            </>
          )}
        </section>
      </div>

      {contactoActivo && (
        <p className="pie-nota">
          Solo lectura. Para responderle a un cliente se usa WhatsApp, que es
          donde el bot mantiene la conversación.
        </p>
      )}
    </>
  )
}
