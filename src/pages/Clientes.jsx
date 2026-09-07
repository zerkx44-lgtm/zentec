import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'

// Catálogos del SAT (CFDI 4.0). Se dejan los de uso realista para Zentec:
// venta e instalación de equipo. Conviene contrastarlos con el catálogo
// vigente del SAT antes de empezar a timbrar.
const USOS_CFDI = [
  ['G01', 'Adquisición de mercancías'],
  ['G02', 'Devoluciones, descuentos o bonificaciones'],
  ['G03', 'Gastos en general'],
  ['I01', 'Construcciones'],
  ['I02', 'Mobiliario y equipo de oficina por inversiones'],
  ['I03', 'Equipo de transporte'],
  ['I04', 'Equipo de cómputo y accesorios'],
  ['I06', 'Comunicaciones telefónicas'],
  ['I08', 'Otra maquinaria y equipo'],
  ['S01', 'Sin efectos fiscales']
]

const REGIMENES = [
  ['601', 'General de Ley Personas Morales'],
  ['603', 'Personas Morales con Fines no Lucrativos'],
  ['605', 'Sueldos y Salarios e Ingresos Asimilados a Salarios'],
  ['606', 'Arrendamiento'],
  ['607', 'Régimen de Enajenación o Adquisición de Bienes'],
  ['608', 'Demás ingresos'],
  ['610', 'Residentes en el Extranjero sin Establecimiento Permanente'],
  ['611', 'Ingresos por Dividendos (socios y accionistas)'],
  ['612', 'Personas Físicas con Actividades Empresariales y Profesionales'],
  ['614', 'Ingresos por intereses'],
  ['616', 'Sin obligaciones fiscales'],
  ['620', 'Sociedades Cooperativas de Producción'],
  ['621', 'Incorporación Fiscal'],
  ['622', 'Actividades Agrícolas, Ganaderas, Silvícolas y Pesqueras'],
  ['625', 'Actividades Empresariales con ingresos por Plataformas Tecnológicas'],
  ['626', 'Régimen Simplificado de Confianza']
]

const empty = {
  nombre: '', direccion: '', telefono: '', email: '',
  rfc: '', razon_social: '', uso_cfdi: 'G03', regimen_fiscal: ''
}

// En la tabla los teléfonos se guardan a 10 dígitos; WhatsApp necesita 521 +
// esos 10. Aquí se recorta cualquier prefijo que venga pegado.
function normalizarTelefono(valor) {
  const d = (valor || '').replace(/\D/g, '')
  if (d.length > 10) return d.slice(-10)
  return d
}

const RFC_RE = /^[A-ZÑ&]{3,4}\d{6}[A-Z\d]{3}$/

