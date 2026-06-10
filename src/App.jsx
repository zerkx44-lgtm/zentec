import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom'
import Dashboard from './pages/Dashboard.jsx'
import Cotizaciones from './pages/Cotizaciones.jsx'
import Clientes from './pages/Clientes.jsx'
import Productos from './pages/Productos.jsx'
import Ordenes from './pages/Ordenes.jsx'
import Facturas from './pages/Facturas.jsx'
import Configuracion from './pages/Configuracion.jsx'

export default function App() {
  return (
    <BrowserRouter>
      <div className="app">
        <aside className="sidebar">
          <div className="sidebar-logo">
            <h1>ZENTEC</h1>
            <p>Sistema de gestión</p>
          </div>
          <nav className="nav-section">
            <NavLink to="/dashboard" className={({isActive}) => 'nav-item' + (isActive ? ' active' : '')}>
              <i className="ti ti-layout-dashboard" /><span>Dashboard</span>
            </NavLink>
            <NavLink to="/cotizaciones" className={({isActive}) => 'nav-item' + (isActive ? ' active' : '')}>
              <i className="ti ti-file-invoice" /><span>Cotizaciones</span>
            </NavLink>
            <NavLink to="/clientes" className={({isActive}) => 'nav-item' + (isActive ? ' active' : '')}>
              <i className="ti ti-users" /><span>Clientes</span>
            </NavLink>
            <NavLink to="/productos" className={({isActive}) => 'nav-item' + (isActive ? ' active' : '')}>
              <i className="ti ti-box" /><span>Productos</span>
            </NavLink>
            <NavLink to="/ordenes" className={({isActive}) => 'nav-item' + (isActive ? ' active' : '')}>
              <i className="ti ti-tool" /><span>Órdenes trabajo</span>
            </NavLink>
            <NavLink to="/facturas" className={({isActive}) => 'nav-item' + (isActive ? ' active' : '')}>
              <i className="ti ti-receipt" /><span>Facturas</span>
            </NavLink>
          </nav>
          <div className="nav-bottom">
            <NavLink to="/configuracion" className={({isActive}) => 'nav-item' + (isActive ? ' active' : '')}>
              <i className="ti ti-settings" /><span>Configuración</span>
            </NavLink>
          </div>
        </aside>
        <main className="main">
          <div className="page-inner">
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/cotizaciones" element={<Cotizaciones />} />
              <Route path="/clientes" element={<Clientes />} />
              <Route path="/productos" element={<Productos />} />
              <Route path="/ordenes" element={<Ordenes />} />
              <Route path="/facturas" element={<Facturas />} />
              <Route path="/configuracion" element={<Configuracion />} />
            </Routes>
          </div>
        </main>
      </div>
    </BrowserRouter>
  )
}
