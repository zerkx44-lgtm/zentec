import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase.js'

const BUCKET = 'Productos'
const MAX_MB = 5
const TIPOS_OK = ['image/jpeg', 'image/png', 'image/webp']

const empty = {
  nombre: '', modelo: '', descripcion: '', precio: '',
  imagen_url: '', clave_sat: '', unidad_sat: 'H87', activo: true
}

const money = (n) =>
  '$' + parseFloat(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })

export default function Productos() {
  const [productos, setProductos] = useState([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [filtro, setFiltro] = useState('todos') // todos | sin_imagen | inactivos
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(empty)
  const [guardando, setGuardando] = useState(false)
  const [subiendo, setSubiendo] = useState(false)
  const [msg, setMsg] = useState(null)
  const fileRef = useRef(null)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)
    const { data, error } = await supabase.from('productos').select('*').order('nombre')
    if (error) setMsg({ type: 'error', text: 'No se pudieron cargar los productos: ' + error.message })
    setProductos(data || [])
    setLoading(false)
  }

  // La imagen se sube en cuanto se elige, no al guardar: así se ve de
  // inmediato si el bucket la aceptó, en vez de descubrirlo al final.
  async function subirImagen(file) {
    if (!file) return
    if (!TIPOS_OK.includes(file.type)) {
      setMsg({ type: 'error', text: 'Solo se aceptan imágenes JPG, PNG o WebP.' })
      return
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      setMsg({ type: 'error', text: `La imagen pesa más de ${MAX_MB} MB. Comprímela antes de subirla.` })
      return
    }

    setSubiendo(true)
    setMsg(null)

    // Nombre propio para el archivo: evita choques entre productos y
    // evita que el navegador sirva la imagen vieja de caché al reemplazarla.
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
    const ruta = `${crypto.randomUUID()}.${ext}`

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(ruta, file, { cacheControl: '3600', upsert: false })

    if (error) {
      setSubiendo(false)
      const falta = /policy|not authorized|unauthorized|row-level/i.test(error.message)
      setMsg({
        type: 'error',
        text: falta
          ? 'El bucket no permite subir archivos todavía: falta la política de Storage para usuarios autenticados.'
          : 'No se pudo subir la imagen: ' + error.message
      })
      return
    }

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(ruta)
    setForm(f => ({ ...f, imagen_url: data.publicUrl }))
    setSubiendo(false)
    setMsg({ type: 'success', text: 'Imagen subida.' })
  }

  async function guardar() {
    if (!form.nombre.trim()) return setMsg({ type: 'error', text: 'El nombre es requerido' })
    if (form.precio === '' || isNaN(parseFloat(form.precio)))
      return setMsg({ type: 'error', text: 'El precio es requerido y debe ser un número' })

    setGuardando(true)

    // Solo las columnas que existen en la tabla: mandar de más hace fallar
    // el insert entero.
    const payload = {
      nombre: form.nombre.trim(),
      modelo: form.modelo?.trim() || null,
      descripcion: form.descripcion?.trim() || null,
      precio: parseFloat(form.precio),
      imagen_url: form.imagen_url || null,
      clave_sat: form.clave_sat?.trim() || null,
      unidad_sat: form.unidad_sat?.trim() || 'H87',
      activo: form.activo !== false
    }

    const { error } = form.id
      ? await supabase.from('productos').update(payload).eq('id', form.id)
      : await supabase.from('productos').insert(payload)

    setGuardando(false)
    if (error) { setMsg({ type: 'error', text: error.message }); return }

    setModal(false)
    setMsg(null)
    cargar()
  }

  async function toggleActivo(p) {
    const { error } = await supabase.from('productos').update({ activo: !p.activo }).eq('id', p.id)
    if (error) { setMsg({ type: 'error', text: 'No se pudo cambiar el estado: ' + error.message }); return }
    cargar()
  }

  function abrir(p) {
    setForm(p ? { ...p, precio: String(p.precio ?? '') } : empty)
    setMsg(null)
    setModal(true)
  }

  const q = busqueda.toLowerCase().trim()
  const filtrados = productos.filter(p => {
    const coincide = !q ||
      p.nombre.toLowerCase().includes(q) ||
      (p.modelo || '').toLowerCase().includes(q) ||
      (p.clave_sat || '').toLowerCase().includes(q)
    if (!coincide) return false
    if (filtro === 'sin_imagen') return !p.imagen_url
    if (filtro === 'inactivos') return p.activo === false
    return true
  })

  const sinImagen = productos.filter(p => !p.imagen_url).length

  return (
    <>
      <div className="page-header">
        <span className="page-title">Catálogo de productos</span>
        <button className="btn btn-primary" onClick={() => abrir(null)}>
          <i className="ti ti-plus" /> Nuevo producto
        </button>
      </div>

      {msg && !modal && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

      <div className="search-wrap">
        <input
          placeholder="Buscar por nombre, modelo o clave SAT..."
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
        />
        <div className="filtros">
          <button className={'btn btn-sm' + (filtro === 'todos' ? ' btn-activo' : '')} onClick={() => setFiltro('todos')}>
            Todos <span className="conteo">{productos.length}</span>
          </button>
          <button className={'btn btn-sm' + (filtro === 'sin_imagen' ? ' btn-activo' : '')} onClick={() => setFiltro('sin_imagen')}>
            Sin foto <span className="conteo">{sinImagen}</span>
          </button>
          <button className={'btn btn-sm' + (filtro === 'inactivos' ? ' btn-activo' : '')} onClick={() => setFiltro('inactivos')}>
            Inactivos <span className="conteo">{productos.filter(p => p.activo === false).length}</span>
          </button>
        </div>
      </div>

      <div className="card">
        {loading ? <div className="loading">Cargando...</div> : filtrados.length === 0 ? (
          <div className="empty"><i className="ti ti-box" /><p>Sin productos que coincidan</p></div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 44 }}></th>
                  <th>Nombre</th><th>Modelo</th><th>Precio</th>
                  <th>Clave SAT</th><th>Unidad</th><th>Estado</th><th></th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map(p => (
                  <tr key={p.id}>
                    <td>
                      {p.imagen_url
                        ? <img src={p.imagen_url} alt="" className="miniatura" loading="lazy" />
                        : <div className="miniatura vacia" title="Sin imagen"><i className="ti ti-photo-off" /></div>}
                    </td>
                    <td>
                      <strong>{p.nombre}</strong>
                      {p.descripcion && <div className="celda-sub">{p.descripcion}</div>}
                    </td>
                    <td>{p.modelo || '—'}</td>
                    <td>{money(p.precio)}</td>
                    <td>{p.clave_sat || '—'}</td>
                    <td>{p.unidad_sat || '—'}</td>
                    <td>
                      <span
                        className={`badge ${p.activo ? 'badge-green' : 'badge-gray'}`}
                        style={{ cursor: 'pointer' }}
                        onClick={() => toggleActivo(p)}
                        title="Clic para cambiar"
                      >
                        {p.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td>
                      <button className="btn btn-sm" onClick={() => abrir(p)}><i className="ti ti-edit" /></button>
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
                <div className="form-group form-full">
                  <label>Imagen</label>
                  <div className="subir-imagen">
                    {form.imagen_url
                      ? <img src={form.imagen_url} alt="" className="preview" />
                      : <div className="preview vacia"><i className="ti ti-photo" /></div>}

                    <div className="subir-acciones">
                      <input
                        ref={fileRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        style={{ display: 'none' }}
                        onChange={e => { subirImagen(e.target.files?.[0]); e.target.value = '' }}
                      />
                      <button className="btn btn-sm" onClick={() => fileRef.current?.click()} disabled={subiendo}>
                        <i className="ti ti-upload" /> {subiendo ? 'Subiendo...' : form.imagen_url ? 'Reemplazar' : 'Subir imagen'}
                      </button>
                      {form.imagen_url && (
                        <button className="btn btn-sm" onClick={() => setForm(f => ({ ...f, imagen_url: '' }))} disabled={subiendo}>
                          <i className="ti ti-trash" /> Quitar
                        </button>
                      )}
                      <span className="pista">JPG, PNG o WebP · máx. {MAX_MB} MB</span>
                    </div>
                  </div>
                </div>

                <div className="form-group form-full">
                  <label>Nombre *</label>
                  <input value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Modelo / SKU</label>
                  <input value={form.modelo || ''} onChange={e => setForm({ ...form, modelo: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Precio de lista *</label>
                  <input type="number" step="0.01" min="0" value={form.precio}
                         onChange={e => setForm({ ...form, precio: e.target.value })} />
                </div>
                <div className="form-group form-full">
                  <label>Descripción</label>
                  <textarea rows={3} value={form.descripcion || ''}
                            onChange={e => setForm({ ...form, descripcion: e.target.value })} />
                </div>

                <div className="section-label">Datos SAT</div>
                <div className="form-group">
                  <label>Clave producto SAT</label>
                  <input value={form.clave_sat || ''} placeholder="ej. 46171803"
                         onChange={e => setForm({ ...form, clave_sat: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Unidad SAT</label>
                  <input value={form.unidad_sat || ''} placeholder="H87"
                         onChange={e => setForm({ ...form, unidad_sat: e.target.value })} />
                </div>

                <div className="form-group form-full">
                  <label className="check">
                    <input type="checkbox" checked={form.activo !== false}
                           onChange={e => setForm({ ...form, activo: e.target.checked })} />
                    <span>Activo — aparece en el catálogo al cotizar</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn" onClick={() => setModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={guardar} disabled={guardando || subiendo}>
                {guardando ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
