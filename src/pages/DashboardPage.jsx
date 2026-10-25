import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import useExternalSales from '../hooks/useExternalSales.js'
import useProducts from '../hooks/useProducts.js'
import useFinancialTransactions from '../hooks/useFinancialTransactions.js'
import { useAuth } from '../contexts/AuthContext.jsx'
import { watchAgendaItems } from '../services/agenda/agenda.js'

const money = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value) || 0)
const dateKey = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
const formatDate = (value) => {
  if (!value) return 'Sem prazo'
  const [year, month, day] = value.split('-').map(Number)
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(new Date(year, month - 1, day))
}
const itemStatus = (item) => item.status || (item.completed ? 'completed' : 'open')

function FinanceCards({ sales, loading, error }) {
  const active = sales.filter((sale) => sale.status !== 'cancelled')
  const totals = [
    active.reduce((sum, sale) => sum + (Number(sale.total) || 0), 0),
    active.reduce((sum, sale) => sum + (Number(sale.receivedAmount) || 0), 0),
    active.reduce((sum, sale) => sum + (Number(sale.fees) || 0), 0),
    active.reduce((sum, sale) => sum + (Number(sale.outstandingAmount) || 0), 0),
  ]
  const labels = [
    ['Faturamento bruto', 'Vendas externas ativas', '↗', 'purple'],
    ['Recebido', 'Valor recebido dos clientes', '↓', 'green'],
    ['Taxas de venda', 'Taxas informadas nos registros', '↙', 'orange'],
    ['A receber', 'Saldo pendente dos clientes', '◷', 'blue'],
  ]
  return <div className="metric-grid">{labels.map(([label, detail, icon, tone], index) => <article className="metric-card" key={label}><div className="metric-card-top"><span>{label}</span><span className={`metric-icon metric-${tone}`}>{icon}</span></div><strong className="metric-value">{loading ? '…' : error ? '—' : money(totals[index])}</strong><small>{error ? 'Falha ao carregar vendas' : loading ? 'Carregando registros…' : detail}</small></article>)}</div>
}

function MonthBars({ transactions, month }) {
  const points = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(month.getFullYear(), month.getMonth() - (5 - index), 1)
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    const monthRows = transactions.filter((row) => row.status !== 'cancelled' && row.date?.startsWith(key))
    return {
      key,
      label: new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(date).replace('.', ''),
      income: monthRows.filter((row) => row.type === 'income').reduce((sum, row) => sum + Number(row.amount || 0), 0),
      expense: monthRows.filter((row) => row.type === 'expense').reduce((sum, row) => sum + Number(row.amount || 0), 0),
    }
  })
  const max = Math.max(1, ...points.flatMap((point) => [point.income, point.expense]))
  return <div className="dashboard-bars" aria-label="Entradas e saídas dos últimos seis meses">{points.map((point) => <div className="dashboard-bar-month" key={point.key}>
    <div className="dashboard-bar-pair" title={`${point.label}: ${money(point.income)} em entradas e ${money(point.expense)} em saídas`}>
      <span className="dashboard-bar-income" style={{ height: `${Math.max(3, point.income / max * 100)}%` }} />
      <span className="dashboard-bar-expense" style={{ height: `${Math.max(3, point.expense / max * 100)}%` }} />
    </div><small>{point.label}</small>
  </div>)}</div>
}

