import { useMemo, useState } from 'react'
import { useAuth } from '../contexts/AuthContext.jsx'
import useExternalSales from '../hooks/useExternalSales.js'
import { cancelExternalSale, createExternalSale, updateExternalSale } from '../services/sales/externalSales.js'

const channelLabels = { whatsapp: 'WhatsApp', instagram: 'Instagram', presencial: 'Presencial', outro: 'Outro' }
const paymentLabels = { pending: 'Pendente', partial: 'Parcial', paid: 'Recebido' }
const deliveryLabels = { pending: 'A combinar', preparing: 'Em preparação', ready: 'Pronto', shipped: 'Enviado', delivered: 'Entregue', pickup: 'Retirada' }
const emptyItem = () => ({ description: '', quantity: '1', unitPrice: '' })

function localToday() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function emptyForm() {
  return {
    clientName: '', phone: '', email: '', channel: 'whatsapp', soldAt: localToday(),
    deliveryMethod: 'delivery', address: '', city: '', state: '', postalCode: '',
    items: [emptyItem()], discount: '0', fees: '0', receivedAmount: '0',
    deliveryStatus: 'pending', dueDate: '', orderType: 'physical', productionStatus: 'not_started', paymentMethod: 'dinheiro', notes: '',
  }
}

function money(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value) || 0)
}

function amount(value) {
  return Number.parseFloat(String(value ?? '0').replace(',', '.')) || 0
}

function dateLabel(value) {
  if (!value) return '—'
  const [year, month, day] = value.split('-').map(Number)
  return new Intl.DateTimeFormat('pt-BR').format(new Date(year, month - 1, day))
}

function paymentStatus(total, received) {
  if (received <= 0) return 'pending'
  if (received + 0.005 >= total) return 'paid'
  return 'partial'
}

function formFromSale(sale) {
  return {
    clientName: sale.client?.name ?? '', phone: sale.client?.phone ?? '', email: sale.client?.email ?? '',
    channel: sale.channel ?? 'whatsapp', soldAt: sale.soldAt ?? localToday(),
    deliveryMethod: sale.deliveryMethod ?? 'delivery', address: sale.delivery?.address ?? '',
    city: sale.delivery?.city ?? '', state: sale.delivery?.state ?? '', postalCode: sale.delivery?.postalCode ?? '',
    items: (sale.items ?? []).map((item) => ({ description: item.description, quantity: String(item.quantity), unitPrice: String(item.unitPrice) })),
    discount: String(sale.discount ?? 0), fees: String(sale.fees ?? 0), receivedAmount: String(sale.receivedAmount ?? 0),
    deliveryStatus: sale.deliveryStatus ?? 'pending', dueDate: sale.dueDate ?? '', orderType: sale.orderType ?? 'physical', productionStatus: sale.productionStatus ?? (sale.deliveryStatus === 'preparing' ? 'preparing' : 'not_started'), paymentMethod: ['dinheiro', 'transferencia', 'outro'].includes(sale.paymentMethod) ? sale.paymentMethod : 'dinheiro', notes: sale.notes ?? '',
  }
}

function firestoreErrorMessage(error) {
  if (error.code === 'permission-denied') return 'O Firestore recusou a operação. Confirme se as regras publicadas incluem o acesso em users/{uid}/externalSales.'
  if (error.code === 'unavailable' || error.code === 'network-request-failed') return 'Sem conexão com o Firestore. Verifique sua internet e tente novamente.'
  return 'Não foi possível salvar a venda. Revise os dados e tente novamente.'
}

