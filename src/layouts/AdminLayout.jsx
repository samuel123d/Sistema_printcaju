import { useEffect, useMemo, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import Brand from '../components/Brand.jsx'
import { useAuth } from '../contexts/AuthContext.jsx'
import useExternalSales from '../hooks/useExternalSales.js'
import useProducts from '../hooks/useProducts.js'
import usePreferences from '../hooks/usePreferences.js'

function DailySystemAlerts({ preferences }) {
  const { user } = useAuth()
  const { sales } = useExternalSales()
  const { products } = useProducts()
  const current = new Date()
  const today = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`
  const horizon = new Date(current.getFullYear(), current.getMonth(), current.getDate() + Number(preferences.dueAlertDays || 3))
  const until = `${horizon.getFullYear()}-${String(horizon.getMonth() + 1).padStart(2, '0')}-${String(horizon.getDate()).padStart(2, '0')}`
  const counts = useMemo(() => {
    const orders = preferences.dailyDueAlertsEnabled ? sales.filter((sale) => sale.status !== 'cancelled' && sale.deliveryStatus !== 'delivered') : []
    const low = preferences.lowStockAlertsEnabled ? products.filter((product) => product.active !== false && Number(product.quantity) <= Number(product.minStock)) : []
    return {
      overdue: orders.filter((sale) => sale.dueDate && sale.dueDate < today).length,
      dueSoon: orders.filter((sale) => sale.dueDate && sale.dueDate >= today && sale.dueDate <= until).length,
      lowStock: low.length,
    }
  }, [sales, products, today, until, preferences.dailyDueAlertsEnabled, preferences.lowStockAlertsEnabled])

  useEffect(() => {
    if (!user?.uid || !preferences.desktopNotificationsEnabled || (!counts.overdue && !counts.dueSoon && !counts.lowStock) || !('Notification' in window) || Notification.permission !== 'granted') return
    const key = `printcaju-daily-alerts-${user.uid}-${today}`
    try {
      if (localStorage.getItem(key)) return
      localStorage.setItem(key, 'sent')
      new Notification('Print Caju · Alertas diários', { body: `${counts.overdue} pedido(s) atrasado(s), ${counts.dueSoon} próximo(s) do prazo e ${counts.lowStock} produto(s) com estoque baixo.`, icon: '/printcaju-mark.png' })
    } catch (cause) { console.warn('Não foi possível exibir a notificação do navegador.', cause) }
  }, [user?.uid, today, counts.overdue, counts.dueSoon, counts.lowStock, preferences.desktopNotificationsEnabled])

  if (!counts.overdue && !counts.dueSoon && !counts.lowStock) return null
  return <div className="daily-order-alert" role="status"><strong>Alertas</strong><span>{counts.overdue ? `${counts.overdue} pedido(s) atrasado(s)` : ''}{counts.overdue && counts.dueSoon ? ' · ' : ''}{counts.dueSoon ? `${counts.dueSoon} vencem em até ${preferences.dueAlertDays} dias` : ''}{(counts.overdue || counts.dueSoon) && counts.lowStock ? ' · ' : ''}{counts.lowStock ? `${counts.lowStock} produto(s) com estoque baixo` : ''}</span>{(counts.overdue || counts.dueSoon) && <Link to="/pedidos">Ver pedidos</Link>}{counts.lowStock > 0 && <Link to="/estoque">Ver estoque</Link>}</div>
}

const navigation = [
  { label: 'Dashboard', path: '/', glyph: '▦' },
  { label: 'Pedidos', path: '/pedidos', glyph: '▤' },
  { label: 'Vendas externas', path: '/vendas', glyph: '↗' },
  { label: 'Financeiro', path: '/financeiro', glyph: '◉' },
  { label: 'Produtos', path: '/produtos', glyph: '◇' },
  { label: 'Produção', path: '/producao', glyph: '⚙' },
  { label: 'Estoque', path: '/estoque', glyph: '▥' },
  { label: 'Compras', path: '/compras', glyph: '＋' },
  { label: 'Relatórios', path: '/relatorios', glyph: '▧' },
  { label: 'Agenda e tarefas', path: '/agenda', glyph: '◷' },
  { label: 'Configurações', path: '/configuracoes', glyph: '⚙' },
]

export default function AdminLayout() {
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()
  const { user, signOut } = useAuth()
  const { preferences, profile } = usePreferences()
  const current = navigation.find((item) => item.path === location.pathname)?.label ?? 'Dashboard'
  const displayName = profile.displayName || user?.displayName || 'Administrador'

  return <div className="admin-shell">
    {menuOpen && <button className="mobile-scrim" aria-label="Fechar menu" onClick={() => setMenuOpen(false)} />}
    <aside className={`sidebar ${menuOpen ? 'sidebar-open' : ''}`}>
      <Brand />
      <div className="sidebar-label">ESPAÇO DE TRABALHO</div>
      <nav className="side-nav" aria-label="Navegação principal">
        {navigation.map((item) => <NavLink key={item.path} to={item.path} end={item.path === '/'} className={({ isActive }) => `nav-item ${isActive ? 'nav-item-active' : ''}`} onClick={() => setMenuOpen(false)}>
          <span className="nav-glyph" aria-hidden="true">{item.glyph}</span>{item.label}{item.path === '/pedidos' && <span className="nav-shortcut">›</span>}
        </NavLink>)}
      </nav>
      <div className="sidebar-bottom"><div className="sidebar-user">
        <span className="user-avatar">{profile.photoURL ? <img src={profile.photoURL} alt="" /> : displayName.charAt(0).toUpperCase()}</span>
        <span className="user-meta"><strong>{displayName}</strong><small>{user?.email}</small></span>
      </div></div>
    </aside>
    <div className="main-column">
      <header className="topbar">
        <button className="mobile-menu-button" onClick={() => setMenuOpen(true)} aria-label="Abrir menu">☰</button>
        <div className="topbar-heading"><span>{preferences.businessName || 'Print Caju'} Admin</span><h1>{current}</h1></div>
        <div className="topbar-actions"><span className="private-chip"><span />Área privada</span><Link className="icon-button settings-shortcut" aria-label="Configurações" to="/configuracoes">⚙</Link><button className="button button-quiet signout-button" onClick={signOut}>Sair</button></div>
      </header>
      <main className="page-content"><DailySystemAlerts preferences={preferences} /><Outlet /></main>
      <footer className="app-footer">{preferences.businessName || 'Print Caju'} Admin <span>•</span> Ambiente privado</footer>
    </div>
  </div>
}
