import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'

const empty = { nombre: '', direccion: '', telefono: '', email: '', rfc: '', razon_social: '', uso_cfdi: 'G03', regimen_fiscal: '' }

export default function Clientes() {
  const [clientes, setClientes] = useState([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(empty)
  const [guardando, setGuardando] = useState(false)
  const [msg, setMsg] = useState(null)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)
    const { data } = await supabase.from('clientes').select('*').order('nombre')
    setClientes(data || [])
    setLoading(false)
  }

  async function guardar() {
    if (!form.nombre.trim()) return setMsg({ type: 'error', text: 'El nombre es requerido' })
    setGuardando(true)
    const { error } = form.id
      ? await supabase.from('clientes').update(form).eq('id', form.id)
      : await supabase.from('clientes').insert(form)
    if (error) { setMsg({ type: 'error', text: error.message }); setGuardando(false); return }
    setMsg({ type: 'success', text: form.id ? 'Cliente actualizado' : 'Cliente creado' })
    setTimeout(() => { setModal(false); setMsg(null); cargar() }, 1000)
    setGuardando(false)
  }

  async function eliminar(id) {
    if (!confirm('¿Eliminar este cliente?')) return
    await supabase.from('clientes').delete().eq('id', id)
    cargar()
  }

  const filtrados = clientes.filter(c => c.nombre.toLowerCase().includes(busqueda.toLowerCase()) || (c.email || '').toLowerCase().includes(busqueda.toLowerCase()))

  return (
    <>
      <div className="page-header">
        <span className="page-title">Clientes</span>
        <button className="btn btn-primary" onClick={() => { setForm(empty); setMsg(null); setModal(true) }}>
          <i className="ti ti-plus" /> Nuevo cliente
        </button>
      </div>

      <div className="search-wrap">
        <input placeholder="Buscar por nombre o email..." value={busqueda} onChange={e => setBusqueda(e.target.value)} />
      </div>

      <div className="card">
        {loading ? <div className="loading">Cargando...</div> : filtrados.length === 0 ? (
          <div className="empty"><i className="ti ti-users" /><p>Sin clientes registrados</p></div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Nombre</th><th>Teléfono</th><th>Email</th><th>RFC</th><th></th></tr></thead>
              <tbody>
                {filtrados.map(c => (
                  <tr key={c.id}>
                    <td><strong>{c.nombre}</strong>{c.razon_social && <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{c.razon_social}</div>}</td>
                    <td>{c.telefono || '—'}</td>
                    <td>{c.email || '—'}</td>
                    <td>{c.rfc || '—'}</td>
                    <td style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-sm" onClick={() => { setForm(c); setMsg(null); setModal(true) }}><i className="ti ti-edit" /></button>
                      <button className="btn btn-sm" style={{ color: 'var(--red)' }} onClick={() => eliminar(c.id)}><i className="ti ti-trash" /></button>
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
              <span className="modal-title">{form.id ? 'Editar cliente' : 'Nuevo cliente'}</span>
              <button className="btn btn-sm" onClick={() => setModal(false)}><i className="ti ti-x" /></button>
            </div>
            <div className="modal-body">
              {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}
              <div className="form-grid">
                <div className="form-group form-full"><label>Nombre *</label><input value={form.nombre} onChange={e => setForm({...form, nombre: e.target.value})} placeholder="Nombre del cliente" /></div>
                <div className="form-group"><label>Teléfono</label><input value={form.telefono || ''} onChange={e => setForm({...form, telefono: e.target.value})} /></div>
                <div className="form-group"><label>Email</label><input value={form.email || ''} onChange={e => setForm({...form, email: e.target.value})} /></div>
                <div className="form-group form-full"><label>Dirección</label><input value={form.direccion || ''} onChange={e => setForm({...form, direccion: e.target.value})} /></div>
                <div className="section-label">Datos fiscales</div>
                <div className="form-group"><label>RFC</label><input value={form.rfc || ''} onChange={e => setForm({...form, rfc: e.target.value})} /></div>
                <div className="form-group"><label>Razón social</label><input value={form.razon_social || ''} onChange={e => setForm({...form, razon_social: e.target.value})} /></div>
                <div className="form-group"><label>Uso CFDI</label>
                  <select value={form.uso_cfdi || 'G03'} onChange={e => setForm({...form, uso_cfdi: e.target.value})}>
                    <option value="G01">G01 - Adquisición de mercancias</option>
                    <option value="G03">G03 - Gastos en general</option>
                    <option value="I01">I01 - Construcciones</option>
                    <option value="P01">P01 - Por definir</option>
                  </select>
                </div>
                <div className="form-group"><label>Régimen fiscal</label><input value={form.regimen_fiscal || ''} onChange={e => setForm({...form, regimen_fiscal: e.target.value})} placeholder="ej. 612" /></div>
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
