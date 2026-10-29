import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext.jsx'
import useExternalSales from '../hooks/useExternalSales.js'
import useProducts from '../hooks/useProducts.js'
import { calculatePrintingEnergyCost } from '../services/finance/costing.js'
import { updateExternalSale } from '../services/sales/externalSales.js'

const statusLabel = { not_started: 'A iniciar', preparing: 'Em preparo', producing: 'Em produção', ready: 'Concluída' }
const productionStatus = (sale) => ['not_started', 'preparing', 'producing', 'ready'].includes(sale.productionStatus)
  ? sale.productionStatus
  : sale.deliveryStatus === 'preparing' ? 'preparing' : 'not_started'
const dateLabel = (value) => value ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(new Date(`${value}T12:00:00`)) : 'Prazo não definido'

export default function ProductionPage() {
  const { workspaceUid } = useAuth()
  const { sales, loading, error } = useExternalSales()
  const { products, loading: productsLoading, error: productsError } = useProducts()
  const [busyId, setBusyId] = useState('')
  const [message, setMessage] = useState('')
  const queue = sales.filter((sale) => sale.status !== 'cancelled')

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
    <div className="page-intro"><div><p className="eyebrow">OPERAÇÃO</p><h2>Produção</h2><p>As vendas ficam aqui para acompanhar o que está por iniciar, em produção ou concluído.</p></div><span className="count-chip">{queue.length} vendas</span></div>
    {(error || productsError) && <div className="sales-error" role="alert">{error || productsError}</div>}{message && <div className="info-banner" role="status"><span>i</span><p>{message}</p></div>}
    {loading || productsLoading ? <div className="panel sales-loading">Carregando vendas…</div> : queue.length === 0 ? <section className="panel planned-panel"><span className="planned-icon">⚙</span><h3>Nenhuma venda registrada</h3><p>As vendas registradas aparecerão aqui para acompanhamento da produção.</p></section> : <div className="production-grid">{queue.map((sale) => {
      const currentStatus = productionStatus(sale)
      const printEstimate = (sale.items || []).reduce((total, item) => {
        const product = products.find((candidate) => candidate.id === item.productId)
        if (!product) return total
        const quantity = Number(item.quantity) || 0
        return {
          hours: total.hours + Number(product.printHours || 0) * quantity,
          cost: total.cost + calculatePrintingEnergyCost(product.printHours, product.electricityRate) * quantity,
        }
      }, { hours: 0, cost: 0 })
      return <article className="panel production-card" key={sale.id}>
        <header><div><span className="sale-code">#{sale.id.slice(0, 7).toUpperCase()} · Venda registrada</span><h3>{sale.client?.name || 'Cliente'}</h3><small>Prazo de entrega: {dateLabel(sale.dueDate)}</small></div><span className={`status-pill ${currentStatus === 'ready' ? 'payment-paid' : currentStatus === 'producing' ? 'payment-partial' : 'payment-pending'}`}>{statusLabel[currentStatus]}</span></header>
        <ul>{(sale.items || []).map((item, index) => {
          const product = products.find((candidate) => candidate.id === item.productId)
          const itemHours = product ? Number(product.printHours || 0) * Number(item.quantity || 0) : 0
          const itemEnergy = product ? calculatePrintingEnergyCost(product.printHours, product.electricityRate) * Number(item.quantity || 0) : 0
          return <li key={`${sale.id}-${index}`}><span>{item.description}{product && Number(product.printHours) > 0 && <small>{itemHours.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} h de impressão · energia {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(itemEnergy)}</small>}</span><strong>× {item.quantity}</strong></li>
        })}</ul>
        {printEstimate.hours > 0 && <div className="production-energy-summary"><span>Tempo estimado de impressão<strong>{printEstimate.hours.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} h</strong></span><span>Energia estimada (220 W)<strong>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(printEstimate.cost)}</strong></span></div>}
        <label>Etapa da produção<select disabled={busyId === sale.id} value={currentStatus} onChange={(event) => changeStatus(sale, event.target.value)}><option value="not_started">A iniciar</option><option value="preparing">Em preparo</option><option value="producing">Em produção</option><option value="ready">Concluída</option></select></label><small>As vendas concluídas permanecem aqui no histórico. Tempo e energia estimados não alteram o estoque automaticamente.</small>
      </article>
    })}</div>}
  </div>
}
