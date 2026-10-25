import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import useExternalSales from '../hooks/useExternalSales.js'
import usePreferences from '../hooks/usePreferences.js'

const formatDate = (value) => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
const today = () => formatDate(new Date())
const plusDays = (date, days) => { const value = new Date(`${date}T12:00:00`); value.setDate(value.getDate() + days); return formatDate(value) }
const money = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value) || 0)
const dateLabel = (value) => value ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(new Date(`${value}T12:00:00`)) : 'Sem prazo'

export default function OrdersPage() {
  const { sales, loading, error } = useExternalSales()
  const { preferences } = usePreferences()
  const orders = useMemo(() => sales.filter((sale) => sale.status !== 'cancelled'), [sales])
  const dueSoon = orders.filter((sale) => sale.dueDate && sale.dueDate <= plusDays(today(), Number(preferences.dueAlertDays || 3)) && sale.dueDate >= today() && sale.deliveryStatus !== 'delivered')
  const overdue = orders.filter((sale) => sale.dueDate && sale.dueDate < today() && sale.deliveryStatus !== 'delivered')

  return <div className="page-stack">
    <div className="page-intro"><div><p className="eyebrow">OPERAÇÃO</p><h2>Pedidos e prazos</h2><p>Acompanhe datas de entrega dos pedidos físicos e online registrados no sistema.</p></div><Link to="/vendas" className="button button-primary">＋ Registrar pedido</Link></div>
    <div className="sales-summary-grid"><article className="sales-summary-card"><span>Pedidos ativos</span><strong>{orders.length}</strong><small>Pedidos não cancelados</small></article><article className="sales-summary-card"><span>Próximos 3 dias</span><strong>{dueSoon.length}</strong><small>Prazo de entrega chegando</small></article><article className="sales-summary-card"><span>Atrasados</span><strong>{overdue.length}</strong><small>Prazo vencido e não entregue</small></article></div>
    {preferences.dailyDueAlertsEnabled && (dueSoon.length || overdue.length) > 0 && <section className="alert alert-error" role="status"><strong>Alerta diário de prazos</strong><span>{overdue.length ? `${overdue.length} pedido(s) atrasado(s). ` : ''}{dueSoon.length ? `${dueSoon.length} pedido(s) vencem em até ${preferences.dueAlertDays} dias.` : ''}</span></section>}
    <section className="panel orders-table-panel"><div className="sales-list-heading"><div><h3>Todos os pedidos</h3><p>Configure os alertas de prazo na área Configurações.</p></div><Link className="button button-secondary" to="/configuracoes">Configurar alertas</Link></div>
      {error && <div className="sales-error">{error}</div>}
      {loading ? <div className="sales-loading">Carregando pedidos…</div> : <div className="sales-table-scroll"><table className="sales-table"><thead><tr><th>Pedido</th><th>Cliente</th><th>Tipo</th><th>Prazo</th><th>Status</th><th>Total</th></tr></thead><tbody>{orders.map((sale) => <tr key={sale.id}><td><strong className="sale-code">#{sale.id.slice(0, 7).toUpperCase()}</strong></td><td><strong className="table-primary-text">{sale.client?.name || 'Cliente'}</strong><small>{sale.client?.phone || sale.client?.email || 'Sem contato'}</small></td><td>{sale.orderType === 'online' ? 'Online' : 'Físico'}</td><td>{dateLabel(sale.dueDate)}{sale.dueDate && sale.dueDate < today() && sale.deliveryStatus !== 'delivered' && <small className="deadline-overdue">Atrasado</small>}</td><td>{sale.productionStatus === 'producing' ? 'Em produção' : sale.productionStatus === 'preparing' || sale.deliveryStatus === 'preparing' ? 'Em preparo' : sale.deliveryStatus === 'delivered' ? 'Entregue' : sale.deliveryStatus || 'A combinar'}</td><td>{money(sale.total)}</td></tr>)}{orders.length === 0 && <tr><td colSpan="6"><div className="table-empty"><strong>Nenhum pedido registrado</strong><span>Registre pedidos em Vendas externas para acompanhar prazos e produção.</span></div></td></tr>}</tbody></table></div>}
    </section>
    <div className="info-banner"><span>i</span><p>As notificações do navegador dependem da permissão do navegador e do Print Caju estar aberto. A integração com marketplaces online ainda não está conectada; registre esses pedidos em Vendas externas.</p></div>
  </div>
}
