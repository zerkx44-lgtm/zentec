import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'

export default function Cotizaciones() {
  const [cotizaciones, setCotizaciones] = useState([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)
    const { data } = await supabase
      .from('cotizaciones')
      .select('*, clientes(nombre)')
      .order('consecutivo', { ascending: false })
    setCotizaciones(data || [])
    setLoading(false)
  }

  async function cambiarEstado(id, estado) {
    await supabase.from('cotizaciones').update({ estado }).eq('id', id)
    cargar()
  }

  const estadoBadge = (e) => {
    const map = { borrador: 'badge-gray', enviada: 'badge-blue', aprobada: 'badge-green', rechazada: 'badge-red' }
    return map[e] || 'badge-gray'
  }

  const filtradas = cotizaciones.filter(c => {
    const q = busqueda.toLowerCase()
    return (
      String(c.consecutivo).includes(q) ||
      (c.clientes?.nombre || '').toLowerCase().includes(q)
    )
  })

  return (
    <>
      <div className="page-header">
        <span className="page-title">Cotizaciones</span>
        <a href="https://claude.ai" target="_blank" className="btn btn-primary">
          <i className="ti ti-plus" /> Nueva cotización
        </a>
      </div>

      <div style={{ background: '#E1F5EE', border: '1px solid #9FE1CB', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#085041', display: 'flex', gap: 8, marginBottom: '1rem', alignItems: 'center' }}>
        <i className="ti ti-brand-whatsapp" style={{ fontSize: 17 }} />
        Para crear una nueva cotización, envía un mensaje por WhatsApp o escríbeme directamente en Claude.
      </div>

      <div className="search-wrap">
        <input placeholder="Buscar por número o cliente..." value={busqueda} onChange={e => setBusqueda(e.target.value)} />
      </div>

      <div className="card">
        {loading ? <div className="loading">Cargando...</div> : filtradas.length === 0 ? (
          <div className="empty"><i className="ti ti-file-invoice" /><p>Sin cotizaciones</p></div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Núm.</th><th>Cliente</th><th>Total</th><th>Fecha</th><th>Estado</th><th>Canva</th><th></th></tr>
              </thead>
              <tbody>
                {filtradas.map(c => (
                  <tr key={c.id}>
                    <td><strong>COT-{c.consecutivo}</strong></td>
                    <td>{c.clientes?.nombre || '—'}</td>
                    <td>${parseFloat(c.total || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
                    <td>{new Date(c.fecha).toLocaleDateString('es-MX')}</td>
                    <td>
                      <select
                        value={c.estado}
                        onChange={e => cambiarEstado(c.id, e.target.value)}
                        style={{ fontSize: 12, padding: '3px 6px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)' }}
                      >
                        <option value="borrador">Borrador</option>
                        <option value="enviada">Enviada</option>
                        <option value="aprobada">Aprobada</option>
                        <option value="rechazada">Rechazada</option>
                      </select>
                    </td>
                    <td>
                      {c.canva_url
                        ? <a href={c.canva_url} target="_blank" className="btn btn-sm"><i className="ti ti-external-link" /> Ver</a>
                        : <span style={{ color: 'var(--text-3)', fontSize: 12 }}>—</span>
                      }
                    </td>
                    <td>
                      <span className={`badge ${estadoBadge(c.estado)}`}>{c.estado}</span>
                    </td>
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
