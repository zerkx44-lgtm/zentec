import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'

export default function Facturas() {
  const [facturas, setFacturas] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)
    const { data } = await supabase
      .from('facturas')
      .select('*, cotizaciones(consecutivo, clientes(nombre))')
      .order('created_at', { ascending: false })
    setFacturas(data || [])
    setLoading(false)
  }

  async function marcarAnticipo(id) {
    await supabase.from('facturas').update({ anticipo_pagado: true, fecha_pago_anticipo: new Date().toISOString().split('T')[0] }).eq('id', id)
    cargar()
  }

  async function marcarPagado(id) {
    await supabase.from('facturas').update({ pagado_total: true, saldo_pendiente: 0, fecha_pago_total: new Date().toISOString().split('T')[0] }).eq('id', id)
    cargar()
  }

  const estadoBadge = (f) => {
    if (f.pagado_total) return <span className="badge badge-green">Pagado</span>
    if (f.requiere_anticipo && !f.anticipo_pagado) return <span className="badge badge-red">Sin anticipo</span>
    if (f.requiere_anticipo && f.anticipo_pagado && !f.pagado_total) return <span className="badge badge-amber">Saldo pendiente</span>
    return <span className="badge badge-amber">Pendiente</span>
  }

  return (
    <>
      <div className="page-header">
        <span className="page-title">Facturas</span>
      </div>

      <div style={{ background: '#FAEEDA', border: '1px solid #FAC775', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#854F0B', display: 'flex', gap: 8, marginBottom: '1rem', alignItems: 'center' }}>
        <i className="ti ti-info-circle" style={{ fontSize: 17 }} />
        El módulo de timbrado CFDI se habilitará próximamente. Por ahora puedes registrar y dar seguimiento a tus facturas.
      </div>

      <div className="card">
        {loading ? <div className="loading">Cargando...</div> : facturas.length === 0 ? (
          <div className="empty"><i className="ti ti-receipt" /><p>Sin facturas registradas</p></div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Núm.</th><th>Cliente</th><th>Total</th><th>Anticipo</th><th>Saldo</th><th>Vence</th><th>Estado</th><th></th></tr>
              </thead>
              <tbody>
                {facturas.map(f => (
                  <tr key={f.id}>
                    <td><strong>{f.numero_factura || '—'}</strong></td>
                    <td>{f.cotizaciones?.clientes?.nombre || '—'}</td>
                    <td>${parseFloat(f.total).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
                    <td>
                      {f.requiere_anticipo
                        ? <span style={{ color: f.anticipo_pagado ? 'var(--green)' : 'var(--amber)' }}>
                            ${parseFloat(f.monto_anticipo || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                            {f.anticipo_pagado ? ' ✓' : ''}
                          </span>
                        : '—'}
                    </td>
                    <td>${parseFloat(f.saldo_pendiente || f.total).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
                    <td>{f.fecha_vencimiento ? new Date(f.fecha_vencimiento).toLocaleDateString('es-MX') : '—'}</td>
                    <td>{estadoBadge(f)}</td>
                    <td style={{ display: 'flex', gap: 4 }}>
                      {f.requiere_anticipo && !f.anticipo_pagado && (
                        <button className="btn btn-sm" style={{ fontSize: 11 }} onClick={() => marcarAnticipo(f.id)}>Anticipo recibido</button>
                      )}
                      {!f.pagado_total && (f.anticipo_pagado || !f.requiere_anticipo) && (
                        <button className="btn btn-sm btn-primary" style={{ fontSize: 11 }} onClick={() => marcarPagado(f.id)}>Marcar pagado</button>
                      )}
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
