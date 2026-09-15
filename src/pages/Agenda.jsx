import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase.js'

// La visita es la cita en el calendario; la orden es lo que se vendió. Una
// visita puede no tener orden (levantamiento antes de cotizar, garantía),
// pero siempre es de un cliente o de una solicitud: la base lo exige.
const TIPOS = {
  levantamiento: { etiqueta: 'Levantamiento', badge: 'badge-blue' },
  instalacion: { etiqueta: 'Instalación', badge: 'badge-green' },
  mantenimiento: { etiqueta: 'Mantenimiento', badge: 'badge-amber' },
  garantia: { etiqueta: 'Garantía', badge: 'badge-red' },
  soporte: { etiqueta: 'Soporte', badge: 'badge-gray' }
}

// Las visitas no se borran: se cancelan o se reprograman. La base no le da
// permiso de borrar a nadie desde el panel.
const ESTADOS = {
  programada: 'Programada',
  en_curso: 'En curso',
  realizada: 'Realizada',
  cancelada: 'Cancelada',
  reprogramada: 'Reprogramada'
}

// Los eventos no se editan ni se borran; solo se agregan.
const TIPOS_EVENTO = {
  avance: 'Avance',
  incidencia: 'Incidencia',
  material: 'Material',
  cierre: 'Cierre'
}

const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const DURACION_DEFAULT_H = 2

function lunesDe(fecha) {
  const d = new Date(fecha)
  d.setHours(0, 0, 0, 0)
  // getDay: domingo = 0. La semana empieza en lunes.
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return d
}

function sumarDias(fecha, n) {
  const d = new Date(fecha)
  d.setDate(d.getDate() + n)
  return d
}

const mismoDia = (a, b) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

// <input type="datetime-local"> trabaja en hora local sin zona. La base guarda
// timestamptz: se convierte en los dos sentidos con la hora del navegador.
function aEntrada(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const p = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

const deEntrada = (valor) => (valor ? new Date(valor).toISOString() : null)

const hora = (iso) =>
  new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })

const fechaLarga = (iso) =>
  new Date(iso).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })

function visitaNueva(dia) {
  const inicio = new Date(dia || Date.now())
  if (dia) inicio.setHours(9, 0, 0, 0)
  else inicio.setHours(inicio.getHours() + 1, 0, 0, 0)
  const fin = new Date(inicio)
  fin.setHours(fin.getHours() + DURACION_DEFAULT_H)
  return {
    tipo: 'levantamiento', estado: 'programada',
    inicio: inicio.toISOString(), fin: fin.toISOString(),
    orden_id: '', cliente_id: '', solicitud_id: '', direccion: '', notas: ''
  }
}

const SELECT_VISITA = `
  *,
  clientes(nombre, telefono),
  bot_solicitudes(servicio),
  ordenes_trabajo(descripcion, cotizaciones(consecutivo)),
  visita_tecnicos(rol, tecnicos(id, nombre))
`

