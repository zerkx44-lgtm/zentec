import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'

export default function Configuracion() {
  const [config, setConfig] = useState({})
  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [msg, setMsg] = useState(null)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    const { data } = await supabase.from('configuracion').select('*')
    const map = {}
    data?.forEach(r => { map[r.clave] = r.valor || '' })
    setConfig(map)
    setLoading(false)
  }

  async function guardar() {
    setGuardando(true)
    const updates = Object.entries(config).map(([clave, valor]) =>
      supabase.from('configuracion').update({ valor }).eq('clave', clave)
    )
    await Promise.all(updates)
    setMsg({ type: 'success', text: 'Configuración guardada correctamente' })
    setTimeout(() => setMsg(null), 2500)
    setGuardando(false)
  }

  const set = (k, v) => setConfig(prev => ({ ...prev, [k]: v }))

  if (loading) return <div className="loading">Cargando...</div>

  return (
    <>
      <div className="page-header">
        <span className="page-title">Configuración</span>
      </div>

      {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

      <div className="card">
        <div className="card-title">Datos de la empresa</div>
        <div className="form-grid">
          <div className="form-group"><label>Nombre empresa</label><input value={config.empresa_nombre || ''} onChange={e => set('empresa_nombre', e.target.value)} /></div>
          <div className="form-group"><label>RFC</label><input value={config.empresa_rfc || ''} onChange={e => set('empresa_rfc', e.target.value)} placeholder="RFC de Zentec" /></div>
          <div className="form-group form-full"><label>Dirección fiscal</label><input value={config.empresa_direccion || ''} onChange={e => set('empresa_direccion', e.target.value)} /></div>
          <div className="form-group"><label>Teléfono</label><input value={config.empresa_telefono || ''} onChange={e => set('empresa_telefono', e.target.value)} /></div>
          <div className="form-group"><label>Email</label><input value={config.empresa_email || ''} onChange={e => set('empresa_email', e.target.value)} /></div>
          <div className="form-group"><label>WhatsApp</label><input value={config.whatsapp_numero || ''} onChange={e => set('whatsapp_numero', e.target.value)} placeholder="+52 744..." /></div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Cotizaciones</div>
        <div className="form-grid">
          <div className="form-group"><label>Porcentaje anticipo default</label><input type="number" value={config.anticipo_default || '50'} onChange={e => set('anticipo_default', e.target.value)} /></div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Facturación CFDI <span className="badge badge-amber" style={{ marginLeft: 8, fontSize: 11 }}>Próximamente</span></div>
        <div className="form-grid">
          <div className="form-group">
            <label>Proveedor PAC</label>
            <select value={config.pac_proveedor || ''} onChange={e => set('pac_proveedor', e.target.value)}>
              <option value="">Seleccionar...</option>
              <option value="facturama">Facturama</option>
              <option value="sw_sapien">SW Sapien</option>
              <option value="stamp">Stamp</option>
            </select>
          </div>
          <div className="form-group"><label>API Key PAC</label><input type="password" value={config.pac_api_key || ''} onChange={e => set('pac_api_key', e.target.value)} placeholder="••••••••" /></div>
          <div className="form-group"><label>Serie de facturas</label><input value={config.factura_serie || 'A'} onChange={e => set('factura_serie', e.target.value)} /></div>
          <div className="form-group"><label>Folio inicial</label><input type="number" value={config.factura_folio_inicial || '1'} onChange={e => set('factura_folio_inicial', e.target.value)} /></div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Recordatorios automáticos de pago</div>
        <div className="form-grid">
          <div className="form-group"><label>Días para recordatorio</label><input value={config.recordatorio_dias || '3, 7, 15'} onChange={e => set('recordatorio_dias', e.target.value)} placeholder="ej. 3, 7, 15" /></div>
          <div className="form-group"><label>Canal preferido</label>
            <select value={config.canal_recordatorio || 'whatsapp'} onChange={e => set('canal_recordatorio', e.target.value)}>
              <option value="whatsapp">WhatsApp</option>
              <option value="email">Email</option>
              <option value="ambos">Ambos</option>
            </select>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
        <button className="btn btn-primary" onClick={guardar} disabled={guardando}>
          {guardando ? 'Guardando...' : 'Guardar configuración'}
        </button>
      </div>
    </>
  )
}
