import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/AuthContext.jsx'
import Login from './pages/Login.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Conversaciones from './pages/Conversaciones.jsx'
import Prospectos from './pages/Prospectos.jsx'
import Cotizaciones from './pages/Cotizaciones.jsx'
import Clientes from './pages/Clientes.jsx'
import Productos from './pages/Productos.jsx'
import Ordenes from './pages/Ordenes.jsx'
import Facturas from './pages/Facturas.jsx'
import Configuracion from './pages/Configuracion.jsx'

const claseNav = ({ isActive }) => 'nav-item' + (isActive ? ' active' : '')

function Sidebar() {
  const { usuario, perfil, salir } = useAuth()
  const nombre = perfil?.nombre || usuario?.email || ''
  const inicial = (nombre[0] || '?').toUpperCase()

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <h1>ZENTEC</h1>
        <p>Sistema de gestión</p>
      </div>

      <nav className="nav-section">
        <NavLink to="/dashboard" className={claseNav}>
          <i className="ti ti-layout-dashboard" /><span>Dashboard</span>
        </NavLink>
        <NavLink to="/prospectos" className={claseNav}>
          <i className="ti ti-user-search" /><span>Prospectos</span>
        </NavLink>
        <NavLink to="/conversaciones" className={claseNav}>
          <i className="ti ti-messages" /><span>Conversaciones</span>
        </NavLink>
        <NavLink to="/cotizaciones" className={claseNav}>
          <i className="ti ti-file-invoice" /><span>Cotizaciones</span>
        </NavLink>
        <NavLink to="/clientes" className={claseNav}>
          <i className="ti ti-users" /><span>Clientes</span>
        </NavLink>
        <NavLink to="/productos" className={claseNav}>
          <i className="ti ti-box" /><span>Productos</span>
        </NavLink>
        <NavLink to="/ordenes" className={claseNav}>
          <i className="ti ti-tool" /><span>Órdenes trabajo</span>
        </NavLink>
        <NavLink to="/facturas" className={claseNav}>
          <i className="ti ti-receipt" /><span>Facturas</span>
        </NavLink>
      </nav>

      <div className="nav-bottom">
        <NavLink to="/configuracion" className={claseNav}>
          <i className="ti ti-settings" /><span>Configuración</span>
        </NavLink>

        <div className="usuario-box">
          <div className="usuario-datos">
            <div className="usuario-avatar">{inicial}</div>
            <div className="usuario-texto">
              <span className="usuario-nombre" title={nombre}>{nombre}</span>
              {perfil?.rol && <span className="usuario-rol">{perfil.rol}</span>}
            </div>
          </div>
          <button className="btn btn-sm" onClick={salir} title="Cerrar sesión">
            <i className="ti ti-logout" />
          </button>
        </div>
      </div>
    </aside>
  )
}

function Panel() {
  return (
    <div className="app">
      <Sidebar />
      <main className="main">
        <div className="page-inner">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/prospectos" element={<Prospectos />} />
            <Route path="/conversaciones" element={<Conversaciones />} />
            <Route path="/cotizaciones" element={<Cotizaciones />} />
            <Route path="/clientes" element={<Clientes />} />
            <Route path="/productos" element={<Productos />} />
            <Route path="/ordenes" element={<Ordenes />} />
            <Route path="/facturas" element={<Facturas />} />
            <Route path="/configuracion" element={<Configuracion />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </div>
      </main>
    </div>
  )
}

// Esto es comodidad de interfaz, no seguridad: quien tenga la publishable key
// puede consultar la base desde fuera del panel. Lo que de verdad protege los
// datos son las políticas RLS de Supabase.
function Puerta() {
  const { sesion, cargando } = useAuth()
  if (cargando) return <div className="pantalla-carga">Cargando...</div>
  return sesion ? <Panel /> : <Login />
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Puerta />
      </BrowserRouter>
    </AuthProvider>
  )
}
