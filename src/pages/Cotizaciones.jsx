import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'

const ESTADOS = ['borrador', 'en_revision', 'aprobada', 'enviada', 'rechazada']

// Editar una cotización que el cliente ya recibió cambia lo que se le
// prometió. No se bloquea, pero se avisa.
const YA_SALIO = ['enviada', 'aprobada']

const BADGE = {
  borrador: 'badge-gray',
  en_revision: 'badge-amber',
  aprobada: 'badge-green',
  enviada: 'badge-blue',
  rechazada: 'badge-red'
}

const money = (n) =>
  '$' + parseFloat(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })

// `fecha` es la del documento comercial, la que se imprime en el PDF.
// `created_at` solo dice cuándo se insertó la fila.
function fechaDe(c) {
  const valor = c.fecha || c.created_at
  if (!valor) return '—'
  // Un `date` viene como "2026-09-03": partirlo evita que el navegador lo
  // lea como UTC y lo pinte un día antes.
  const [a, m, d] = String(valor).slice(0, 10).split('-')
  if (a && m && d) return `${d}/${m}/${a}`
  const f = new Date(valor)
  return isNaN(f) ? '—' : f.toLocaleDateString('es-MX')
}

const etiquetaEstado = (e) => (e || '').replace('_', ' ')

export default function Cotizaciones() {
  const [cotizaciones, setCotizaciones] = useState([])
  const [productos, setProductos] = useState([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [filtro, setFiltro] = useState('todas')
  const [msg, setMsg] = useState(null)

  const [abierta, setAbierta] = useState(null)
  const [partidas, setPartidas] = useState([])
  const [cargandoDetalle, setCargandoDetalle] = useState(false)
  const [pestana, setPestana] = useState('datos')

  const [editando, setEditando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [nuevoProducto, setNuevoProducto] = useState('')
  const [nuevaCantidad, setNuevaCantidad] = useState('1')
  // Cotizaciones editadas en esta sesión: su PDF ya no coincide con las
  // partidas, porque regenerarlo es cosa del flujo de n8n, no del panel.
  const [pdfViejo, setPdfViejo] = useState(() => new Set())

  // Alta de cotización desde el panel
  const [modalNueva, setModalNueva] = useState(false)
  const [clientes, setClientes] = useState([])
  const [solicitudes, setSolicitudes] = useState([])
  const [nueva, setNueva] = useState({ cliente_id: '', solicitud_id: '', con_iva: false })
  const [creando, setCreando] = useState(false)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)
    const [cots, prods, clis, sols] = await Promise.all([
      supabase.from('cotizaciones')
        .select('*, clientes(nombre, telefono)')
        .order('consecutivo', { ascending: false }),
      supabase.from('productos')
        .select('id, nombre, modelo, precio, activo')
        .order('nombre'),
      supabase.from('clientes')
        .select('id, nombre, razon_social, empresa_id')
        .order('nombre'),
      supabase.from('bot_solicitudes')
        .select('id, servicio, detalles, etapa, prospecto_id')
        .order('created_at', { ascending: false })
    ])
    if (cots.error) setMsg({ type: 'error', text: 'No se pudieron cargar las cotizaciones: ' + cots.error.message })
    setCotizaciones(cots.data || [])
    setProductos((prods.data || []).filter(p => p.activo !== false))
    setClientes(clis.data || [])

    // Índice único `cotizaciones_solicitud_uniq`: una cotización por
    // solicitud. Las que ya tienen no se ofrecen, para no chocar contra él.
    const ocupadas = new Set((cots.data || []).map(c => c.solicitud_id).filter(Boolean))
    setSolicitudes((sols.data || []).filter(
      x => !ocupadas.has(x.id) && x.etapa !== 'descartada'))

    setLoading(false)
  }

  async function crearCotizacion() {
    if (!nueva.cliente_id) return setMsg({ type: 'error', text: 'Elige un cliente.' })
    setCreando(true)

    const cliente = clientes.find(c => c.id === nueva.cliente_id)

    // `consecutivo` y `fecha` los pone la base (secuencia y CURRENT_DATE).
    // Los totales quedan en cero hasta que se agreguen partidas: los calcula
    // el trigger, el panel nunca los escribe.
    const fila = {
      cliente_id: nueva.cliente_id,
      con_iva: nueva.con_iva,
      estado: 'borrador',
      solicitud_id: nueva.solicitud_id || null,
      // La cotización pertenece a la misma empresa que su cliente.
      empresa_id: cliente?.empresa_id ?? null
    }

    const { data, error } = await supabase
      .from('cotizaciones')
      .insert(fila)
      .select('*, clientes(nombre, telefono)')
      .maybeSingle()

    setCreando(false)

    if (error) {
      const dup = /duplicate key|cotizaciones_solicitud_uniq/i.test(error.message)
      setMsg({
        type: 'error',
        text: dup
          ? 'Esa solicitud ya tiene una cotización. Solo puede haber una por solicitud.'
          : 'No se pudo crear: ' + error.message
      })
      return
    }

    setModalNueva(false)
    setNueva({ cliente_id: '', solicitud_id: '', con_iva: false })
    setMsg(null)
    setCotizaciones(prev => [data, ...prev])
    // Se abre en modo edición: una cotización sin partidas no sirve de nada.
    setAbierta(data)
    setPartidas([])
    setPestana('datos')
    setEditando(true)
  }

  async function abrir(c) {
    setAbierta(c)
    setPestana('datos')
    setEditando(false)
    setPartidas([])
    setCargandoDetalle(true)
    await cargarPartidas(c.id)
    setCargandoDetalle(false)
  }

  async function cargarPartidas(cotizacionId) {
    const { data, error } = await supabase
      .from('cotizacion_productos')
      .select('*, productos(nombre, modelo, precio)')
      .eq('cotizacion_id', cotizacionId)
    if (error) setMsg({ type: 'error', text: 'No se pudieron cargar las partidas: ' + error.message })
    setPartidas(data || [])
  }

  // Los totales los recalcula un trigger en la base cada vez que cambian
  // las partidas. El panel no los escribe: los vuelve a leer.
  async function refrescar(cotizacionId) {
    setPdfViejo(prev => new Set(prev).add(cotizacionId))
    const { data } = await supabase
      .from('cotizaciones')
      .select('*, clientes(nombre, telefono)')
      .eq('id', cotizacionId)
      .maybeSingle()
    if (data) {
      setAbierta(data)
      setCotizaciones(prev => prev.map(x => x.id === data.id ? data : x))
    }
    await cargarPartidas(cotizacionId)
  }

  async function agregarPartida() {
    if (!nuevoProducto) return setMsg({ type: 'error', text: 'Elige un producto del catálogo.' })
    const cant = parseInt(nuevaCantidad, 10)
    if (!cant || cant < 1) return setMsg({ type: 'error', text: 'La cantidad debe ser al menos 1.' })

    const producto = productos.find(p => p.id === nuevoProducto)
    if (!producto) return

    setGuardando(true)
    // El precio sale del catálogo, nunca se escribe a mano: es la regla
    // dura del sistema. Lo que se guarda es la foto del precio de hoy.
    const { error } = await supabase.from('cotizacion_productos').insert({
      cotizacion_id: abierta.id,
      producto_id: producto.id,
      cantidad: cant,
      precio_unitario: producto.precio
    })
    setGuardando(false)

    if (error) { setMsg({ type: 'error', text: 'No se pudo agregar: ' + error.message }); return }
    setNuevoProducto('')
    setNuevaCantidad('1')
    setMsg(null)
    await refrescar(abierta.id)
  }

  async function cambiarCantidad(partida, valor) {
    const cant = parseInt(valor, 10)
    if (!cant || cant < 1) return
    setGuardando(true)
    const { error } = await supabase
      .from('cotizacion_productos')
      .update({ cantidad: cant })
      .eq('id', partida.id)
    setGuardando(false)
    if (error) { setMsg({ type: 'error', text: 'No se pudo actualizar: ' + error.message }); return }
    await refrescar(abierta.id)
  }

  async function cambiarNota(partida, texto) {
    const { error } = await supabase
      .from('cotizacion_productos')
      .update({ descripcion_extra: texto.trim() || null })
      .eq('id', partida.id)
    if (error) { setMsg({ type: 'error', text: 'No se pudo guardar la nota: ' + error.message }); return }
    await cargarPartidas(abierta.id)
  }

  async function borrarPartida(partida) {
    const nombre = partida.productos?.nombre || 'esta partida'
    if (!confirm(`¿Quitar ${nombre} de la cotización?`)) return
    setGuardando(true)
    const { error } = await supabase.from('cotizacion_productos').delete().eq('id', partida.id)
    setGuardando(false)
    if (error) { setMsg({ type: 'error', text: 'No se pudo quitar: ' + error.message }); return }
    await refrescar(abierta.id)
  }

  async function cambiarEstado(c, estado) {
    const { error } = await supabase.from('cotizaciones').update({ estado }).eq('id', c.id)
    if (error) { setMsg({ type: 'error', text: 'No se pudo cambiar el estado: ' + error.message }); return }
    setCotizaciones(prev => prev.map(x => x.id === c.id ? { ...x, estado } : x))
    if (abierta?.id === c.id) setAbierta({ ...abierta, estado })
  }

  // Cambiar con_iva mueve el total, y de eso se encarga otro trigger.
  async function cambiarIva(c, conIva) {
    const { error } = await supabase.from('cotizaciones').update({ con_iva: conIva }).eq('id', c.id)
    if (error) { setMsg({ type: 'error', text: 'No se pudo cambiar el IVA: ' + error.message }); return }
    await refrescar(c.id)
  }

  const q = busqueda.toLowerCase().trim()
  const filtradas = cotizaciones.filter(c => {
    const coincide = !q ||
      String(c.consecutivo).includes(q) ||
      (c.clientes?.nombre || '').toLowerCase().includes(q)
    if (!coincide) return false
    if (filtro === 'por_revisar') return c.estado === 'borrador' || c.estado === 'en_revision'
    if (filtro === 'enviadas') return c.estado === 'enviada'
    return true
  })

  const porRevisar = cotizaciones.filter(c => c.estado === 'borrador' || c.estado === 'en_revision').length
  const enviadas = cotizaciones.filter(c => c.estado === 'enviada').length
  const sumaPartidas = partidas.reduce(
    (a, p) => a + (parseFloat(p.cantidad || 0) * parseFloat(p.precio_unitario || 0)), 0)

  return (
    <>
      <div className="page-header">
        <span className="page-title">Cotizaciones</span>
        <button className="btn btn-primary" onClick={() => { setNueva({ cliente_id: '', solicitud_id: '', con_iva: false }); setMsg(null); setModalNueva(true) }}>
          <i className="ti ti-plus" /> Nueva cotización
        </button>
      </div>

      {msg && !abierta && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

      <div className="search-wrap">
        <input
          placeholder="Buscar por folio o cliente..."
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
        />
        <div className="filtros">
          <button className={'btn btn-sm' + (filtro === 'todas' ? ' btn-activo' : '')} onClick={() => setFiltro('todas')}>
            Todas <span className="conteo">{cotizaciones.length}</span>
          </button>
          <button className={'btn btn-sm' + (filtro === 'por_revisar' ? ' btn-activo' : '')} onClick={() => setFiltro('por_revisar')}>
            Por revisar <span className="conteo">{porRevisar}</span>
          </button>
          <button className={'btn btn-sm' + (filtro === 'enviadas' ? ' btn-activo' : '')} onClick={() => setFiltro('enviadas')}>
            Enviadas <span className="conteo">{enviadas}</span>
          </button>
        </div>
      </div>

      <div className="card">
        {loading ? <div className="loading">Cargando...</div> : filtradas.length === 0 ? (
          <div className="empty"><i className="ti ti-file-invoice" /><p>Sin cotizaciones que coincidan</p></div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Folio</th><th>Cliente</th><th>Total</th><th>IVA</th><th>Fecha</th><th>Estado</th><th></th></tr>
              </thead>
              <tbody>
                {filtradas.map(c => (
                  <tr key={c.id} onClick={() => abrir(c)}
                      className={'fila-clic' + (abierta?.id === c.id ? ' fila-activa' : '')}>
                    <td><strong>COT-{c.consecutivo}</strong></td>
                    <td>{c.clientes?.nombre || '—'}</td>
                    <td className="num">{money(c.total)}</td>
                    <td>{c.con_iva ? <span className="badge badge-green">sí</span> : <span className="badge badge-gray">no</span>}</td>
                    <td className="num">{fechaDe(c)}</td>
                    <td><span className={`badge ${BADGE[c.estado] || 'badge-gray'}`}>{etiquetaEstado(c.estado)}</span></td>
                    <td onClick={e => e.stopPropagation()}>
                      <div className="acciones">
                        {c.pdf_url && (
                          <a className="btn btn-sm" href={c.pdf_url} target="_blank" rel="noreferrer" title="Abrir PDF">
                            <i className="ti ti-file-type-pdf" />
                          </a>
                        )}
                        <button className="btn btn-sm" onClick={() => abrir(c)} title="Ver detalle">
                          <i className="ti ti-eye" />
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

      {abierta && (
        <div className="cajon-fondo" onClick={e => e.target === e.currentTarget && setAbierta(null)}>
          <aside className="cajon">
            <header className="cajon-header">
              <div>
                <div className="cajon-titulo">COT-{abierta.consecutivo}</div>
                <div className="cajon-sub">{abierta.clientes?.nombre || 'Sin cliente'}</div>
              </div>
              <button className="btn btn-sm" onClick={() => setAbierta(null)}><i className="ti ti-x" /></button>
            </header>

            <div className="cajon-barra">
              <div className="pestanas">
                <button className={'pestana' + (pestana === 'datos' ? ' activa' : '')} onClick={() => setPestana('datos')}>
                  Partidas
                </button>
                <button
                  className={'pestana' + (pestana === 'pdf' ? ' activa' : '')}
                  onClick={() => setPestana('pdf')}
                  disabled={!abierta.pdf_url}
                  title={abierta.pdf_url ? '' : 'Esta cotización no tiene PDF generado'}
                >
                  PDF
                </button>
              </div>
              <select className="select-estado" value={abierta.estado || ''}
                      onChange={e => cambiarEstado(abierta, e.target.value)}>
                {ESTADOS.map(e => <option key={e} value={e}>{etiquetaEstado(e)}</option>)}
              </select>
            </div>

            <div className="cajon-cuerpo">
              {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

              {pestana === 'datos' ? (
                cargandoDetalle ? <div className="loading">Cargando partidas...</div> : (
                  <>
                    <div className="barra-edicion">
                      <button
                        className={'btn btn-sm' + (editando ? ' btn-activo' : '')}
                        onClick={() => { setEditando(!editando); setMsg(null) }}
                      >
                        <i className={editando ? 'ti ti-check' : 'ti ti-edit'} />
                        {editando ? ' Terminar' : ' Editar partidas'}
                      </button>
                      {guardando && <span className="pista">Guardando...</span>}
                    </div>

                    {pdfViejo.has(abierta.id) && abierta.pdf_url && (
                      <div className="alert alert-error">
                        <i className="ti ti-file-alert" />
                        <span>
                          El PDF sigue teniendo los números anteriores. Se
                          regenera al aprobar la cotización por WhatsApp.
                        </span>
                      </div>
                    )}

                    {editando && YA_SALIO.includes(abierta.estado) && (
                      <div className="alert alert-error">
                        Esta cotización ya está <strong>{etiquetaEstado(abierta.estado)}</strong>.
                        Si la cambias, el cliente tiene un PDF con otros números —
                        habrá que regenerarlo y reenviarlo.
                      </div>
                    )}

                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>Producto</th><th style={{ width: 78 }}>Cant.</th>
                            <th>P. unitario</th><th>Importe</th>
                            {editando && <th style={{ width: 40 }}></th>}
                          </tr>
                        </thead>
                        <tbody>
                          {partidas.length === 0 ? (
                            <tr><td colSpan={editando ? 5 : 4} style={{ color: 'var(--text-3)' }}>Sin partidas registradas</td></tr>
                          ) : partidas.map(p => (
                            <tr key={p.id}>
                              <td>
                                <strong>{p.productos?.nombre || 'Producto eliminado'}</strong>
                                {p.productos?.modelo && <div className="celda-sub">{p.productos.modelo}</div>}
                                {editando ? (
                                  <input
                                    className="entrada-nota"
                                    defaultValue={p.descripcion_extra || ''}
                                    placeholder="Nota de esta partida (opcional)"
                                    onBlur={e => {
                                      if (e.target.value.trim() !== (p.descripcion_extra || '')) {
                                        cambiarNota(p, e.target.value)
                                      }
                                    }}
                                  />
                                ) : (
                                  p.descripcion_extra && <div className="celda-nota">{p.descripcion_extra}</div>
                                )}
                              </td>
                              <td>
                                {editando ? (
                                  <input
                                    type="number" min="1" className="entrada-cantidad"
                                    defaultValue={p.cantidad}
                                    onBlur={e => {
                                      if (parseInt(e.target.value, 10) !== p.cantidad) {
                                        cambiarCantidad(p, e.target.value)
                                      }
                                    }}
                                  />
                                ) : <span className="num">{p.cantidad}</span>}
                              </td>
                              <td className="num">
                                {money(p.precio_unitario)}
                                {editando && <div className="celda-sub">del catálogo</div>}
                              </td>
                              <td className="num">{money((p.cantidad || 0) * (p.precio_unitario || 0))}</td>
                              {editando && (
                                <td>
                                  <button className="btn btn-sm btn-peligro" onClick={() => borrarPartida(p)} title="Quitar">
                                    <i className="ti ti-trash" />
                                  </button>
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {editando && (
                      <div className="agregar-partida">
                        <select value={nuevoProducto} onChange={e => setNuevoProducto(e.target.value)}>
                          <option value="">Agregar del catálogo...</option>
                          {productos.map(p => (
                            <option key={p.id} value={p.id}>
                              {p.nombre}{p.modelo ? ` · ${p.modelo}` : ''} — {money(p.precio)}
                            </option>
                          ))}
                        </select>
                        <input
                          type="number" min="1" className="entrada-cantidad"
                          value={nuevaCantidad}
                          onChange={e => setNuevaCantidad(e.target.value)}
                        />
                        <button className="btn btn-sm btn-primary" onClick={agregarPartida} disabled={guardando || !nuevoProducto}>
                          <i className="ti ti-plus" /> Agregar
                        </button>
                      </div>
                    )}

                    <div className="resumen">
                      <div className="resumen-linea">
                        <span>Subtotal</span>
                        <span className="num">{money(abierta.subtotal ?? sumaPartidas)}</span>
                      </div>
                      <div className="resumen-linea">
                        <span>
                          IVA 16%
                          {editando && (
                            <label className="check" style={{ display: 'inline-flex', marginLeft: 10 }}>
                              <input
                                type="checkbox"
                                checked={!!abierta.con_iva}
                                onChange={e => cambiarIva(abierta, e.target.checked)}
                              />
                              <span>con factura</span>
                            </label>
                          )}
                        </span>
                        <span className="num">{abierta.con_iva ? money(abierta.iva) : '—'}</span>
                      </div>
                      <div className="resumen-linea total">
                        <span>Total</span>
                        <span className="num">{money(abierta.total)}</span>
                      </div>
                    </div>

                    {abierta.pdf_url && (
                      <a className="btn btn-sm" href={abierta.pdf_url} target="_blank" rel="noreferrer" style={{ marginTop: 12 }}>
                        <i className="ti ti-external-link" /> Abrir PDF en otra pestaña
                      </a>
                    )}

                    {editando && (
                      <p className="pie-nota" style={{ marginTop: 12 }}>
                        Los precios salen del catálogo y no se editan aquí: para
                        cambiar uno se edita el producto. Los totales los recalcula
                        la base sola al guardar cada partida.
                      </p>
                    )}
                  </>
                )
              ) : (
                abierta.pdf_url
                  ? <>
                      {pdfViejo.has(abierta.id) && (
                        <div className="alert alert-error">
                          <i className="ti ti-file-alert" />
                          <span>Este PDF es anterior a los cambios que acabas de hacer.</span>
                        </div>
                      )}
                      <iframe className="visor-pdf" src={abierta.pdf_url} title={`Cotización ${abierta.consecutivo}`} />
                    </>
                  : <div className="empty"><i className="ti ti-file-off" /><p>Sin PDF generado</p></div>
              )}
            </div>
          </aside>
        </div>
      )}

      {modalNueva && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModalNueva(false)}>
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title">Nueva cotización</span>
              <button className="btn btn-sm" onClick={() => setModalNueva(false)}><i className="ti ti-x" /></button>
            </div>

            <div className="modal-body">
              {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

              <div className="form-grid">
                <div className="form-group form-full">
                  <label>Cliente *</label>
                  <select value={nueva.cliente_id} onChange={e => setNueva({ ...nueva, cliente_id: e.target.value })}>
                    <option value="">Elige un cliente...</option>
                    {clientes.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.nombre}{c.razon_social && c.razon_social !== c.nombre ? ` · ${c.razon_social}` : ''}
                      </option>
                    ))}
                  </select>
                  <span className="pista">Si no está en la lista, se da de alta en Clientes.</span>
                </div>

                <div className="form-group form-full">
                  <label>Solicitud (opcional)</label>
                  <select value={nueva.solicitud_id} onChange={e => setNueva({ ...nueva, solicitud_id: e.target.value })}>
                    <option value="">Sin vincular</option>
                    {solicitudes.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.servicio || 'Solicitud'}{s.detalles ? ` — ${s.detalles.slice(0, 60)}` : ''}
                      </option>
                    ))}
                  </select>
                  <span className="pista">
                    Solo aparecen las solicitudes que todavía no tienen cotización.
                  </span>
                </div>

                <div className="form-group form-full">
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={nueva.con_iva}
                      onChange={e => setNueva({ ...nueva, con_iva: e.target.checked })}
                    />
                    <span>Con factura — se le suma el 16% de IVA</span>
                  </label>
                </div>
              </div>

              <p className="pie-nota" style={{ marginTop: 4 }}>
                Se crea en borrador y sin partidas. Al guardar se abre para
                agregarlas del catálogo. El folio lo asigna la base.
              </p>
            </div>

            <div className="modal-footer">
              <button className="btn" onClick={() => setModalNueva(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={crearCotizacion} disabled={creando || !nueva.cliente_id}>
                {creando ? 'Creando...' : 'Crear y agregar partidas'}
              </button>
            </div>
          </div>
        </div>
      )}

    </>
  )
}
