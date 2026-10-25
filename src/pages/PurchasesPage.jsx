import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext.jsx'
import useProducts from '../hooks/useProducts.js'
import usePurchases from '../hooks/usePurchases.js'
import { addPurchaseToExpenses, createPurchase } from '../services/inventory/purchases.js'

const today = () => { const date = new Date(); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` }
const money = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value) || 0)
const dateLabel = (value) => { if (!value) return '—'; const [year, month, day] = value.split('-').map(Number); return new Intl.DateTimeFormat('pt-BR').format(new Date(year, month - 1, day)) }

export default function PurchasesPage() {
  const { workspaceUid, user } = useAuth()
  const { products } = useProducts()
  const { purchases, loading, error: loadError } = usePurchases()
  const [form, setForm] = useState({ productId: '', date: today(), quantity: '1', unitCost: '', supplier: '', paymentMethod: 'pix', notes: '' })
  const [busy, setBusy] = useState(false)
  const [busyId, setBusyId] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const activeProducts = products.filter((product) => product.active !== false)
  async function submit(event) {
    event.preventDefault(); setError(''); setMessage('')
    const quantity = Number(form.quantity); const unitCost = Number(String(form.unitCost).replace(',', '.'))
    if (!form.productId || !form.date || !Number.isInteger(quantity) || quantity < 1 || !Number.isFinite(unitCost) || unitCost <= 0) return setError('Informe produto, data, quantidade e custo unitário válido.')
    setBusy(true)
    try {
      await createPurchase(workspaceUid, { productId: form.productId, date: form.date, quantity, unitCost: Number(unitCost.toFixed(2)), total: Number((quantity * unitCost).toFixed(2)), supplier: form.supplier.trim(), paymentMethod: form.paymentMethod, notes: form.notes.trim() })
      setForm((current) => ({ ...current, quantity: '1', unitCost: '', supplier: '', notes: '' }))
      setMessage('Compra registrada e estoque atualizado.')
    } catch (cause) { setError(cause.message || 'Não foi possível registrar a compra.') }
    finally { setBusy(false) }
  }
  async function addExpense(purchase) {
    setBusyId(purchase.id); setError(''); setMessage('')
    try { await addPurchaseToExpenses(workspaceUid, purchase.id, user.uid); setMessage('Compra adicionada às despesas do Financeiro.') }
    catch (cause) { setError(cause.message || 'Não foi possível adicionar a compra às despesas.') }
    finally { setBusyId('') }
  }
  return <div className="page-stack finance-page">
    <div className="page-intro"><div><p className="eyebrow">ESTOQUE E FINANCEIRO</p><h2>Compras</h2><p>Registre compras de produtos, atualize o estoque e envie os valores para as despesas.</p></div></div>
    {(loadError || error) && <div className="sales-error" role="alert">{error || loadError}</div>}{message && <div className="alert alert-success" role="status">{message}</div>}
    <section className="panel finance-entry-panel"><header className="finance-section-heading"><div><p className="eyebrow">NOVA COMPRA</p><h3>Registrar compra</h3><p>O saldo do produto aumenta junto com o registro da compra.</p></div></header>
      <form className="finance-form" onSubmit={submit}>
        <label className="finance-description-field">Produto<select required value={form.productId} onChange={(event) => setForm({ ...form, productId: event.target.value })}><option value="">Selecione um produto</option>{activeProducts.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select></label>
        <label>Data<input type="date" required value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} /></label>
        <label>Quantidade<input type="number" min="1" step="1" required value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} /></label>
        <label>Custo unitário (R$)<input type="number" min="0.01" step="0.01" required value={form.unitCost} onChange={(event) => setForm({ ...form, unitCost: event.target.value })} /></label>
        <label>Fornecedor <span className="optional-label">opcional</span><input maxLength="100" value={form.supplier} onChange={(event) => setForm({ ...form, supplier: event.target.value })} /></label>
        <label>Pagamento<select value={form.paymentMethod} onChange={(event) => setForm({ ...form, paymentMethod: event.target.value })}><option value="pix">Pix</option><option value="cash">Dinheiro</option><option value="transfer">Transferência</option><option value="debit">Cartão de débito</option><option value="credit">Cartão de crédito</option><option value="other">Outro</option></select></label>
        <label className="finance-notes-field">Observação <span className="optional-label">opcional</span><input maxLength="240" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label>
        <div className="finance-form-actions"><button className="button button-primary" disabled={busy || activeProducts.length === 0}>{busy ? 'Salvando…' : 'Registrar compra'}</button></div>
      </form>{activeProducts.length === 0 && <p className="finance-footnote">Cadastre produtos ativos antes de registrar uma compra.</p>}
    </section>
    <section className="panel finance-ledger-panel"><header className="finance-section-heading finance-ledger-heading"><div><p className="eyebrow">HISTÓRICO</p><h3>Minhas compras</h3><p>Adicione uma compra às despesas uma única vez; ela aparecerá no Financeiro.</p></div><span className="count-chip">{purchases.length} registros</span></header>
      {loading ? <div className="sales-loading">Carregando compras…</div> : purchases.length === 0 ? <div className="finance-empty"><strong>Nenhuma compra registrada</strong><small>Use o formulário acima para começar.</small></div> : <div className="finance-table-scroll"><table className="finance-table"><thead><tr><th>Data</th><th>Produto / fornecedor</th><th>Quantidade</th><th>Custo unitário</th><th>Total</th><th>Despesa</th></tr></thead><tbody>{purchases.map((purchase) => <tr key={purchase.id}><td>{dateLabel(purchase.date)}</td><td><strong>{purchase.productName}</strong><small>{purchase.supplier || purchase.notes || '—'}</small></td><td>{purchase.quantity}</td><td>{money(purchase.unitCost)}</td><td><strong>{money(purchase.total)}</strong></td><td>{purchase.expenseId ? <span className="finance-kind finance-kind-expense">Adicionada</span> : <button className="button button-secondary stock-adjust-button" disabled={busyId === purchase.id} onClick={() => addExpense(purchase)}>{busyId === purchase.id ? 'Adicionando…' : 'Colocar em despesas'}</button>}</td></tr>)}</tbody></table></div>}
    </section>
  </div>
}
