import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'

const ESTADOS = ['borrador', 'en_revision', 'aprobada', 'enviada', 'rechazada']

const BADGE = {
  borrador: 'badge-gray',
  en_revision: 'badge-amber',
  aprobada: 'badge-green',
  enviada: 'badge-blue',
  rechazada: 'badge-red'
}

const money = (n) =>
  '$' + parseFloat(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })

// No existe una columna `fecha` en cotizaciones: la de alta es created_at.
// Se prueban las tres por si el registro viene de un flujo distinto.
function fechaDe(c) {
  const iso = c.created_at || c.enviada_at || c.revisada_desde
  if (!iso) return '—'
  const d = new Date(iso)
  return isNaN(d) ? '—' : d.toLocaleDateString('es-MX')
}

const etiquetaEstado = (e) => (e || '').replace('_', ' ')

export default function Cotizaciones() {
  const [cotizaciones, setCotizaciones] = useState([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [filtro, setFiltro] = useState('todas')
  const [msg, setMsg] = useState(null)

  const [abierta, setAbierta] = useState(null)   // cotización seleccionada
  const [partidas, setPartidas] = useState([])
  const [cargandoDetalle, setCargandoDetalle] = useState(false)
  const [pestana, setPestana] = useState('datos') // datos | pdf

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)
    const { data, error } = await supabase
      .from('cotizaciones')
      .select('*, clientes(nombre, telefono)')
      .order('consecutivo', { ascending: false })
    if (error) setMsg({ type: 'error', text: 'No se pudieron cargar las cotizaciones: ' + error.message })
    setCotizaciones(data || [])
    setLoading(false)
  }

  async function abrir(c) {
    setAbierta(c)
    setPestana('datos')
    setPartidas([])
    setCargandoDetalle(true)

    const { data, error } = await supabase
      .from('cotizacion_productos')
      .select('*, productos(nombre, modelo, imagen_url)')
      .eq('cotizacion_id', c.id)

    if (error) setMsg({ type: 'error', text: 'No se pudieron cargar las partidas: ' + error.message })
    setPartidas(data || [])
    setCargandoDetalle(false)
  }

  async function cambiarEstado(c, estado) {
    const { error } = await supabase.from('cotizaciones').update({ estado }).eq('id', c.id)
    if (error) { setMsg({ type: 'error', text: 'No se pudo cambiar el estado: ' + error.message }); return }
    setCotizaciones(prev => prev.map(x => x.id === c.id ? { ...x, estado } : x))
    if (abierta?.id === c.id) setAbierta({ ...abierta, estado })
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

  // Suma de partidas. El total de la cotización manda; esto sirve para
  // detectar descuadres entre lo guardado y lo que suman las líneas.
  const sumaPartidas = partidas.reduce(
    (a, p) => a + (parseFloat(p.cantidad || 0) * parseFloat(p.precio_unitario || 0)), 0)

  return (
    <>
      <div className="page-header">
        <span className="page-title">Cotizaciones</span>
        <span className="pista">Se crean desde WhatsApp, con el bot</span>
      </div>

      {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

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
                  <tr
                    key={c.id}
                    onClick={() => abrir(c)}
                    className={'fila-clic' + (abierta?.id === c.id ? ' fila-activa' : '')}
                  >
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
              <select
                className="select-estado"
                value={abierta.estado || ''}
                onChange={e => cambiarEstado(abierta, e.target.value)}
              >
                {ESTADOS.map(e => <option key={e} value={e}>{etiquetaEstado(e)}</option>)}
              </select>
            </div>

            <div className="cajon-cuerpo">
              {pestana === 'datos' ? (
                cargandoDetalle ? <div className="loading">Cargando partidas...</div> : (
                  <>
                    <div className="table-wrap">
                      <table>
                        <thead><tr><th>Producto</th><th>Cant.</th><th>P. unitario</th><th>Importe</th></tr></thead>
                        <tbody>
                          {partidas.length === 0 ? (
                            <tr><td colSpan={4} style={{ color: 'var(--text-3)' }}>Sin partidas registradas</td></tr>
                          ) : partidas.map(p => (
                            <tr key={p.id}>
                              <td>
                                <strong>{p.productos?.nombre || 'Producto eliminado'}</strong>
                                {p.productos?.modelo && <div className="celda-sub">{p.productos.modelo}</div>}
                                {p.descripcion_extra && <div className="celda-nota">{p.descripcion_extra}</div>}
                              </td>
                              <td className="num">{p.cantidad}</td>
                              <td className="num">{money(p.precio_unitario)}</td>
                              <td className="num">{money((p.cantidad || 0) * (p.precio_unitario || 0))}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="resumen">
                      <div className="resumen-linea">
                        <span>Suma de partidas</span>
                        <span className="num">{money(sumaPartidas)}</span>
                      </div>
                      <div className="resumen-linea">
                        <span>IVA</span>
                        <span>{abierta.con_iva ? '16% incluido en el total' : 'No aplica'}</span>
                      </div>
                      <div className="resumen-linea total">
                        <span>Total guardado</span>
                        <span className="num">{money(abierta.total)}</span>
                      </div>
                      {partidas.length > 0 && Math.abs(sumaPartidas - parseFloat(abierta.total || 0)) > 1 && !abierta.con_iva && (
                        <div className="alert alert-error" style={{ marginTop: 10, marginBottom: 0 }}>
                          La suma de las partidas no coincide con el total guardado.
                        </div>
                      )}
                    </div>

                    {abierta.pdf_url && (
                      <a className="btn btn-sm" href={abierta.pdf_url} target="_blank" rel="noreferrer" style={{ marginTop: 12 }}>
                        <i className="ti ti-external-link" /> Abrir PDF en otra pestaña
                      </a>
                    )}
                  </>
                )
              ) : (
                abierta.pdf_url
                  ? <iframe className="visor-pdf" src={abierta.pdf_url} title={`Cotización ${abierta.consecutivo}`} />
                  : <div className="empty"><i className="ti ti-file-off" /><p>Sin PDF generado</p></div>
              )}
            </div>
          </aside>
        </div>
      )}
    </>
  )
}
