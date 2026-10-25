import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext.jsx'
import useExternalSales from '../hooks/useExternalSales.js'
import { updateExternalSale } from '../services/sales/externalSales.js'

const statusLabel = { preparing: 'Em preparo', producing: 'Em produção', ready: 'Produção concluída' }
const dateLabel = (value) => value ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(new Date(`${value}T12:00:00`)) : 'Prazo não definido'

export default function ProductionPage() {
  const { workspaceUid } = useAuth()
  const { sales, loading, error } = useExternalSales()
  const [busyId, setBusyId] = useState('')
  const [message, setMessage] = useState('')
  const queue = sales.filter((sale) => sale.status !== 'cancelled' && (['preparing', 'producing'].includes(sale.productionStatus) || sale.deliveryStatus === 'preparing'))

  async function changeStatus(sale, productionStatus) {
    setBusyId(sale.id)
    setMessage('')
    try {
      await updateExternalSale(workspaceUid, sale.id, { productionStatus })
      setMessage(`Pedido #${sale.id.slice(0, 7).toUpperCase()} atualizado para ${statusLabel[productionStatus]}.`)
    } catch {
      setMessage('Não foi possível atualizar o pedido. Tente novamente.')
    } finally { setBusyId('') }
  }

  return <div className="page-stack">
    <div className="page-intro"><div><p className="eyebrow">OPERAÇÃO</p><h2>Produção</h2><p>Pedidos físicos e online em preparo ou fabricação ficam reunidos nesta fila.</p></div><span className="count-chip">{queue.length} na fila</span></div>
    {error && <div className="sales-error">{error}</div>}{message && <div className="info-banner" role="status"><span>i</span><p>{message}</p></div>}
    {loading ? <div className="panel sales-loading">Carregando fila…</div> : queue.length === 0 ? <section className="panel planned-panel"><span className="planned-icon">⚙</span><h3>Fila de produção vazia</h3><p>Ao cadastrar ou editar uma venda, escolha “Em preparo” ou “Em produção” para encaminhá-la para cá.</p></section> : <div className="production-grid">{queue.map((sale) => <article className="panel production-card" key={sale.id}><header><div><span className="sale-code">#{sale.id.slice(0, 7).toUpperCase()} · {sale.orderType === 'online' ? 'Online' : 'Físico'}</span><h3>{sale.client?.name || 'Cliente'}</h3><small>Prazo de entrega: {dateLabel(sale.dueDate)}</small></div><span className={`status-pill ${sale.productionStatus === 'producing' ? 'payment-partial' : 'payment-pending'}`}>{statusLabel[sale.productionStatus] || 'Em preparo'}</span></header><ul>{(sale.items || []).map((item, index) => <li key={`${sale.id}-${index}`}><span>{item.description}</span><strong>× {item.quantity}</strong></li>)}</ul><label>Atualizar etapa<select disabled={busyId === sale.id} value={sale.productionStatus === 'producing' ? 'producing' : 'preparing'} onChange={(event) => changeStatus(sale, event.target.value)}><option value="preparing">Em preparo</option><option value="producing">Em produção</option></select></label><small>Ao concluir, edite a venda e marque a produção como concluída.</small></article>)}</div>}
  </div>
}
