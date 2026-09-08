import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'

// Claves que la pantalla ofrece explícitamente. Cualquier otra que ya exista
// en la tabla se muestra igual al final, para no esconder lo que el bot usa.
const CAMPOS = [
  {
    titulo: 'Datos de la empresa',
    campos: [
      { clave: 'empresa_nombre', etiqueta: 'Nombre', tipo: 'text' },
      { clave: 'empresa_rfc', etiqueta: 'RFC', tipo: 'text' },
      { clave: 'empresa_direccion', etiqueta: 'Dirección fiscal', tipo: 'text', ancho: 'full' },
      { clave: 'empresa_telefono', etiqueta: 'Teléfono', tipo: 'text' },
      { clave: 'empresa_email', etiqueta: 'Correo', tipo: 'text' },
      { clave: 'whatsapp_numero', etiqueta: 'WhatsApp del bot', tipo: 'text', pista: 'El número que atiende a los clientes' }
    ]
  },
  {
    titulo: 'Cotizaciones',
    campos: [
      {
        clave: 'anticipo_default', etiqueta: 'Anticipo para instalación (%)',
        tipo: 'number', porDefecto: '70',
        pista: 'La regla del negocio es 70%'
      },
      {
        clave: 'iva_tasa', etiqueta: 'Tasa de IVA (%)',
        tipo: 'number', porDefecto: '16',
        pista: 'Solo se aplica si el cliente pide factura'
      },
      {
        clave: 'cotizado_automatico', etiqueta: 'Cotizar automáticamente',
        tipo: 'switch',
        pista: 'El bot genera el borrador al cerrar una solicitud'
      }
    ]
  },
  {
    titulo: 'Facturación',
    campos: [
      { clave: 'factura_serie', etiqueta: 'Serie', tipo: 'text', porDefecto: 'A' },
      { clave: 'factura_folio_inicial', etiqueta: 'Folio inicial', tipo: 'number', porDefecto: '1' }
    ]
  }
]

const CLAVES_CONOCIDAS = new Set(CAMPOS.flatMap(g => g.campos.map(c => c.clave)))

export default function Configuracion() {
  const [config, setConfig] = useState({})
  const [existentes, setExistentes] = useState(new Set())
  const [otras, setOtras] = useState([])
  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [msg, setMsg] = useState(null)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)
    const { data, error } = await supabase.from('configuracion').select('*')

    if (error) {
      setMsg({ type: 'error', text: 'No se pudo leer la configuración: ' + error.message })
      setLoading(false)
      return
    }

    const valores = {}
    const claves = new Set()
    for (const fila of data || []) {
      valores[fila.clave] = fila.valor ?? ''
      claves.add(fila.clave)
    }

    // Los valores por defecto se meten al estado, no solo al dibujo: si viven
    // únicamente en el JSX, un campo que nadie toque nunca llega a guardarse.
    for (const grupo of CAMPOS) {
      for (const campo of grupo.campos) {
        if (valores[campo.clave] === undefined && campo.porDefecto !== undefined) {
          valores[campo.clave] = campo.porDefecto
        }
      }
    }

    setConfig(valores)
    setExistentes(claves)
    setOtras((data || []).filter(f => !CLAVES_CONOCIDAS.has(f.clave)))
    setLoading(false)
  }

  async function guardar() {
    setGuardando(true)
    setMsg(null)

    // La tabla puede estar vacía, y un UPDATE sobre una fila inexistente
    // afecta cero renglones sin devolver error. Por eso se separa lo que ya
    // existe de lo que hay que insertar, en vez de asumir que actualizar basta.
    const nuevas = []
    const cambios = []

    for (const [clave, valor] of Object.entries(config)) {
      const fila = { clave, valor: valor === '' ? null : String(valor) }
      if (existentes.has(clave)) cambios.push(fila)
      else nuevas.push(fila)
    }

    const errores = []

    for (const fila of cambios) {
      const { error } = await supabase
        .from('configuracion')
        .update({ valor: fila.valor })
        .eq('clave', fila.clave)
      if (error) errores.push(`${fila.clave}: ${error.message}`)
    }

    if (nuevas.length) {
      const { error } = await supabase.from('configuracion').insert(nuevas)
      if (error) errores.push(error.message)
    }

    setGuardando(false)

    if (errores.length) {
      setMsg({ type: 'error', text: 'No se pudo guardar: ' + errores[0] })
      return
    }

    setMsg({ type: 'success', text: 'Configuración guardada' })
    setTimeout(() => setMsg(null), 2500)
    cargar()
  }

  const set = (k, v) => setConfig(prev => ({ ...prev, [k]: v }))

  if (loading) return <div className="loading">Cargando...</div>

  return (
    <>
      <div className="page-header">
        <span className="page-title">Configuración</span>
        <button className="btn btn-primary" onClick={guardar} disabled={guardando}>
          {guardando ? 'Guardando...' : 'Guardar'}
        </button>
      </div>

      {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

      {CAMPOS.map(grupo => (
        <div className="card" key={grupo.titulo}>
          <div className="card-title">{grupo.titulo}</div>
          <div className="form-grid">
            {grupo.campos.map(campo => (
              <div
                key={campo.clave}
                className={'form-group' + (campo.ancho === 'full' || campo.tipo === 'switch' ? ' form-full' : '')}
              >
                {campo.tipo === 'switch' ? (
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={String(config[campo.clave]).toLowerCase() === 'true'}
                      onChange={e => set(campo.clave, e.target.checked ? 'true' : 'false')}
                    />
                    <span>{campo.etiqueta}</span>
                  </label>
                ) : (
                  <>
                    <label>{campo.etiqueta}</label>
                    <input
                      type={campo.tipo}
                      value={config[campo.clave] ?? ''}
                      onChange={e => set(campo.clave, e.target.value)}
                    />
                  </>
                )}
                {campo.pista && <span className="pista">{campo.pista}</span>}
              </div>
            ))}
          </div>
        </div>
      ))}

      {otras.length > 0 && (
        <div className="card">
          <div className="card-title">Otros valores</div>
          <div className="form-grid">
            {otras.map(fila => (
              <div className="form-group" key={fila.clave}>
                <label>{fila.clave}</label>
                <input
                  value={config[fila.clave] ?? ''}
                  onChange={e => set(fila.clave, e.target.value)}
                />
                {fila.descripcion && <span className="pista">{fila.descripcion}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-title">Timbrado CFDI</div>
        <p className="pie-nota" style={{ maxWidth: '70ch' }}>
          Las facturas se timbran por fuera y aquí solo se registran, con su
          anticipo y su saldo. Cuando se conecte un PAC, sus credenciales van a
          vivir en n8n como credencial, igual que el token de WhatsApp — nunca
          en esta tabla, porque el panel la lee desde el navegador y una llave
          de PAC permite emitir facturas a nombre de Zentec.
        </p>
      </div>
    </>
  )
}
