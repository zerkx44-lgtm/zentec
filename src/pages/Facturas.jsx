import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'

const money = (n) =>
  '$' + parseFloat(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })

export default function Facturas() {
  const [facturas, setFacturas] = useState([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState(null)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)
    const { data, error } = await supabase
      .from('facturas')
      .select('*, cotizaciones(consecutivo, clientes(nombre))')
      .order('created_at', { ascending: false })
    if (error) setMsg({ type: 'error', text: 'No se pudieron cargar las facturas: ' + error.message })
    setFacturas(data || [])
    setLoading(false)
  }

  const hoy = () => new Date().toISOString().split('T')[0]

  async function marcarAnticipo(f) {
    if (!confirm(`¿Registrar el anticipo de ${money(f.monto_anticipo)} como recibido?`)) return
    const total = parseFloat(f.total || 0)
    const anticipo = parseFloat(f.monto_anticipo || 0)
    const { error } = await supabase.from('facturas').update({
      anticipo_pagado: true,
      fecha_pago_anticipo: hoy(),
      // Cobrar el anticipo baja el saldo: si no, la cobranza sigue
      // reportando como pendiente dinero que ya entró.
      saldo_pendiente: Math.max(total - anticipo, 0)
    }).eq('id', f.id)
    if (error) { setMsg({ type: 'error', text: 'No se pudo registrar el anticipo: ' + error.message }); return }
    setMsg(null)
    cargar()
  }

  async function marcarPagado(f) {
    if (!confirm(`¿Marcar la factura como pagada por completo (${money(f.total)})?`)) return
    const { error } = await supabase.from('facturas').update({
      pagado_total: true,
      saldo_pendiente: 0,
      fecha_pago_total: hoy()
    }).eq('id', f.id)
    if (error) { setMsg({ type: 'error', text: 'No se pudo registrar el pago: ' + error.message }); return }
    setMsg(null)
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

      {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

      <div className="alert alert-aviso">
        <i className="ti ti-info-circle" />
        <span>
          El timbrado CFDI se hace por fuera. Aquí se registra la factura, el
          anticipo y el saldo para poder darles seguimiento.
        </span>
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
                    <td className="num">{money(f.total)}</td>
                    <td>
                      {f.requiere_anticipo
                        ? <span style={{ color: f.anticipo_pagado ? 'var(--green)' : 'var(--amber)' }}>
                            {money(f.monto_anticipo)}
                            {f.anticipo_pagado ? ' ✓' : ''}
                          </span>
                        : '—'}
                    </td>
                    <td className="num">{money(f.saldo_pendiente ?? f.total)}</td>
                    <td>{f.fecha_vencimiento ? new Date(f.fecha_vencimiento).toLocaleDateString('es-MX') : '—'}</td>
                    <td>{estadoBadge(f)}</td>
                    <td style={{ display: 'flex', gap: 4 }}>
                      {f.requiere_anticipo && !f.anticipo_pagado && (
                        <button className="btn btn-sm" style={{ fontSize: 11 }} onClick={() => marcarAnticipo(f)}>Anticipo recibido</button>
                      )}
                      {!f.pagado_total && (f.anticipo_pagado || !f.requiere_anticipo) && (
                        <button className="btn btn-sm btn-primary" style={{ fontSize: 11 }} onClick={() => marcarPagado(f)}>Marcar pagado</button>
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
