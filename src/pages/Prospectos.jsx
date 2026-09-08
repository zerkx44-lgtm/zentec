import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'

// Las solicitudes descartadas las marca bot_upsert cuando quedaron a medias.
// No son trabajo pendiente, así que se ocultan salvo que se pidan.
const ETAPA_OCULTA = 'descartada'

const BADGE_ETAPA = {
  abierta: 'badge-blue',
  cerrada: 'badge-green',
  descartada: 'badge-gray'
}

function diasDesde(iso) {
  if (!iso) return null
  const d = new Date(iso)
  if (isNaN(d)) return null
  return Math.floor((Date.now() - d.getTime()) / 86400000)
}

function fechaCorta(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return isNaN(d) ? '—' : d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })
}

// El color de la antigüedad es la señal más útil de la tabla: dice qué se
// está enfriando sin tener que leer fechas.
function badgeAntiguedad(dias) {
  if (dias === null) return 'badge-gray'
  if (dias >= 14) return 'badge-red'
  if (dias >= 5) return 'badge-amber'
  return 'badge-green'
}

export default function Prospectos() {
  const [filas, setFilas] = useState([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [etapa, setEtapa] = useState('abiertas')
  const [servicio, setServicio] = useState('')
  const [msg, setMsg] = useState(null)
  const navegar = useNavigate()

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)

    const [{ data: prospectos, error: e1 }, { data: solicitudes, error: e2 }] =
      await Promise.all([
        supabase.from('bot_prospectos').select('*').order('created_at', { ascending: false }),
        supabase.from('bot_solicitudes').select('*').order('created_at', { ascending: false })
      ])

    if (e1 || e2) {
      setMsg({ type: 'error', text: 'No se pudieron cargar los prospectos: ' + (e1 || e2).message })
      setLoading(false)
      return
    }

    const porId = {}
    for (const p of prospectos || []) porId[p.id] = p

    // Una fila por solicitud, más los prospectos que nunca llegaron a pedir
    // nada: esos también son seguimiento pendiente.
    const salida = (solicitudes || []).map(s => {
      const p = porId[s.prospecto_id]
      return {
        clave: 's-' + s.id,
        numero: p?.numero || null,
        nombre: p?.nombre || p?.push_name || null,
        email: p?.email || null,
        servicio: s.servicio,
        detalles: s.detalles,
        direccion: s.direccion,
        notas: s.notas,
        etapa: s.etapa,
        fecha: s.updated_at || s.created_at,
        creada: s.created_at
      }
    })

    const conSolicitud = new Set((solicitudes || []).map(s => s.prospecto_id))
    for (const p of prospectos || []) {
      if (conSolicitud.has(p.id)) continue
      salida.push({
        clave: 'p-' + p.id,
        numero: p.numero,
        nombre: p.nombre || p.push_name || null,
        email: p.email,
        servicio: null,
        etapa: 'sin_solicitud',
        fecha: p.created_at,
        creada: p.created_at
      })
    }

    salida.sort((a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0))
    setFilas(salida)
    setLoading(false)
  }

  const servicios = [...new Set(filas.map(f => f.servicio).filter(Boolean))].sort()

  const q = busqueda.toLowerCase().trim()
  // Sin dígitos escritos no se compara contra el número: includes('') es
  // true y dejaría pasar todas las filas que tengan teléfono.
  const digitos = q.replace(/\D/g, '')
  const filtradas = filas.filter(f => {
    if (etapa === 'abiertas' && f.etapa !== 'abierta' && f.etapa !== 'sin_solicitud') return false
    if (etapa === 'cerradas' && f.etapa !== 'cerrada') return false
    if (etapa === 'descartadas' && f.etapa !== ETAPA_OCULTA) return false
    if (etapa === 'frias') {
      const d = diasDesde(f.fecha)
      if (f.etapa !== 'abierta' || d === null || d < 5) return false
    }
    if (servicio && f.servicio !== servicio) return false
    if (!q) return true
    return (f.nombre || '').toLowerCase().includes(q) ||
           (digitos && (f.numero || '').includes(digitos)) ||
           (f.servicio || '').toLowerCase().includes(q) ||
           (f.detalles || '').toLowerCase().includes(q)
  })

  const cuenta = (fn) => filas.filter(fn).length
  const abiertas = cuenta(f => f.etapa === 'abierta' || f.etapa === 'sin_solicitud')
  const frias = cuenta(f => f.etapa === 'abierta' && (diasDesde(f.fecha) ?? 0) >= 5)

  return (
    <>
      <div className="page-header">
        <span className="page-title">Pipeline de prospectos</span>
        <button className="btn btn-sm" onClick={cargar} disabled={loading}>
          <i className="ti ti-refresh" /> Actualizar
        </button>
      </div>

      {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

      <div className="search-wrap">
        <input
          placeholder="Buscar por nombre, número, servicio o detalles..."
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
        />
        <select className="select-estado" value={servicio} onChange={e => setServicio(e.target.value)}>
          <option value="">Todos los servicios</option>
          {servicios.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <div className="filtros">
          <button className={'btn btn-sm' + (etapa === 'abiertas' ? ' btn-activo' : '')} onClick={() => setEtapa('abiertas')}>
            Abiertas <span className="conteo">{abiertas}</span>
          </button>
          <button className={'btn btn-sm' + (etapa === 'frias' ? ' btn-activo' : '')} onClick={() => setEtapa('frias')}>
            Se enfrían <span className="conteo">{frias}</span>
          </button>
          <button className={'btn btn-sm' + (etapa === 'cerradas' ? ' btn-activo' : '')} onClick={() => setEtapa('cerradas')}>
            Cerradas <span className="conteo">{cuenta(f => f.etapa === 'cerrada')}</span>
          </button>
          <button className={'btn btn-sm' + (etapa === 'descartadas' ? ' btn-activo' : '')} onClick={() => setEtapa('descartadas')}>
            Descartadas <span className="conteo">{cuenta(f => f.etapa === ETAPA_OCULTA)}</span>
          </button>
        </div>
      </div>

      <div className="card">
        {loading ? <div className="loading">Cargando...</div> : filtradas.length === 0 ? (
          <div className="empty"><i className="ti ti-user-search" /><p>Nada que coincida con estos filtros</p></div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Prospecto</th><th>Servicio</th><th>Dirección</th>
                  <th>Etapa</th><th>Sin moverse</th><th></th>
                </tr>
              </thead>
              <tbody>
                {filtradas.map(f => {
                  const dias = diasDesde(f.fecha)
                  return (
                    <tr key={f.clave}>
                      <td>
                        <strong>{f.nombre || f.numero || 'Sin nombre'}</strong>
                        {f.nombre && f.numero && <div className="celda-sub">{f.numero}</div>}
                      </td>
                      <td>
                        {f.servicio || <span style={{ color: 'var(--text-3)' }}>—</span>}
                        {f.detalles && <div className="celda-sub">{f.detalles}</div>}
                      </td>
                      <td>{f.direccion ? <span className="celda-sub" style={{ maxWidth: 200 }}>{f.direccion}</span> : '—'}</td>
                      <td>
                        {f.etapa === 'sin_solicitud'
                          ? <span className="badge badge-amber">solo escribió</span>
                          : <span className={'badge ' + (BADGE_ETAPA[f.etapa] || 'badge-gray')}>{f.etapa}</span>}
                      </td>
                      <td>
                        <span className={'badge ' + badgeAntiguedad(dias)}>
                          {dias === null ? '—' : dias === 0 ? 'hoy' : dias + ' d'}
                        </span>
                        <div className="celda-sub">{fechaCorta(f.fecha)}</div>
                      </td>
                      <td>
                        <div className="acciones">
                          {f.numero && (
                            <>
                              <button
                                className="btn btn-sm"
                                onClick={() => navegar(`/conversaciones?numero=${encodeURIComponent(f.numero)}`)}
                                title="Ver conversación"
                              >
                                <i className="ti ti-messages" />
                              </button>
                              <a
                                className="btn btn-sm"
                                href={`https://wa.me/${f.numero.length === 10 ? '521' + f.numero : f.numero}`}
                                target="_blank" rel="noreferrer"
                                title="Escribir por WhatsApp"
                              >
                                <i className="ti ti-brand-whatsapp" />
                              </a>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="pie-nota">
        Cada fila es una solicitud. Quien escribió pero no llegó a pedir nada
        aparece como <strong style={{ color: 'var(--text-2)' }}>solo escribió</strong> —
        también es seguimiento pendiente. Las descartadas las marca el bot cuando
        una solicitud quedó a medias, por eso están fuera de la vista por defecto.
      </p>
    </>
  )
}