export default function DashboardPage() {
  const { sales, loading: salesLoading, error: salesError } = useExternalSales()
  const { products, loading: productsLoading } = useProducts()
  const { transactions, loading: financeLoading } = useFinancialTransactions()
  const { workspaceUid } = useAuth()
  const [agendaItems, setAgendaItems] = useState([])
  const [agendaLoading, setAgendaLoading] = useState(true)
  const now = new Date()
  const today = dateKey(now)
  const month = today.slice(0, 7)

  useEffect(() => {
    if (!workspaceUid) { setAgendaItems([]); setAgendaLoading(false); return undefined }
    setAgendaLoading(true)
    return watchAgendaItems(workspaceUid, (rows) => { setAgendaItems(rows); setAgendaLoading(false) }, () => { setAgendaItems([]); setAgendaLoading(false) })
  }, [workspaceUid])

  const activeSales = sales.filter((sale) => sale.status !== 'cancelled')
  const lateOrders = activeSales.filter((sale) => sale.dueDate && sale.dueDate < today && sale.deliveryStatus !== 'delivered')
  const lowStock = products.filter((product) => product.active !== false && Number(product.quantity) <= Number(product.minStock))
  const unfinishedAgenda = agendaItems.filter((item) => ['open', 'in_progress'].includes(itemStatus(item)))
  const monthTransactions = transactions.filter((row) => row.status !== 'cancelled' && row.date?.startsWith(month))
  const income = monthTransactions.filter((row) => row.type === 'income').reduce((sum, row) => sum + Number(row.amount || 0), 0)
  const expenses = monthTransactions.filter((row) => row.type === 'expense').reduce((sum, row) => sum + Number(row.amount || 0), 0)
  const agendaSoon = useMemo(() => unfinishedAgenda.filter((item) => item.date >= today).sort((a, b) => `${a.date}T${a.time || ''}`.localeCompare(`${b.date}T${b.time || ''}`)).slice(0, 5), [unfinishedAgenda, today])
  const recentSales = useMemo(() => [...activeSales].sort((a, b) => (b.soldAt || '').localeCompare(a.soldAt || '')).slice(0, 5), [activeSales])
  const monthLabel = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(now)

  return <div className="page-stack dashboard-page">
    <section className="welcome-banner">
      <div><p className="eyebrow">VISÃO GERAL</p><h2>Seu negócio, em um só lugar.</h2><p>Acompanhe vendas, pedidos, estoque, agenda e resultados financeiros da Print Caju.</p></div>
      <img className="banner-mark" src="/printcaju-mark.png" alt="Caju, símbolo da Print Caju" />
    </section>

    <section aria-labelledby="finance-heading">
      <div className="section-heading"><div><h2 id="finance-heading">Resumo das vendas externas</h2><p>Calculado a partir dos registros persistidos no Firestore</p></div><Link className="period-chip dashboard-period-link" to="/vendas">Ver vendas ↗</Link></div>
      <FinanceCards sales={sales} loading={salesLoading} error={salesError} />
    </section>

    <section aria-labelledby="operation-heading">
      <div className="section-heading"><div><h2 id="operation-heading">Visão da operação</h2><p>O que precisa de atenção hoje</p></div><span className="period-chip">Atualizado em tempo real</span></div>
      <div className="dashboard-operation-grid">
        <Link to="/pedidos" className="dashboard-operation-card"><span className="dashboard-operation-icon dashboard-tone-blue">▤</span><span><small>Pedidos ativos</small><strong>{salesLoading ? '…' : activeSales.length}</strong><em>{lateOrders.length ? `${lateOrders.length} atrasado(s)` : 'Nenhum atraso'}</em></span></Link>
        <Link to="/estoque" className="dashboard-operation-card"><span className="dashboard-operation-icon dashboard-tone-orange">▦</span><span><small>Estoque baixo</small><strong>{productsLoading ? '…' : lowStock.length}</strong><em>{lowStock.length ? 'Produto(s) precisam de reposição' : 'Tudo dentro do mínimo'}</em></span></Link>
        <Link to="/agenda" className="dashboard-operation-card"><span className="dashboard-operation-icon dashboard-tone-purple">◷</span><span><small>Tarefas em aberto</small><strong>{agendaLoading ? '…' : unfinishedAgenda.length}</strong><em>{agendaItems.filter((item) => itemStatus(item) === 'in_progress').length} em andamento</em></span></Link>
        <Link to="/financeiro" className="dashboard-operation-card"><span className="dashboard-operation-icon dashboard-tone-green">R$</span><span><small>Saldo do mês</small><strong>{financeLoading ? '…' : money(income - expenses)}</strong><em>{monthLabel}</em></span></Link>
      </div>
    </section>

    <section className="dashboard-grid dashboard-detail-grid">
      <article className="panel chart-panel dashboard-finance-panel">
        <div className="panel-heading"><div><h2>Financeiro do mês</h2><p>Entradas e saídas registradas · {monthLabel}</p></div><Link className="text-link" to="/financeiro">Abrir financeiro <span>→</span></Link></div>
        <div className="dashboard-month-summary"><div><small>Entradas</small><strong>{financeLoading ? '…' : money(income)}</strong></div><div><small>Saídas</small><strong>{financeLoading ? '…' : money(expenses)}</strong></div><div><small>Lançamentos</small><strong>{financeLoading ? '…' : monthTransactions.length}</strong></div></div>
        {financeLoading ? <div className="dashboard-loading">Carregando movimentações…</div> : <MonthBars transactions={transactions} month={now} />}
        <div className="chart-legend"><span><i className="legend-revenue" />Entradas</span><span><i className="legend-expense" />Saídas</span></div>
      </article>
      <article className="panel orders-summary dashboard-recent-panel">
        <div className="panel-heading"><div><h2>Vendas recentes</h2><p>Últimos registros ativos</p></div><Link className="text-link" to="/vendas">Ver todas <span>→</span></Link></div>
        {salesLoading ? <div className="dashboard-loading">Carregando vendas…</div> : recentSales.length ? <div className="dashboard-recent-list">{recentSales.map((sale) => <div className="dashboard-recent-row" key={sale.id}><span className="dashboard-recent-avatar">{(sale.client?.name || 'C').charAt(0).toUpperCase()}</span><span className="dashboard-recent-copy"><strong>{sale.client?.name || 'Cliente'}</strong><small>{sale.soldAt ? formatDate(sale.soldAt) : 'Data não informada'} · {sale.deliveryStatus === 'delivered' ? 'Entregue' : 'Em andamento'}</small></span><b>{money(sale.total)}</b></div>)}</div> : <div className="dashboard-empty-small">Ainda não há vendas registradas.</div>}
      </article>
    </section>

    <section className="panel dashboard-agenda-panel">
      <div className="panel-heading"><div><h2>Próximas tarefas e reuniões</h2><p>Compromissos em aberto e em andamento</p></div><Link className="text-link" to="/agenda">Abrir agenda <span>→</span></Link></div>
      {agendaLoading ? <div className="dashboard-loading">Carregando agenda…</div> : agendaSoon.length ? <div className="dashboard-upcoming-list">{agendaSoon.map((item) => <div className="dashboard-upcoming-row" key={item.id}><span className="dashboard-upcoming-date"><strong>{formatDate(item.date)}</strong><small>{item.time || 'Dia todo'}</small></span><span className="dashboard-upcoming-copy"><strong>{item.title}</strong><small>{item.type === 'meeting' ? 'Reunião' : item.type === 'reminder' ? 'Lembrete' : 'Tarefa'} · {itemStatus(item) === 'in_progress' ? 'Em andamento' : 'Em aberto'}</small></span><span className="dashboard-upcoming-status">{itemStatus(item) === 'in_progress' ? 'Em andamento' : 'Em aberto'}</span></div>)}</div> : <div className="dashboard-empty-small">Nenhum compromisso futuro em aberto. <Link to="/agenda">Adicionar à agenda</Link></div>}
    </section>

    <section className="quick-links dashboard-quick-links">
      <div><span className="quick-link-icon">＋</span><span><strong>Acesso rápido</strong><small>Abra uma área para continuar trabalhando</small></span></div>
      <div className="dashboard-quick-actions"><Link to="/vendas" className="text-link">Registrar venda <span>→</span></Link><Link to="/produtos" className="text-link">Ver produtos <span>→</span></Link><Link to="/agenda" className="text-link">Nova tarefa <span>→</span></Link></div>
    </section>
  </div>
}
