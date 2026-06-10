import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'

export default function Dashboard() {
  const [stats, setStats] = useState({ cotizaciones: 0, ordenes: 0, facturas: 0, ingresos: 0 })
  const [recientes, setRecientes] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [{ count: cot }, { count: ord }, { data: facts }, { data: ultimas }] = await Promise.all([
        supabase.from('cotizaciones').select('*', { count: 'exact', head: true }),
        supabase.from('ordenes_trabajo').select('*', { count: 'exact', head: true }).eq('estado', 'en_proceso'),
        supabase.from('facturas').select('total, pagado_total'),
        supabase.from('cotizaciones').select('consecutivo, fecha, total, estado, clientes(nombre)').order('consecutivo', { ascending: false }).limit(5)
      ])
      const pendientes = facts?.filter(f => !f.pagado_total).length || 0
      const ingresos = facts?.filter(f => f.pagado_total).reduce((a, b) => a + parseFloat(b.total), 0) || 0
      setStats({ cotizaciones: cot || 0, ordenes: ord || 0, facturas: pendientes, ingresos })
      setRecientes(ultimas || [])
      setLoading(false)
    }
    load()
  }, [])

  const estadoBadge = (e) => {
    const map = { borrador: 'badge-gray', enviada: 'badge-blue', aprobada: 'badge-green', rechazada: 'badge-red' }
    return map[e] || 'badge-gray'
  }

  if (loading) return <div className="loading">Cargando...</div>

  return (
    <>
      <div className="page-header">
        <span className="page-title">Dashboard</span>
        <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
      </div>

      <div className="metrics">
        <div className="metric">
          <div className="metric-label">Cotizaciones total</div>
          <div className="metric-value">{stats.cotizaciones}</div>
        </div>
        <div className="metric">
          <div className="metric-label">Órdenes activas</div>
          <div className="metric-value">{stats.ordenes}</div>
        </div>
        <div className="metric">
          <div className="metric-label">Facturas pendientes</div>
          <div className="metric-value">{stats.facturas}</div>
        </div>
        <div className="metric">
          <div className="metric-label">Ingresos cobrados</div>
          <div className="metric-value">${stats.ingresos.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Últimas cotizaciones</div>
        {recientes.length === 0 ? (
          <div className="empty"><i className="ti ti-file-invoice" /><p>Sin cotizaciones aún</p></div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Núm.</th><th>Cliente</th><th>Total</th><th>Fecha</th><th>Estado</th></tr></thead>
              <tbody>
                {recientes.map(c => (
                  <tr key={c.consecutivo}>
                    <td><strong>COT-{c.consecutivo}</strong></td>
                    <td>{c.clientes?.nombre || '—'}</td>
                    <td>${parseFloat(c.total || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
                    <td>{new Date(c.fecha).toLocaleDateString('es-MX')}</td>
                    <td><span className={`badge ${estadoBadge(c.estado)}`}>{c.estado}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}