function SaleForm({ sale, onClose, onSaved }) {
  const { user, workspaceUid } = useAuth()
  const [form, setForm] = useState(() => sale ? formFromSale(sale) : emptyForm())
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const subtotal = form.items.reduce((sum, item) => sum + Math.max(0, amount(item.quantity)) * Math.max(0, amount(item.unitPrice)), 0)
  const discount = Math.max(0, amount(form.discount))
  const fees = Math.max(0, amount(form.fees))
  const total = Math.max(0, subtotal - discount)
  const received = Math.max(0, amount(form.receivedAmount))
  const due = Math.max(0, total - received)

  function change(field, value) { setForm((current) => ({ ...current, [field]: value })) }
  function changeItem(index, field, value) {
    setForm((current) => ({ ...current, items: current.items.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item) }))
  }

  async function submit(event) {
    event.preventDefault()
    setFormError('')
    if (!form.clientName.trim()) return setFormError('Informe o nome do cliente.')
    if (!form.soldAt) return setFormError('Informe a data da venda.')
    if (!form.items.length || form.items.some((item) => !item.description.trim() || Number(item.quantity) < 1 || amount(item.unitPrice) < 0 || item.unitPrice === '')) {
      return setFormError('Preencha o produto, a quantidade e o valor unitário de cada item.')
    }
    if (discount > subtotal) return setFormError('O desconto não pode ser maior que o subtotal.')
    if (total <= 0) return setFormError('O total da venda precisa ser maior que zero.')
    if (received > total) return setFormError('O valor recebido não pode ser maior que o total da venda.')
    if (form.deliveryMethod === 'delivery' && !form.address.trim()) return setFormError('Informe o endereço para a entrega.')

    const saleData = {
      channel: form.channel,
      soldAt: form.soldAt,
      client: { name: form.clientName.trim(), phone: form.phone.trim(), email: form.email.trim() },
      deliveryMethod: form.deliveryMethod,
      delivery: form.deliveryMethod === 'delivery'
        ? { address: form.address.trim(), city: form.city.trim(), state: form.state.trim().toUpperCase(), postalCode: form.postalCode.trim() }
        : null,
      items: form.items.map((item) => ({
        description: item.description.trim(),
        quantity: Number(item.quantity),
        unitPrice: amount(item.unitPrice),
        lineTotal: Number((Number(item.quantity) * amount(item.unitPrice)).toFixed(2)),
      })),
      subtotal: Number(subtotal.toFixed(2)),
      discount: Number(discount.toFixed(2)),
      fees: Number(fees.toFixed(2)),
      total: Number(total.toFixed(2)),
      receivedAmount: Number(received.toFixed(2)),
      outstandingAmount: Number(due.toFixed(2)),
      estimatedNet: Number((total - fees).toFixed(2)),
      paymentStatus: paymentStatus(total, received),
      paymentMethod: form.paymentMethod,
      orderType: form.orderType,
      dueDate: form.dueDate,
      productionStatus: form.productionStatus,
      deliveryStatus: form.deliveryStatus,
      notes: form.notes.trim(),
    }

    setSaving(true)
    try {
      if (sale) await updateExternalSale(workspaceUid, sale.id, saleData)
      else await createExternalSale(workspaceUid, saleData, user.uid)
      onSaved(sale ? 'Venda atualizada.' : 'Venda registrada com sucesso.')
    } catch (error) {
      setFormError(firestoreErrorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="sale-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="sale-modal" role="dialog" aria-modal="true" aria-labelledby="sale-form-title">
        <header className="sale-modal-header">
          <div><p className="eyebrow">VENDAS EXTERNAS</p><h2 id="sale-form-title">{sale ? 'Editar venda' : 'Registrar venda'}</h2><p>Preencha os dados do cliente e da venda.</p></div>
          <button className="modal-close" type="button" onClick={onClose} aria-label="Fechar formulário">×</button>
        </header>
        <form className="sale-form" onSubmit={submit}>
          <section className="form-section">
            <div className="form-section-title"><span>01</span><div><h3>Cliente e venda</h3><p>Informações para identificar este atendimento.</p></div></div>
            <div className="form-grid form-grid-two">
              <label className="field-span-two">Nome do cliente <b>*</b><input required maxLength={120} value={form.clientName} onChange={(event) => change('clientName', event.target.value)} placeholder="Nome e sobrenome" /></label>
              <label>WhatsApp / telefone<input type="tel" maxLength={30} value={form.phone} onChange={(event) => change('phone', event.target.value)} placeholder="(00) 00000-0000" /></label>
              <label>E-mail <span className="optional-label">opcional</span><input type="email" maxLength={160} value={form.email} onChange={(event) => change('email', event.target.value)} placeholder="cliente@email.com" /></label>
              <label>Canal da venda <b>*</b><select value={form.channel} onChange={(event) => change('channel', event.target.value)}><option value="whatsapp">WhatsApp</option><option value="instagram">Instagram</option><option value="presencial">Presencial</option><option value="outro">Outro</option></select></label>
              <label>Tipo de pedido<select value={form.orderType} onChange={(event) => change('orderType', event.target.value)}><option value="physical">Produto físico</option><option value="online">Pedido online</option></select></label>
              <label>Data da venda <b>*</b><input type="date" required value={form.soldAt} onChange={(event) => change('soldAt', event.target.value)} /></label>
            </div>
          </section>

          <section className="form-section">
            <div className="form-section-title"><span>02</span><div><h3>Itens da venda</h3><p>Adicione os produtos, quantidades e preços combinados.</p></div></div>
            <div className="sale-items-head"><span>Produto / descrição</span><span>Qtd.</span><span>Valor unitário</span><span>Total</span><span /></div>
            <div className="sale-item-list">
              {form.items.map((item, index) => <div className="sale-item-row" key={index}>
                <input aria-label="Produto ou descrição" required maxLength={140} value={item.description} onChange={(event) => changeItem(index, 'description', event.target.value)} placeholder="Ex.: Suporte personalizado" />
                <input aria-label="Quantidade" type="number" required min="1" step="1" value={item.quantity} onChange={(event) => changeItem(index, 'quantity', event.target.value)} />
                <input aria-label="Valor unitário em reais" type="number" required min="0" step="0.01" value={item.unitPrice} onChange={(event) => changeItem(index, 'unitPrice', event.target.value)} placeholder="0,00" />
                <strong>{money(amount(item.quantity) * amount(item.unitPrice))}</strong>
                <button className="remove-item" type="button" aria-label={`Remover item ${index + 1}`} disabled={form.items.length === 1} onClick={() => setForm((current) => ({ ...current, items: current.items.filter((_, itemIndex) => itemIndex !== index) }))}>×</button>
              </div>)}
            </div>
            <button type="button" className="add-item-button" onClick={() => setForm((current) => ({ ...current, items: [...current.items, emptyItem()] }))}>＋ Adicionar produto</button>
            <div className="sale-totals">
              <div><span>Subtotal</span><strong>{money(subtotal)}</strong></div>
              <label>Desconto<input type="number" min="0" step="0.01" value={form.discount} onChange={(event) => change('discount', event.target.value)} /></label>
              <label>Taxas da venda<input type="number" min="0" step="0.01" value={form.fees} onChange={(event) => change('fees', event.target.value)} /></label>
              <div className="sale-total"><span>Total da venda</span><strong>{money(total)}</strong></div>
            </div>
          </section>

          <section className="form-section">
            <div className="form-section-title"><span>03</span><div><h3>Pagamento e entrega</h3><p>O saldo pendente é calculado com o valor já recebido.</p></div></div>
            <div className="form-grid form-grid-two">
              <label>Forma de pagamento<select value={form.paymentMethod} onChange={(event) => change('paymentMethod', event.target.value)}><option value="dinheiro">Dinheiro</option><option value="transferencia">Transferência</option><option value="outro">Outra</option></select></label>
              <label>Valor recebido (R$)<input type="number" min="0" step="0.01" value={form.receivedAmount} onChange={(event) => change('receivedAmount', event.target.value)} /></label>
              <div className="payment-summary"><span>Status do pagamento</span><strong className={`status-pill payment-${paymentStatus(total, received)}`}>{paymentLabels[paymentStatus(total, received)]}</strong><small>{due > 0 ? `${money(due)} pendente` : 'Venda totalmente recebida'}</small></div>
              <label>Entrega / retirada<select value={form.deliveryMethod} onChange={(event) => change('deliveryMethod', event.target.value)}><option value="delivery">Entrega</option><option value="pickup">Retirada pelo cliente</option></select></label>
              <label>Prazo de entrega<input type="date" value={form.dueDate} onChange={(event) => change('dueDate', event.target.value)} /><small>Usado para alertas de pedidos próximos do prazo.</small></label>
              <label>Status da produção<select value={form.productionStatus} onChange={(event) => change('productionStatus', event.target.value)}><option value="not_started">Ainda não começou</option><option value="preparing">Em preparo</option><option value="producing">Em produção</option><option value="ready">Produção concluída</option></select><small>Pedidos em preparo ou produção aparecem na fila de Produção.</small></label>
              <label>Status da entrega<select value={form.deliveryStatus} onChange={(event) => change('deliveryStatus', event.target.value)}><option value="pending">A combinar</option><option value="preparing">Em preparação</option><option value="ready">Pronto</option><option value="shipped">Enviado</option><option value="delivered">Entregue</option><option value="pickup">Retirada</option></select></label>
            </div>
            {form.deliveryMethod === 'delivery' && <div className="form-grid address-grid">
              <label className="field-span-two">Endereço de entrega <b>*</b><input required maxLength={180} value={form.address} onChange={(event) => change('address', event.target.value)} placeholder="Rua, número e complemento" /></label>
              <label>Cidade<input maxLength={80} value={form.city} onChange={(event) => change('city', event.target.value)} /></label>
              <label>Estado<input maxLength={2} value={form.state} onChange={(event) => change('state', event.target.value)} placeholder="UF" /></label>
              <label>CEP<input inputMode="numeric" maxLength={10} value={form.postalCode} onChange={(event) => change('postalCode', event.target.value)} placeholder="00000-000" /></label>
            </div>}
          </section>

          <section className="form-section form-section-last">
            <div className="form-section-title"><span>04</span><div><h3>Observações</h3><p>Detalhes internos que ajudem no acompanhamento.</p></div></div>
            <label className="notes-field"><span>Observações <span className="optional-label">opcional</span></span><textarea rows="3" maxLength={1000} value={form.notes} onChange={(event) => change('notes', event.target.value)} placeholder="Cor, personalização, combinado de retirada…" /></label>
          </section>

          {formError && <div className="alert alert-error sale-form-error" role="alert">{formError}</div>}
          <footer className="sale-form-footer"><span><b>*</b> Campo obrigatório <span className="estimate-note">Líquido estimado após taxas: {money(total - fees)}</span></span><div><button className="button button-secondary" type="button" onClick={onClose}>Cancelar</button><button className="button button-primary" disabled={saving}>{saving ? 'Salvando…' : sale ? 'Salvar alterações' : 'Salvar venda'}</button></div></footer>
        </form>
      </section>
    </div>
  )
}

export default function ExternalSalesPage() {
  const { user, workspaceUid } = useAuth()
  const { sales, loading, error } = useExternalSales()
  const [formSale, setFormSale] = useState(null)
  const [formOpen, setFormOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [channel, setChannel] = useState('all')
  const [stateFilter, setStateFilter] = useState('active')
  const [toast, setToast] = useState('')
  const [cancelError, setCancelError] = useState('')

  const filteredSales = useMemo(() => sales.filter((sale) => {
    const needle = search.trim().toLocaleLowerCase('pt-BR')
    const matchesSearch = !needle || [sale.id, sale.client?.name, sale.client?.phone, ...(sale.items ?? []).map((item) => item.description)]
      .some((value) => String(value ?? '').toLocaleLowerCase('pt-BR').includes(needle))
    const matchesChannel = channel === 'all' || sale.channel === channel
    const matchesState = stateFilter === 'all' || (stateFilter === 'active' ? sale.status !== 'cancelled' : sale.status === 'cancelled')
    return matchesSearch && matchesChannel && matchesState
  }), [sales, search, channel, stateFilter])

  const activeSales = sales.filter((sale) => sale.status !== 'cancelled')
  const grossTotal = activeSales.reduce((sum, sale) => sum + (Number(sale.total) || 0), 0)
  const outstandingTotal = activeSales.reduce((sum, sale) => sum + (Number(sale.outstandingAmount) || 0), 0)

  function notify(message) {
    setToast(message)
    window.setTimeout(() => setToast(''), 3500)
    setFormOpen(false)
    setFormSale(null)
  }

  async function cancelSale(sale) {
    if (!window.confirm(`Cancelar a venda de ${sale.client?.name || 'cliente'}? O registro será preservado no histórico.`)) return
    setCancelError('')
    try {
      await cancelExternalSale(workspaceUid, sale.id)
      notify('Venda cancelada. O histórico foi preservado.')
    } catch (cause) {
      setCancelError(firestoreErrorMessage(cause))
    }
  }

  return (
    <div className="page-stack sales-page">
      <div className="page-intro sales-intro"><div><p className="eyebrow">COMERCIAL</p><h2>Vendas externas</h2><p>Registre vendas feitas por WhatsApp, Instagram, presencialmente e outros canais.</p></div><button className="button button-primary new-sale-button" onClick={() => { setFormSale(null); setFormOpen(true) }}>＋ Nova venda</button></div>

      <div className="sales-summary-grid">
        <article className="sales-summary-card"><span>Vendas ativas</span><strong>{activeSales.length}</strong><small>Registros não cancelados</small></article>
        <article className="sales-summary-card"><span>Valor vendido</span><strong>{money(grossTotal)}</strong><small>Soma das vendas ativas</small></article>
        <article className="sales-summary-card"><span>A receber</span><strong>{money(outstandingTotal)}</strong><small>Saldo pendente dos clientes</small></article>
      </div>

      <section className="panel sales-list-panel">
        <div className="sales-list-heading"><div><h3>Histórico de vendas</h3><p>Atualizado em tempo real a partir do Firestore.</p></div><span className="sales-count-chip">{filteredSales.length} {filteredSales.length === 1 ? 'registro' : 'registros'}</span></div>
        <div className="sales-filters">
          <label className="search-field"><span aria-hidden="true">⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar cliente, produto ou código" /></label>
          <select aria-label="Filtrar por canal" value={channel} onChange={(event) => setChannel(event.target.value)}><option value="all">Todos os canais</option>{Object.entries(channelLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
          <select aria-label="Filtrar por situação" value={stateFilter} onChange={(event) => setStateFilter(event.target.value)}><option value="active">Vendas ativas</option><option value="cancelled">Canceladas</option><option value="all">Todas</option></select>
        </div>

        {error && <div className="sales-error" role="alert"><strong>Falha ao carregar vendas</strong><span>{error}</span></div>}
        {cancelError && <div className="sales-error" role="alert"><strong>Não foi possível cancelar</strong><span>{cancelError}</span></div>}
        {loading ? <div className="sales-loading"><span className="spinner" />Carregando vendas…</div> : filteredSales.length === 0 ? (
          <div className="sales-empty"><span className="sales-empty-icon">↗</span><h3>{sales.length ? 'Nenhuma venda corresponde aos filtros' : 'Comece registrando uma venda'}</h3><p>{sales.length ? 'Ajuste a busca ou os filtros para ver os outros registros.' : 'As vendas ficarão salvas na sua conta e poderão ser consultadas por aqui.'}</p>{!sales.length && <button className="button button-secondary" onClick={() => setFormOpen(true)}>Registrar primeira venda</button>}</div>
        ) : (
          <div className="sales-table-scroll"><table className="sales-table"><thead><tr><th>Venda</th><th>Cliente</th><th>Canal</th><th>Data</th><th>Pagamento</th><th>Entrega</th><th>Total</th><th>Ações</th></tr></thead><tbody>
            {filteredSales.map((sale) => <tr key={sale.id} className={sale.status === 'cancelled' ? 'cancelled-row' : ''}>
              <td><strong className="sale-code">#{sale.id.slice(0, 7).toUpperCase()}</strong><small>{(sale.items ?? []).length} {(sale.items ?? []).length === 1 ? 'item' : 'itens'}</small></td>
              <td><strong className="table-primary-text">{sale.client?.name || 'Cliente'}</strong><small>{sale.client?.phone || sale.client?.email || 'Sem contato'}</small></td>
              <td>{channelLabels[sale.channel] || 'Outro'}</td><td>{dateLabel(sale.soldAt)}</td>
              <td><span className={`status-pill payment-${sale.paymentStatus || 'pending'}`}>{sale.status === 'cancelled' ? 'Cancelada' : paymentLabels[sale.paymentStatus] || 'Pendente'}</span></td>
              <td><span className={`status-pill delivery-${sale.deliveryStatus || 'pending'}`}>{deliveryLabels[sale.deliveryStatus] || 'A combinar'}</span></td>
              <td><strong className="table-primary-text">{money(sale.total)}</strong><small>{sale.outstandingAmount > 0 ? `${money(sale.outstandingAmount)} a receber` : 'Sem saldo pendente'}</small></td>
              <td><div className="sale-actions"><button aria-label={`Editar venda ${sale.id.slice(0, 7)}`} title="Editar venda" disabled={sale.status === 'cancelled'} onClick={() => { setFormSale(sale); setFormOpen(true) }}>Editar</button>{sale.status !== 'cancelled' && <button className="cancel-action" title="Cancelar venda" onClick={() => cancelSale(sale)}>Cancelar</button>}</div></td>
            </tr>)}
          </tbody></table></div>
        )}
        <footer className="sales-list-footer"><span>Os cancelamentos preservam o histórico; nenhum registro é apagado.</span><span>{sales.length} no total</span></footer>
      </section>
      <div className="info-banner"><span>i</span><p>Esses registros são vendas manuais. Pedidos e vendas do Mercado Livre serão integrados em uma etapa posterior.</p></div>
      {formOpen && <SaleForm sale={formSale} onClose={() => { setFormOpen(false); setFormSale(null) }} onSaved={notify} />}
      {toast && <div className="toast-success" role="status"><span>✓</span>{toast}</div>}
    </div>
  )
}
