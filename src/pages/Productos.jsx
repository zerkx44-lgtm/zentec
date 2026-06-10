import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'

const empty = { nombre: '', modelo: '', descripcion: '', precio: '', imagen_url: '', clave_sat: '', unidad_sat: 'H87', activo: true }

export default function Productos() {
  const [productos, setProductos] = useState([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(empty)
  const [guardando, setGuardando] = useState(false)
  const [msg, setMsg] = useState(null)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)
    const { data } = await supabase.from('productos').select('*').order('nombre')
    setProductos(data || [])
    setLoading(false)
  }

  async function guardar() {
    if (!form.nombre.trim()) return setMsg({ type: 'error', text: 'El nombre es requerido' })
    if (!form.precio) return setMsg({ type: 'error', text: 'El precio es requerido' })
    setGuardando(true)
    const payload = { ...form, precio: parseFloat(form.precio) }
    const { error } = form.id
      ? await supabase.from('productos').update(payload).eq('id', form.id)
      : await supabase.from('productos').insert(payload)
    if (error) { setMsg({ type: 'error', text: error.message }); setGuardando(false); return }
    setMsg({ type: 'success', text: 'Producto guardado' })
    setTimeout(() => { setModal(false); setMsg(null); cargar() }, 1000)
    setGuardando(false)
  }

  async function toggleActivo(p) {
    await supabase.from('productos').update({ activo: !p.activo }).eq('id', p.id)
    cargar()
  }

  const filtrados = productos.filter(p =>
    p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    (p.modelo || '').toLowerCase().includes(busqueda.toLowerCase())
  )

  return (
    <>
      <div className="page-header">
        <span className="page-title">Catálogo de productos</span>
        <button className="btn btn-primary" onClick={() => { setForm(empty); setMsg(null); setModal(true) }}>
          <i className="ti ti-plus" /> Nuevo producto
        </button>
      </div>

      <div className="search-wrap">
        <input placeholder="Buscar por nombre o modelo..." value={busqueda} onChange={e => setBusqueda(e.target.value)} />
      </div>

      <div className="card">
        {loading ? <div className="loading">Cargando...</div> : filtrados.length === 0 ? (
          <div className="empty"><i className="ti ti-box" /><p>Sin productos registrados</p></div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Nombre</th><th>Modelo</th><th>Precio</th><th>Clave SAT</th><th>Estado</th><th></th></tr></thead>
              <tbody>
                {filtrados.map(p => (
                  <tr key={p.id}>
                    <td>
                      <strong>{p.nombre}</strong>
                      {p.descripcion && <div style={{ fontSize: 11, color: 'var(--text-3)', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.descripcion}</div>}
                    </td>
                    <td>{p.modelo || '—'}</td>
                    <td>${parseFloat(p.precio).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
                    <td>{p.clave_sat || '—'}</td>
                    <td>
                      <span className={`badge ${p.activo ? 'badge-green' : 'badge-gray'}`} style={{ cursor: 'pointer' }} onClick={() => toggleActivo(p)}>
                        {p.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td>
                      <button className="btn btn-sm" onClick={() => { setForm(p); setMsg(null); setModal(true) }}><i className="ti ti-edit" /></button>
                    </td>
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
              <span className="modal-title">{form.id ? 'Editar producto' : 'Nuevo producto'}</span>
              <button className="btn btn-sm" onClick={() => setModal(false)}><i className="ti ti-x" /></button>
            </div>
            <div className="modal-body">
              {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}
              <div className="form-grid">
                <div className="form-group form-full"><label>Nombre *</label><input value={form.nombre} onChange={e => setForm({...form, nombre: e.target.value})} /></div>
                <div className="form-group"><label>Modelo / SKU</label><input value={form.modelo || ''} onChange={e => setForm({...form, modelo: e.target.value})} /></div>
                <div className="form-group"><label>Precio *</label><input type="number" step="0.01" value={form.precio} onChange={e => setForm({...form, precio: e.target.value})} /></div>
                <div className="form-group form-full"><label>Descripción</label><textarea rows={3} value={form.descripcion || ''} onChange={e => setForm({...form, descripcion: e.target.value})} /></div>
                <div className="form-group form-full"><label>URL de imagen</label><input value={form.imagen_url || ''} onChange={e => setForm({...form, imagen_url: e.target.value})} placeholder="https://..." /></div>
                <div className="section-label">Datos SAT</div>
                <div className="form-group"><label>Clave producto SAT</label><input value={form.clave_sat || ''} onChange={e => setForm({...form, clave_sat: e.target.value})} placeholder="ej. 46171803" /></div>
                <div className="form-group"><label>Unidad SAT</label><input value={form.unidad_sat || 'H87'} onChange={e => setForm({...form, unidad_sat: e.target.value})} /></div>
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