export default function Agenda() {
  const [semana, setSemana] = useState(() => lunesDe(new Date()))
  const [visitas, setVisitas] = useState([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState(null)
  const [verCanceladas, setVerCanceladas] = useState(false)

  const [tecnicos, setTecnicos] = useState([])
  const [clientes, setClientes] = useState([])
  const [solicitudes, setSolicitudes] = useState([])
  const [ordenes, setOrdenes] = useState([])

  // Cajón de visita: `form` es lo que se edita; `abierta` es la fila guardada.
  const [abierta, setAbierta] = useState(null)
  const [form, setForm] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [msgCajon, setMsgCajon] = useState(null)
  const [eventos, setEventos] = useState([])
  const [nuevoEvento, setNuevoEvento] = useState({ tipo: 'avance', nota: '' })
  const [nuevoTecnico, setNuevoTecnico] = useState({ tecnico_id: '', rol: 'apoyo' })

  const [modalTecnicos, setModalTecnicos] = useState(false)

  useEffect(() => { cargarCatalogos() }, [])
  useEffect(() => { cargarSemana() }, [semana])

  async function cargarCatalogos() {
    const [tecs, clis, sols, ords] = await Promise.all([
      supabase.from('tecnicos').select('*').order('nombre'),
      supabase.from('clientes').select('id, nombre, telefono, direccion').order('nombre'),
      supabase.from('bot_solicitudes').select('id, servicio, created_at')
        .order('created_at', { ascending: false }).limit(100),
      supabase.from('ordenes_trabajo')
        .select('id, descripcion, estado, cotizaciones(consecutivo, cliente_id, clientes(nombre, direccion))')
        .order('created_at', { ascending: false })
    ])
    const error = tecs.error || clis.error || sols.error || ords.error
    if (error) setMsg({ type: 'error', text: 'No se pudieron cargar los catálogos: ' + error.message })
    setTecnicos(tecs.data || [])
    setClientes(clis.data || [])
    setSolicitudes(sols.data || [])
    setOrdenes(ords.data || [])
  }

  async function cargarSemana() {
    setLoading(true)
    const { data, error } = await supabase
      .from('visitas')
      .select(SELECT_VISITA)
      .gte('inicio', semana.toISOString())
      .lt('inicio', sumarDias(semana, 7).toISOString())
      .order('inicio')
    if (error) setMsg({ type: 'error', text: 'No se pudieron cargar las visitas: ' + error.message })
    setVisitas(data || [])
    setLoading(false)
  }

  const dias = useMemo(() => DIAS.map((_, i) => sumarDias(semana, i)), [semana])
  const hoy = new Date()

  const visibles = verCanceladas ? visitas : visitas.filter(v => v.estado !== 'cancelada')
  const canceladas = visitas.length - visitas.filter(v => v.estado !== 'cancelada').length

  const rango = `${dias[0].toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })} – ${dias[6].toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}`

  // ------------------------------------------------------------ Cajón

  function abrirNueva(dia) {
    setAbierta(null)
    setForm(visitaNueva(dia))
    setEventos([])
    setMsgCajon(null)
  }

  async function abrir(v) {
    setAbierta(v)
    setForm({
      ...v,
      orden_id: v.orden_id || '', cliente_id: v.cliente_id || '', solicitud_id: v.solicitud_id || '',
      direccion: v.direccion || '', notas: v.notas || ''
    })
    setMsgCajon(null)
    setNuevoEvento({ tipo: 'avance', nota: '' })
    setNuevoTecnico({ tecnico_id: '', rol: 'apoyo' })
    await cargarEventos(v.id)
  }

  function cerrar() {
    setAbierta(null)
    setForm(null)
  }

  async function cargarEventos(visitaId) {
    const { data, error } = await supabase
      .from('visita_eventos')
      .select('*')
      .eq('visita_id', visitaId)
      .order('created_at', { ascending: true })
    if (error) setMsgCajon({ type: 'error', text: 'No se pudo cargar la bitácora: ' + error.message })
    setEventos(data || [])
  }

  // Vuelve a leer la visita guardada, para que el cajón y el calendario
  // muestren lo que quedó en la base y no lo que se tecleó.
  async function releer(id) {
    const { data, error } = await supabase.from('visitas').select(SELECT_VISITA).eq('id', id).maybeSingle()
    if (error || !data) return
    setAbierta(data)
    setVisitas(prev => {
      const enSemana = new Date(data.inicio) >= semana && new Date(data.inicio) < sumarDias(semana, 7)
      const sin = prev.filter(x => x.id !== data.id)
      return enSemana ? [...sin, data].sort((a, b) => a.inicio.localeCompare(b.inicio)) : sin
    })
  }

  function elegirOrden(ordenId) {
    const orden = ordenes.find(o => o.id === ordenId)
    const cot = orden?.cotizaciones
    setForm(f => ({
      ...f,
      orden_id: ordenId,
      // La orden ya dice de quién es: se toma el cliente de su cotización.
      cliente_id: cot?.cliente_id || f.cliente_id,
      direccion: f.direccion || cot?.clientes?.direccion || '',
      tipo: ordenId && f.tipo === 'levantamiento' ? 'instalacion' : f.tipo
    }))
  }

  function elegirCliente(clienteId) {
    const cli = clientes.find(c => c.id === clienteId)
    setForm(f => ({ ...f, cliente_id: clienteId, direccion: f.direccion || cli?.direccion || '' }))
  }

  async function guardar() {
    const inicio = deEntrada(aEntrada(form.inicio))
    const fin = deEntrada(aEntrada(form.fin))
    if (!inicio || !fin) return setMsgCajon({ type: 'error', text: 'Indica inicio y fin' })
    if (new Date(fin) <= new Date(inicio)) return setMsgCajon({ type: 'error', text: 'El fin tiene que ser después del inicio' })
    if (!form.cliente_id && !form.solicitud_id) {
      return setMsgCajon({ type: 'error', text: 'Elige un cliente o una solicitud: la visita tiene que ser de alguien' })
    }

    // Solo columnas de la tabla: `form` puede traer las relaciones anidadas
    // del select, y PostgREST rechaza el update entero si se mandan.
    const payload = {
      tipo: form.tipo,
      estado: form.estado,
      inicio, fin,
      orden_id: form.orden_id || null,
      cliente_id: form.cliente_id || null,
      solicitud_id: form.solicitud_id || null,
      direccion: form.direccion?.trim() || null,
      notas: form.notas?.trim() || null
    }

    setGuardando(true)
    const { data, error } = abierta
      ? await supabase.from('visitas').update(payload).eq('id', abierta.id).select('id').maybeSingle()
      : await supabase.from('visitas').insert(payload).select('id').single()
    setGuardando(false)

    if (error) return setMsgCajon({ type: 'error', text: 'No se pudo guardar: ' + error.message })
    // Un update que no encuentra la fila no da error: afecta cero filas.
    if (!data) return setMsgCajon({ type: 'error', text: 'No se guardó: la visita ya no existe o no hay permiso' })

    setMsgCajon({ type: 'success', text: abierta ? 'Visita guardada' : 'Visita creada. Ya puedes asignar técnicos.' })
    await releer(data.id)
    if (!abierta) {
      setEventos([])
      // Si se creó en otra semana, llevar el calendario a esa semana.
      const semanaVisita = lunesDe(inicio)
      if (semanaVisita.getTime() !== semana.getTime()) setSemana(semanaVisita)
    }
  }

  async function asignarTecnico() {
    if (!nuevoTecnico.tecnico_id) return
    const { error } = await supabase.from('visita_tecnicos').insert({
      visita_id: abierta.id, tecnico_id: nuevoTecnico.tecnico_id, rol: nuevoTecnico.rol
    })
    if (error) return setMsgCajon({ type: 'error', text: 'No se pudo asignar: ' + error.message })
    setNuevoTecnico({ tecnico_id: '', rol: 'apoyo' })
    await releer(abierta.id)
  }

  async function cambiarRol(tecnicoId, rol) {
    const { error } = await supabase.from('visita_tecnicos')
      .update({ rol }).eq('visita_id', abierta.id).eq('tecnico_id', tecnicoId)
    if (error) return setMsgCajon({ type: 'error', text: 'No se pudo cambiar el rol: ' + error.message })
    await releer(abierta.id)
  }

  async function quitarTecnico(tecnicoId, nombre) {
    if (!confirm(`¿Quitar a ${nombre} de esta visita?`)) return
    const { error } = await supabase.from('visita_tecnicos')
      .delete().eq('visita_id', abierta.id).eq('tecnico_id', tecnicoId)
    if (error) return setMsgCajon({ type: 'error', text: 'No se pudo quitar: ' + error.message })
    await releer(abierta.id)
  }

  async function agregarEvento() {
    const nota = nuevoEvento.nota.trim()
    if (!nota) return setMsgCajon({ type: 'error', text: 'Escribe la nota del evento' })
    const { error } = await supabase.from('visita_eventos').insert({
      visita_id: abierta.id, tipo: nuevoEvento.tipo, nota
    })
    if (error) return setMsgCajon({ type: 'error', text: 'No se pudo registrar: ' + error.message })
    setNuevoEvento({ tipo: nuevoEvento.tipo, nota: '' })
    setMsgCajon(null)
    await cargarEventos(abierta.id)
  }

  const asignados = abierta?.visita_tecnicos || []
  const disponibles = tecnicos.filter(t => t.activo && !asignados.some(a => a.tecnicos?.id === t.id))

  // Opciones de orden: las abiertas, más la actual aunque ya esté cerrada,
  // para que editar una visita vieja no la deje en blanco.
  const ordenesOpcion = ordenes.filter(o =>
    !['completada', 'cancelada'].includes(o.estado) || o.id === form?.orden_id)

  const etiquetaOrden = (o) =>
    `COT-${o.cotizaciones?.consecutivo ?? '?'} — ${o.cotizaciones?.clientes?.nombre || 'Sin cliente'} — ${o.descripcion}`

  const quienEs = (v) =>
    v.clientes?.nombre || (v.bot_solicitudes ? `Solicitud: ${v.bot_solicitudes.servicio || 'sin servicio'}` : '—')

  return (
    <>
      <div className="page-header">
        <span className="page-title">Agenda</span>
        <div className="filtros">
          <button className="btn" onClick={() => setModalTecnicos(true)}>
            <i className="ti ti-users" /> Técnicos
          </button>
          <button className="btn btn-primary" onClick={() => abrirNueva()}>
            <i className="ti ti-plus" /> Nueva visita
          </button>
        </div>
      </div>

      {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

      <div className="agenda-barra">
        <div className="filtros">
          <button className="btn btn-sm" onClick={() => setSemana(sumarDias(semana, -7))} title="Semana anterior">
            <i className="ti ti-chevron-left" />
          </button>
          <button className="btn btn-sm" onClick={() => setSemana(lunesDe(new Date()))}>Hoy</button>
          <button className="btn btn-sm" onClick={() => setSemana(sumarDias(semana, 7))} title="Semana siguiente">
            <i className="ti ti-chevron-right" />
          </button>
          <span className="agenda-rango">{rango}</span>
        </div>
        {canceladas > 0 && (
          <button className={'btn btn-sm' + (verCanceladas ? ' btn-activo' : '')} onClick={() => setVerCanceladas(!verCanceladas)}>
            {verCanceladas ? 'Ocultar' : 'Ver'} canceladas <span className="conteo">{canceladas}</span>
          </button>
        )}
      </div>

      <div className="agenda-scroll">
        <div className="agenda-semana">
          {dias.map((dia, i) => {
            const delDia = visibles.filter(v => mismoDia(new Date(v.inicio), dia))
            return (
              <div key={i} className={'agenda-dia' + (mismoDia(dia, hoy) ? ' hoy' : '')}>
                <div className="agenda-dia-header">
                  <span>{DIAS[i]} <strong>{dia.getDate()}</strong></span>
                  <button className="btn-icono" onClick={() => abrirNueva(dia)} title="Nueva visita este día">
                    <i className="ti ti-plus" />
                  </button>
                </div>
                <div className="agenda-dia-cuerpo">
                  {loading ? null : delDia.map(v => {
                    const responsable = (v.visita_tecnicos || []).find(t => t.rol === 'responsable')
                    const total = (v.visita_tecnicos || []).length
                    return (
                      <button key={v.id} className={`agenda-visita estado-${v.estado}`} onClick={() => abrir(v)}>
                        <div className="agenda-visita-hora">{hora(v.inicio)} – {hora(v.fin)}</div>
                        <span className={`badge ${TIPOS[v.tipo]?.badge || 'badge-gray'}`}>{TIPOS[v.tipo]?.etiqueta || v.tipo}</span>
                        <div className="agenda-visita-quien">{quienEs(v)}</div>
                        {v.ordenes_trabajo?.cotizaciones && (
                          <div className="celda-sub">COT-{v.ordenes_trabajo.cotizaciones.consecutivo}</div>
                        )}
                        <div className="celda-sub">
                          <i className="ti ti-user" />{' '}
                          {total === 0 ? 'Sin técnico' : (responsable?.tecnicos?.nombre || 'Sin responsable') + (total > 1 ? ` +${total - 1}` : '')}
                        </div>
                        {v.estado !== 'programada' && <div className="celda-sub">{ESTADOS[v.estado]}</div>}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>
      {loading && <div className="loading">Cargando visitas...</div>}

      {form && (
        <div className="cajon-fondo" onClick={e => e.target === e.currentTarget && cerrar()}>
          <aside className="cajon">
            <header className="cajon-header">
              <div>
                <div className="cajon-titulo">{abierta ? (TIPOS[abierta.tipo]?.etiqueta || 'Visita') : 'Nueva visita'}</div>
                <div className="cajon-sub">{abierta ? `${fechaLarga(abierta.inicio)} · ${quienEs(abierta)}` : 'Sin guardar'}</div>
              </div>
              <button className="btn btn-sm" onClick={cerrar}><i className="ti ti-x" /></button>
            </header>

            <div className="cajon-cuerpo">
              {msgCajon && <div className={`alert alert-${msgCajon.type}`}>{msgCajon.text}</div>}

              <div className="form-grid">
                <div className="form-group">
                  <label>Tipo</label>
                  <select value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })}>
                    {Object.entries(TIPOS).map(([k, t]) => <option key={k} value={k}>{t.etiqueta}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Estado</label>
                  <select value={form.estado} onChange={e => setForm({ ...form, estado: e.target.value })}>
                    {Object.entries(ESTADOS).map(([k, e]) => <option key={k} value={k}>{e}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Inicio</label>
                  <input type="datetime-local" value={aEntrada(form.inicio)}
                         onChange={e => setForm({ ...form, inicio: deEntrada(e.target.value) })} />
                </div>
                <div className="form-group">
                  <label>Fin</label>
                  <input type="datetime-local" value={aEntrada(form.fin)}
                         onChange={e => setForm({ ...form, fin: deEntrada(e.target.value) })} />
                </div>
                <div className="form-group form-full">
                  <label>Orden de trabajo (opcional)</label>
                  <select value={form.orden_id} onChange={e => elegirOrden(e.target.value)}>
                    <option value="">Sin orden</option>
                    {ordenesOpcion.map(o => <option key={o.id} value={o.id}>{etiquetaOrden(o)}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Cliente</label>
                  <select value={form.cliente_id} onChange={e => elegirCliente(e.target.value)}>
                    <option value="">Sin cliente</option>
                    {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>O solicitud del bot</label>
                  <select value={form.solicitud_id} onChange={e => setForm({ ...form, solicitud_id: e.target.value })}>
                    <option value="">Sin solicitud</option>
                    {solicitudes.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.servicio || 'Sin servicio'} — {new Date(s.created_at).toLocaleDateString('es-MX')}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group form-full">
                  <label>Dirección</label>
                  <input value={form.direccion} onChange={e => setForm({ ...form, direccion: e.target.value })} />
                </div>
                <div className="form-group form-full">
                  <label>Notas</label>
                  <textarea rows={2} value={form.notas} onChange={e => setForm({ ...form, notas: e.target.value })} />
                </div>
              </div>

              <div className="agenda-acciones">
                <button className="btn btn-primary" onClick={guardar} disabled={guardando}>
                  {guardando ? 'Guardando...' : abierta ? 'Guardar cambios' : 'Crear visita'}
                </button>
              </div>

              {abierta && (
                <>
                  <div className="agenda-seccion">Técnicos</div>
                  {asignados.length === 0 ? (
                    <p className="pista">Nadie asignado todavía.</p>
                  ) : (
                    <div className="table-wrap">
                      <table>
                        <tbody>
                          {asignados.map(a => (
                            <tr key={a.tecnicos?.id}>
                              <td>{a.tecnicos?.nombre}</td>
                              <td style={{ width: 140 }}>
                                <select className="select-estado" value={a.rol} onChange={e => cambiarRol(a.tecnicos.id, e.target.value)}>
                                  <option value="responsable">Responsable</option>
                                  <option value="apoyo">Apoyo</option>
                                </select>
                              </td>
                              <td style={{ width: 40 }}>
                                <button className="btn btn-sm" onClick={() => quitarTecnico(a.tecnicos.id, a.tecnicos.nombre)} title="Quitar de la visita">
                                  <i className="ti ti-x" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {asignados.length > 0 && !asignados.some(a => a.rol === 'responsable') && (
                    <p className="pista">Esta visita no tiene responsable.</p>
                  )}
                  <div className="agenda-fila">
                    <select value={nuevoTecnico.tecnico_id} onChange={e => setNuevoTecnico({ ...nuevoTecnico, tecnico_id: e.target.value })}>
                      <option value="">{disponibles.length ? 'Agregar técnico...' : 'No hay más técnicos activos'}</option>
                      {disponibles.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                    </select>
                    <select value={nuevoTecnico.rol} onChange={e => setNuevoTecnico({ ...nuevoTecnico, rol: e.target.value })}>
                      <option value="responsable">Responsable</option>
                      <option value="apoyo">Apoyo</option>
                    </select>
                    <button className="btn btn-sm" onClick={asignarTecnico} disabled={!nuevoTecnico.tecnico_id}>Asignar</button>
                  </div>

                  <div className="agenda-seccion">Bitácora</div>
                  {eventos.length === 0 ? (
                    <p className="pista">Sin eventos registrados.</p>
                  ) : (
                    <ul className="agenda-eventos">
                      {eventos.map(ev => (
                        <li key={ev.id}>
                          <div className="celda-sub">
                            {new Date(ev.created_at).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                            {' · '}{TIPOS_EVENTO[ev.tipo] || ev.tipo}
                          </div>
                          <div>{ev.nota}</div>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="agenda-fila">
                    <select value={nuevoEvento.tipo} onChange={e => setNuevoEvento({ ...nuevoEvento, tipo: e.target.value })}>
                      {Object.entries(TIPOS_EVENTO).map(([k, t]) => <option key={k} value={k}>{t}</option>)}
                    </select>
                    <input value={nuevoEvento.nota} placeholder="Qué pasó"
                           onChange={e => setNuevoEvento({ ...nuevoEvento, nota: e.target.value })}
                           onKeyDown={e => e.key === 'Enter' && agregarEvento()} />
                    <button className="btn btn-sm" onClick={agregarEvento}>Registrar</button>
                  </div>
                  <p className="pista">Los eventos no se editan ni se borran: si algo quedó mal, se registra otro que lo corrija.</p>
                </>
              )}
            </div>
          </aside>
        </div>
      )}

      {modalTecnicos && (
        <Tecnicos
          tecnicos={tecnicos}
          alCerrar={() => setModalTecnicos(false)}
          alCambiar={cargarCatalogos}
        />
      )}
    </>
  )
}

// Catálogo de técnicos. No se borran: se desactivan, para no perder a quién
// se asignó en visitas pasadas (la base tampoco deja borrar a uno con visitas).
function Tecnicos({ tecnicos, alCerrar, alCambiar }) {
  const vacio = { nombre: '', telefono: '' }
  const [form, setForm] = useState(vacio)
  const [msg, setMsg] = useState(null)
  const [guardando, setGuardando] = useState(false)

  async function guardar() {
    const nombre = form.nombre.trim()
    const telefono = form.telefono.replace(/\D/g, '')
    if (!nombre) return setMsg({ type: 'error', text: 'El nombre es requerido' })
    if (telefono && telefono.length !== 10) return setMsg({ type: 'error', text: 'El teléfono va a 10 dígitos' })

    setGuardando(true)
    const payload = { nombre, telefono: telefono || null }
    const { data, error } = form.id
      ? await supabase.from('tecnicos').update(payload).eq('id', form.id).select('id').maybeSingle()
      : await supabase.from('tecnicos').insert(payload).select('id').single()
    setGuardando(false)
    if (error) return setMsg({ type: 'error', text: 'No se pudo guardar: ' + error.message })
    if (!data) return setMsg({ type: 'error', text: 'No se guardó: el técnico ya no existe' })
    setForm(vacio)
    setMsg(null)
    alCambiar()
  }

  async function cambiarActivo(t) {
    const { error } = await supabase.from('tecnicos').update({ activo: !t.activo }).eq('id', t.id)
    if (error) return setMsg({ type: 'error', text: 'No se pudo cambiar: ' + error.message })
    alCambiar()
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && alCerrar()}>
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">Técnicos</span>
          <button className="btn btn-sm" onClick={alCerrar}><i className="ti ti-x" /></button>
        </div>
        <div className="modal-body">
          {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

          {tecnicos.length === 0 ? (
            <p className="pista">Todavía no hay técnicos. Agrega el primero abajo.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Nombre</th><th>Teléfono</th><th>Estado</th><th></th></tr></thead>
                <tbody>
                  {tecnicos.map(t => (
                    <tr key={t.id} style={t.activo ? null : { opacity: 0.55 }}>
                      <td>{t.nombre}</td>
                      <td>{t.telefono || '—'}</td>
                      <td>
                        <button className="btn btn-sm" onClick={() => cambiarActivo(t)}>
                          {t.activo ? 'Activo' : 'Inactivo'}
                        </button>
                      </td>
                      <td>
                        <button className="btn btn-sm" onClick={() => { setForm({ id: t.id, nombre: t.nombre, telefono: t.telefono || '' }); setMsg(null) }}>
                          <i className="ti ti-edit" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="agenda-seccion">{form.id ? 'Editar técnico' : 'Agregar técnico'}</div>
          <div className="form-grid">
            <div className="form-group">
              <label>Nombre *</label>
              <input value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Teléfono (10 dígitos)</label>
              <input value={form.telefono} inputMode="numeric" onChange={e => setForm({ ...form, telefono: e.target.value })} />
            </div>
          </div>
        </div>
        <div className="modal-footer">
          {form.id && <button className="btn" onClick={() => { setForm(vacio); setMsg(null) }}>Cancelar edición</button>}
          <button className="btn btn-primary" onClick={guardar} disabled={guardando}>
            {guardando ? 'Guardando...' : form.id ? 'Guardar' : 'Agregar'}
          </button>
        </div>
      </div>
    </div>
  )
}