export default function Clientes() {
  const [clientes, setClientes] = useState([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [filtro, setFiltro] = useState('todos') // todos | con_rfc | sin_rfc
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(empty)
  const [guardando, setGuardando] = useState(false)
  const [msg, setMsg] = useState(null)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)
    const { data, error } = await supabase.from('clientes').select('*').order('nombre')
    if (error) setMsg({ type: 'error', text: 'No se pudieron cargar los clientes: ' + error.message })
    setClientes(data || [])
    setLoading(false)
  }

  async function guardar() {
    if (!form.nombre.trim()) return setMsg({ type: 'error', text: 'El nombre es requerido' })

    const tel = normalizarTelefono(form.telefono)
    if (tel && tel.length !== 10)
      return setMsg({ type: 'error', text: 'El teléfono debe quedar en 10 dígitos. Revisa lo que escribiste.' })

    const rfc = (form.rfc || '').toUpperCase().replace(/[\s-]/g, '')
    if (rfc && !RFC_RE.test(rfc))
      return setMsg({ type: 'error', text: 'El RFC no tiene un formato válido (12 caracteres para empresa, 13 para persona física).' })

    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
      return setMsg({ type: 'error', text: 'El correo no parece válido.' })

    setGuardando(true)

    // Solo las columnas de la tabla: mandar id o created_at rompe el update.
    const payload = {
      nombre: form.nombre.trim(),
      direccion: form.direccion?.trim() || null,
      telefono: tel || null,
      email: form.email?.trim() || null,
      rfc: rfc || null,
      razon_social: form.razon_social?.trim() || null,
      uso_cfdi: form.uso_cfdi || null,
      regimen_fiscal: form.regimen_fiscal || null
    }

    const { error } = form.id
      ? await supabase.from('clientes').update(payload).eq('id', form.id)
      : await supabase.from('clientes').insert(payload)

    setGuardando(false)
    if (error) { setMsg({ type: 'error', text: error.message }); return }

    setModal(false)
    setMsg(null)
    cargar()
  }

  async function eliminar(c) {
    if (!confirm(`¿Eliminar a "${c.nombre}"? Esto no se puede deshacer.`)) return
    const { error } = await supabase.from('clientes').delete().eq('id', c.id)
    if (error) {
      // Lo más común: tiene cotizaciones colgando y el FK lo impide.
      const fk = /foreign key|violates|referenced/i.test(error.message)
      setMsg({
        type: 'error',
        text: fk
          ? `No se puede eliminar a "${c.nombre}" porque tiene cotizaciones asociadas.`
          : 'No se pudo eliminar: ' + error.message
      })
      return
    }
    setMsg(null)
    cargar()
  }

  function abrir(c) {
    setForm(c ? { ...c } : empty)
    setMsg(null)
    setModal(true)
  }

  const q = busqueda.toLowerCase().trim()
  const filtrados = clientes.filter(c => {
    const coincide = !q ||
      c.nombre.toLowerCase().includes(q) ||
      (c.email || '').toLowerCase().includes(q) ||
      (c.rfc || '').toLowerCase().includes(q) ||
      (c.telefono || '').includes(q.replace(/\D/g, '')) ||
      (c.razon_social || '').toLowerCase().includes(q)
    if (!coincide) return false
    if (filtro === 'con_rfc') return !!c.rfc
    if (filtro === 'sin_rfc') return !c.rfc
    return true
  })

  const conRfc = clientes.filter(c => c.rfc).length

  return (
    <>
      <div className="page-header">
        <span className="page-title">Clientes</span>
        <button className="btn btn-primary" onClick={() => abrir(null)}>
          <i className="ti ti-plus" /> Nuevo cliente
        </button>
      </div>

      {msg && !modal && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

      <div className="search-wrap">
        <input
          placeholder="Buscar por nombre, razón social, RFC, correo o teléfono..."
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
        />
        <div className="filtros">
          <button className={'btn btn-sm' + (filtro === 'todos' ? ' btn-activo' : '')} onClick={() => setFiltro('todos')}>
            Todos <span className="conteo">{clientes.length}</span>
          </button>
          <button className={'btn btn-sm' + (filtro === 'con_rfc' ? ' btn-activo' : '')} onClick={() => setFiltro('con_rfc')}>
            Facturables <span className="conteo">{conRfc}</span>
          </button>
          <button className={'btn btn-sm' + (filtro === 'sin_rfc' ? ' btn-activo' : '')} onClick={() => setFiltro('sin_rfc')}>
            Sin RFC <span className="conteo">{clientes.length - conRfc}</span>
          </button>
        </div>
      </div>

      <div className="card">
        {loading ? <div className="loading">Cargando...</div> : filtrados.length === 0 ? (
          <div className="empty"><i className="ti ti-users" /><p>Sin clientes que coincidan</p></div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Nombre</th><th>Teléfono</th><th>Email</th>
                  <th>RFC</th><th>Régimen</th><th style={{ width: 90 }}></th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map(c => (
                  <tr key={c.id}>
                    <td>
                      <strong>{c.nombre}</strong>
                      {c.razon_social && <div className="celda-sub">{c.razon_social}</div>}
                    </td>
                    <td>
                      {c.telefono ? (
                        <a
                          className="enlace-wa"
                          href={`https://wa.me/521${c.telefono}`}
                          target="_blank"
                          rel="noreferrer"
                          title="Abrir en WhatsApp"
                        >
                          <i className="ti ti-brand-whatsapp" /> {c.telefono}
                        </a>
                      ) : '—'}
                    </td>
                    <td>{c.email || '—'}</td>
                    <td>{c.rfc || <span className="badge badge-gray">sin RFC</span>}</td>
                    <td>{c.regimen_fiscal || '—'}</td>
                    <td>
                      <div className="acciones">
                        <button className="btn btn-sm" onClick={() => abrir(c)} title="Editar">
                          <i className="ti ti-edit" />
                        </button>
                        <button className="btn btn-sm btn-peligro" onClick={() => eliminar(c)} title="Eliminar">
                          <i className="ti ti-trash" />
                        </button>
                      </div>
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
                <div className="form-group form-full">
                  <label>Nombre *</label>
                  <input value={form.nombre} placeholder="Nombre comercial o de la persona"
                         onChange={e => setForm({ ...form, nombre: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Teléfono</label>
                  <input
                    value={form.telefono || ''}
                    placeholder="7444014888"
                    inputMode="tel"
                    onChange={e => setForm({ ...form, telefono: e.target.value })}
                    onBlur={e => setForm({ ...form, telefono: normalizarTelefono(e.target.value) })}
                  />
                  <span className="pista">10 dígitos. Si pegas uno con 52 o 521, se recorta solo.</span>
                </div>
                <div className="form-group">
                  <label>Email</label>
                  <input type="email" value={form.email || ''}
                         onChange={e => setForm({ ...form, email: e.target.value })} />
                </div>
                <div className="form-group form-full">
                  <label>Dirección</label>
                  <input value={form.direccion || ''}
                         onChange={e => setForm({ ...form, direccion: e.target.value })} />
                </div>

                <div className="section-label">Datos fiscales — solo si pide factura</div>

                <div className="form-group">
                  <label>RFC</label>
                  <input
                    value={form.rfc || ''}
                    placeholder="XAXX010101000"
                    style={{ textTransform: 'uppercase' }}
                    onChange={e => setForm({ ...form, rfc: e.target.value.toUpperCase() })}
                  />
                </div>
                <div className="form-group">
                  <label>Razón social</label>
                  <input value={form.razon_social || ''}
                         onChange={e => setForm({ ...form, razon_social: e.target.value })} />
                </div>
                <div className="form-group form-full">
                  <label>Uso del CFDI</label>
                  <select value={form.uso_cfdi || ''}
                          onChange={e => setForm({ ...form, uso_cfdi: e.target.value })}>
                    <option value="">— Sin especificar —</option>
                    {USOS_CFDI.map(([clave, texto]) => (
                      <option key={clave} value={clave}>{clave} · {texto}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group form-full">
                  <label>Régimen fiscal</label>
                  <select value={form.regimen_fiscal || ''}
                          onChange={e => setForm({ ...form, regimen_fiscal: e.target.value })}>
                    <option value="">— Sin especificar —</option>
                    {REGIMENES.map(([clave, texto]) => (
                      <option key={clave} value={clave}>{clave} · {texto}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn" onClick={() => setModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={guardar} disabled={guardando}>
                {guardando ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
