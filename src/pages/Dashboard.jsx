import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'

// Una cotización enviada que lleva más de esto sin moverse ya es un
// pendiente de seguimiento, no una espera normal.
const DIAS_SIN_RESPUESTA = 3

const money = (n) =>
  '$' + parseFloat(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })

const BADGE = {
  borrador: 'badge-gray',
  en_revision: 'badge-amber',
  aprobada: 'badge-green',
  enviada: 'badge-blue',
  rechazada: 'badge-red'
}

const etiquetaEstado = (e) => (e || '').replace('_', ' ')

function diasDesde(iso) {
  if (!iso) return null
  const d = new Date(iso)
  if (isNaN(d)) return null
  return Math.floor((Date.now() - d.getTime()) / 86400000)
}

function fechaCorta(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return isNaN(d) ? '—' : d.toLocaleDateString('es-MX')
}

export default function Dashboard() {
  const [datos, setDatos] = useState(null)
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState(null)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)

    const haceUnaSemana = new Date(Date.now() - 7 * 86400000).toISOString()

    const [prospectos, cotizaciones, ordenes] = await Promise.all([
      supabase.from('bot_prospectos')
        .select('id, numero, nombre, push_name, created_at')
        .gte('created_at', haceUnaSemana)
        .order('created_at', { ascending: false }),
      supabase.from('cotizaciones')
        .select('id, consecutivo, total, estado, created_at, enviada_at, clientes(nombre)')
        .order('consecutivo', { ascending: false }),
      supabase.from('ordenes_trabajo').select('id, estado')
    ])

    const errores = [prospectos.error, cotizaciones.error, ordenes.error].filter(Boolean)
    if (errores.length) {
      setMsg({ type: 'error', text: 'Algunos datos no se pudieron cargar: ' + errores[0].message })
    }

    const cots = cotizaciones.data || []
    const porRevisar = cots.filter(c => c.estado === 'borrador' || c.estado === 'en_revision')
    const enviadas = cots.filter(c => c.estado === 'enviada')
    const sinRespuesta = enviadas.filter(c => {
      const d = diasDesde(c.enviada_at || c.created_at)
      return d !== null && d >= DIAS_SIN_RESPUESTA
    })

    // ordenes_trabajo está vacía por ahora; "abierta" es todo lo que no
    // se terminó ni se canceló, para no depender de un estado exacto.
    const abiertas = (ordenes.data || []).filter(
      o => !['terminada', 'cancelada', 'completada'].includes((o.estado || '').toLowerCase()))

    setDatos({
      prospectosSemana: (prospectos.data || []).length,
      prospectos: prospectos.data || [],
      porRevisar,
      sinRespuesta,
      ordenesAbiertas: abiertas.length,
      recientes: cots.slice(0, 6),
      valorPorRevisar: porRevisar.reduce((a, c) => a + parseFloat(c.total || 0), 0)
    })
    setLoading(false)
  }

  if (loading) return <div className="loading">Cargando...</div>

  const d = datos

  return (
    <>
      <div className="page-header">
        <span className="page-title">Dashboard</span>
        <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
          {new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </span>
      </div>

      {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

      <div className="metrics">
        <Link to="/prospectos" className="metric metric-liga">
          <div className="metric-label">Prospectos esta semana</div>
          <div className="metric-value">{d.prospectosSemana}</div>
          <div className="metric-sub">llegados por WhatsApp</div>
        </Link>

        <Link to="/cotizaciones" className="metric metric-liga">
          <div className="metric-label">Pendientes de revisar</div>
          <div className="metric-value">{d.porRevisar.length}</div>
          <div className="metric-sub">
            {d.valorPorRevisar > 0 ? money(d.valorPorRevisar) + ' en juego' : 'nada esperando'}
          </div>
        </Link>

        <Link to="/cotizaciones" className="metric metric-liga">
          <div className="metric-label">Enviadas sin respuesta</div>
          <div className="metric-value">{d.sinRespuesta.length}</div>
          <div className="metric-sub">más de {DIAS_SIN_RESPUESTA} días</div>
        </Link>

        <Link to="/ordenes" className="metric metric-liga">
          <div className="metric-label">Órdenes abiertas</div>
          <div className="metric-value">{d.ordenesAbiertas}</div>
          <div className="metric-sub">instalaciones en curso</div>
        </Link>
      </div>

      <div className="dos-columnas">
        <div className="card">
          <div className="card-title">
            Cotizaciones recientes
            <Link to="/cotizaciones" className="card-liga">Ver todas</Link>
          </div>
          {d.recientes.length === 0 ? (
            <div className="empty"><i className="ti ti-file-invoice" /><p>Sin cotizaciones</p></div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Folio</th><th>Cliente</th><th>Total</th><th>Estado</th></tr></thead>
                <tbody>
                  {d.recientes.map(c => (
                    <tr key={c.id}>
                      <td><strong>COT-{c.consecutivo}</strong></td>
                      <td>{c.clientes?.nombre || '—'}</td>
                      <td className="num">{money(c.total)}</td>
                      <td><span className={`badge ${BADGE[c.estado] || 'badge-gray'}`}>{etiquetaEstado(c.estado)}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-title">
            Necesitan seguimiento
            <span className="card-liga">{d.sinRespuesta.length}</span>
          </div>
          {d.sinRespuesta.length === 0 ? (
            <div className="empty"><i className="ti ti-check" /><p>Nada rezagado</p></div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Folio</th><th>Cliente</th><th>Enviada</th><th>Días</th></tr></thead>
                <tbody>
                  {d.sinRespuesta.slice(0, 6).map(c => {
                    const dias = diasDesde(c.enviada_at || c.created_at)
                    return (
                      <tr key={c.id}>
                        <td><strong>COT-{c.consecutivo}</strong></td>
                        <td>{c.clientes?.nombre || '—'}</td>
                        <td className="num">{fechaCorta(c.enviada_at || c.created_at)}</td>
                        <td>
                          <span className={'badge ' + (dias >= 7 ? 'badge-red' : 'badge-amber')}>
                            {dias} d
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {d.prospectos.length > 0 && (
        <div className="card">
          <div className="card-title">
            Prospectos nuevos
            <Link to="/conversaciones" className="card-liga">Ver conversaciones</Link>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Nombre</th><th>Número</th><th>Llegó</th></tr></thead>
              <tbody>
                {d.prospectos.slice(0, 6).map(p => (
                  <tr key={p.id}>
                    <td><strong>{p.nombre || p.push_name || 'Sin nombre'}</strong></td>
                    <td className="num">{p.numero}</td>
                    <td className="num">{fechaCorta(p.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  )
}
