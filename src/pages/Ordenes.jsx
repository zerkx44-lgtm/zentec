import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'

const empty = { cotizacion_id: '', descripcion: '', estado: 'pendiente', fecha_inicio: '', fecha_fin: '' }

export default function Ordenes() {
  const [ordenes, setOrdenes] = useState([])
  const [cotizaciones, setCotizaciones] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(empty)
  const [guardando, setGuardando] = useState(false)
  const [msg, setMsg] = useState(null)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)
    const [{ data: ords }, { data: cots }] = await Promise.all([
      supabase.from('ordenes_trabajo').select('*, cotizaciones(consecutivo, clientes(nombre))').order('created_at', { ascending: false }),
      supabase.from('cotizaciones').select('id, consecutivo, clientes(nombre)').eq('estado', 'aprobada')
    ])
    setOrdenes(ords || [])
    setCotizaciones(cots || [])
    setLoading(false)
  }

  async function guardar() {
    if (!form.descripcion.trim()) return setMsg({ type: 'error', text: 'La descripción es requerida' })
    setGuardando(true)
    const { error } = form.id
      ? await supabase.from('ordenes_trabajo').update(form).eq('id', form.id)
      : await supabase.from('ordenes_trabajo').insert(form)
    if (error) { setMsg({ type: 'error', text: error.message }); setGuardando(false); return }
    setMsg({ type: 'success', text: 'Orden guardada' })
    setTimeout(() => { setModal(false); setMsg(null); cargar() }, 1000)
    setGuardando(false)
  }

  const estadoBadge = (e) => {
    const map = { pendiente: 'badge-gray', en_proceso: 'badge-amber', completada: 'badge-green', cancelada: 'badge-red' }
    return map[e] || 'badge-gray'
  }

  return (
    <>
      <div className="page-header">
        <span className="page-title">Órdenes de trabajo</span>
        <button className="btn btn-primary" onClick={() => { setForm(empty); setMsg(null); setModal(true) }}>
          <i className="ti ti-plus" /> Nueva orden
        </button>
      </div>

      <div className="card">
        {loading ? <div className="loading">Cargando...</div> : ordenes.length === 0 ? (
          <div className="empty"><i className="ti ti-tool" /><p>Sin órdenes de trabajo</p></div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Cotización</th><th>Cliente</th><th>Descripción</th><th>Inicio</th><th>Fin</th><th>Estado</th><th></th></tr></thead>
              <tbody>
                {ordenes.map(o => (
                  <tr key={o.id}>
                    <td>{o.cotizaciones ? `COT-${o.cotizaciones.consecutivo}` : '—'}</td>
                    <td>{o.cotizaciones?.clientes?.nombre || '—'}</td>
                    <td style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.descripcion}</td>
                    <td>{o.fecha_inicio ? new Date(o.fecha_inicio).toLocaleDateString('es-MX') : '—'}</td>
                    <td>{o.fecha_fin ? new Date(o.fecha_fin).toLocaleDateString('es-MX') : '—'}</td>
                    <td><span className={`badge ${estadoBadge(o.estado)}`}>{o.estado.replace('_', ' ')}</span></td>
                    <td><button className="btn btn-sm" onClick={() => { setForm(o); setMsg(null); setModal(true) }}><i className="ti ti-edit" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title">{form.id ? 'Editar orden' : 'Nueva orden de trabajo'}</span>
              <button className="btn btn-sm" onClick={() => setModal(false)}><i className="ti ti-x" /></button>
            </div>
            <div className="modal-body">
              {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}
              <div className="form-grid">
                <div className="form-group form-full">
                  <label>Cotización relacionada</label>
                  <select value={form.cotizacion_id || ''} onChange={e => setForm({...form, cotizacion_id: e.target.value})}>
                    <option value="">Sin cotización</option>
                    {cotizaciones.map(c => <option key={c.id} value={c.id}>COT-{c.consecutivo} — {c.clientes?.nombre}</option>)}
                  </select>
                </div>
                <div className="form-group form-full">
                  <label>Descripción *</label>
                  <textarea rows={3} value={form.descripcion} onChange={e => setForm({...form, descripcion: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>Fecha inicio</label>
                  <input type="date" value={form.fecha_inicio || ''} onChange={e => setForm({...form, fecha_inicio: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>Fecha fin estimada</label>
                  <input type="date" value={form.fecha_fin || ''} onChange={e => setForm({...form, fecha_fin: e.target.value})} />
                </div>
                <div className="form-group form-full">
                  <label>Estado</label>
                  <select value={form.estado} onChange={e => setForm({...form, estado: e.target.value})}>
                    <option value="pendiente">Pendiente</option>
                    <option value="en_proceso">En proceso</option>
                    <option value="completada">Completada</option>
                    <option value="cancelada">Cancelada</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={() => setModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={guardar} disabled={guardando}>{guardando ? 'Guardando...' : 'Guardar'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
