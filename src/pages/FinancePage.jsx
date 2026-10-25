import { useMemo, useState } from 'react'
import { useAuth } from '../contexts/AuthContext.jsx'
import useExternalSales from '../hooks/useExternalSales.js'
import useFinancialTransactions from '../hooks/useFinancialTransactions.js'
import { createFinancialTransaction, updateFinancialTransaction, voidFinancialTransaction } from '../services/finance/transactions.js'

const categories = {
  income: [
    ['other', 'Outra receita'],
    ['service', 'Serviço'],
    ['refund', 'Reembolso recebido'],
    ['investment', 'Aporte no negócio'],
  ],
  expense: [
    ['materials', 'Materiais e insumos'],
    ['packaging', 'Embalagens'],
    ['shipping', 'Frete e entrega'],
    ['marketing', 'Marketing'],
    ['tools', 'Ferramentas e serviços'],
    ['taxes', 'Impostos e taxas'],
    ['other', 'Outra despesa'],
  ],
}
const categoryLabels = Object.fromEntries(Object.values(categories).flat())
const paymentLabels = { pix: 'Pix', cash: 'Dinheiro', transfer: 'Transferência', debit: 'Cartão de débito', credit: 'Cartão de crédito', other: 'Outro' }

function localDate() {
  const today = new Date()
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
}

function localMonth() { return localDate().slice(0, 7) }
function amount(value) { return Number.parseFloat(String(value ?? '0').replace(',', '.')) || 0 }
function money(value) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value) || 0) }
function dateLabel(value) {
  if (!value) return '—'
  const [year, month, day] = value.split('-').map(Number)
  return new Intl.DateTimeFormat('pt-BR').format(new Date(year, month - 1, day))
}
function monthLabel(value) {
  if (!value) return ''
  const [year, month] = value.split('-').map(Number)
  return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(new Date(year, month - 1, 1))
}
function emptyForm() {
  return { type: 'expense', date: localDate(), description: '', category: 'materials', amount: '', paymentMethod: 'pix', notes: '' }
}
function errorMessage(cause) {
  if (cause.code === 'permission-denied') return 'O Firestore bloqueou o lançamento. Confira se as regras permitem gravar em users/{uid}/financialTransactions.'
  if (cause.code === 'unavailable' || cause.code === 'network-request-failed') return 'Sem conexão com o Firestore. Verifique sua internet e tente novamente.'
  return 'Não foi possível salvar o lançamento. Confira os dados e tente novamente.'
}

function SummaryCard({ title, value, detail, tone }) {
  return <article className="finance-summary-card"><div><span>{title}</span><span className={`finance-summary-icon finance-tone-${tone}`} aria-hidden="true">{tone === 'income' ? '↗' : tone === 'expense' ? '↘' : tone === 'balance' ? '＝' : '＋'}</span></div><strong>{value}</strong><small>{detail}</small></article>
}

export default function FinancePage() {
  const { user, workspaceUid } = useAuth()
  const { sales, loading: salesLoading, error: salesError } = useExternalSales()
  const { transactions, loading: transactionsLoading, error: transactionsError } = useFinancialTransactions()
  const [month, setMonth] = useState(localMonth)
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState('')
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const report = useMemo(() => {
    const monthSales = sales.filter((sale) => sale.status !== 'cancelled' && sale.soldAt?.startsWith(month))
    const monthTransactions = transactions.filter((entry) => entry.date?.startsWith(month))
    const activeTransactions = monthTransactions.filter((entry) => entry.status !== 'cancelled')
    const salesReceived = monthSales.reduce((total, sale) => total + amount(sale.receivedAmount), 0)
    const saleFees = monthSales.reduce((total, sale) => total + amount(sale.fees), 0)
    const otherIncome = activeTransactions.filter((entry) => entry.type === 'income').reduce((total, entry) => total + amount(entry.amount), 0)
    const manualExpenses = activeTransactions.filter((entry) => entry.type === 'expense').reduce((total, entry) => total + amount(entry.amount), 0)
    const expenses = saleFees + manualExpenses
    return { monthTransactions, salesReceived, saleFees, otherIncome, manualExpenses, expenses, balance: salesReceived + otherIncome - expenses }
  }, [month, sales, transactions])

  function resetForm() {
    setForm(emptyForm())
    setEditingId('')
  }

  function startEdit(entry) {
    setEditingId(entry.id)
    setForm({ type: entry.type, date: entry.date, description: entry.description, category: entry.category, amount: String(entry.amount), paymentMethod: entry.paymentMethod || 'other', notes: entry.notes || '' })
    setMessage('')
    setError('')
  }

  async function submit(event) {
    event.preventDefault()
    setMessage('')
    setError('')
    if (!form.date) return setError('Informe a data do lançamento.')
    if (!form.description.trim()) return setError('Descreva o lançamento.')
    if (amount(form.amount) <= 0) return setError('Informe um valor maior que zero.')

    const entry = {
      type: form.type,
      date: form.date,
      description: form.description.trim(),
      category: form.category,
      amount: Number(amount(form.amount).toFixed(2)),
      paymentMethod: form.paymentMethod,
      notes: form.notes.trim(),
    }
    setSaving(true)
    try {
      if (editingId) await updateFinancialTransaction(workspaceUid, editingId, entry)
      else await createFinancialTransaction(workspaceUid, entry, user.uid)
      setMessage(editingId ? 'Lançamento atualizado.' : 'Lançamento salvo no Firestore.')
      resetForm()
    } catch (cause) {
      setError(errorMessage(cause))
    } finally {
      setSaving(false)
    }
  }

  async function voidEntry(entry) {
    if (!window.confirm(`Estornar o lançamento “${entry.description}”? Ele continuará visível no histórico, mas deixará de entrar nos totais.`)) return
    setBusyId(entry.id)
    setMessage('')
    setError('')
    try {
      await voidFinancialTransaction(workspaceUid, entry.id)
      if (editingId === entry.id) resetForm()
      setMessage('Lançamento estornado e mantido no histórico.')
    } catch (cause) {
      setError(errorMessage(cause))
    } finally {
      setBusyId('')
    }
  }

  const loading = salesLoading || transactionsLoading
  const loadError = salesError || transactionsError

  return <div className="page-stack finance-page">
    <div className="page-intro finance-intro"><div><p className="eyebrow">CONTROLE FINANCEIRO</p><h2>Financeiro</h2><p>Veja o que entrou, o que saiu e o resultado do período.</p></div><label className="finance-month-picker">Período<input type="month" value={month} onChange={(event) => setMonth(event.target.value)} /></label></div>

    {loadError && <div className="sales-error" role="alert">{loadError}</div>}
    {(message || error) && <div className={`alert ${error ? 'alert-error' : 'alert-success'}`} role={error ? 'alert' : 'status'}>{error || message}</div>}

    <section className="finance-summary-grid" aria-label={`Resumo de ${monthLabel(month)}`}>
      <SummaryCard title="Recebido das vendas" value={loading ? '…' : loadError ? '—' : money(report.salesReceived)} detail="Pagamentos recebidos em vendas ativas" tone="income" />
      <SummaryCard title="Outras receitas" value={loading ? '…' : loadError ? '—' : money(report.otherIncome)} detail="Entradas manuais fora das vendas" tone="other" />
      <SummaryCard title="Despesas e taxas" value={loading ? '…' : loadError ? '—' : money(report.expenses)} detail={`${money(report.manualExpenses)} despesas · ${money(report.saleFees)} taxas das vendas`} tone="expense" />
      <SummaryCard title="Resultado do mês" value={loading ? '…' : loadError ? '—' : money(report.balance)} detail="Entradas menos despesas e taxas" tone="balance" />
    </section>

    <section className="panel finance-entry-panel">
      <header className="finance-section-heading"><div><p className="eyebrow">LANÇAMENTOS</p><h3>{editingId ? 'Editar lançamento' : 'Adicionar receita ou despesa'}</h3><p>As vendas e suas taxas são calculadas automaticamente. Registre aqui outros valores.</p></div></header>
      <form className="finance-form" onSubmit={submit}>
        <label>Tipo<select value={form.type} onChange={(event) => { const type = event.target.value; setForm((current) => ({ ...current, type, category: type === 'income' ? 'other' : 'materials' })) }}><option value="expense">Despesa</option><option value="income">Outra receita</option></select></label>
        <label>Data<input type="date" required value={form.date} onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))} /></label>
        <label className="finance-description-field">Descrição<input required maxLength={140} value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder={form.type === 'income' ? 'Ex.: serviço de personalização' : 'Ex.: compra de filamento'} /></label>
        <label>Categoria<select value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}>{categories[form.type].map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>Valor (R$)<input type="number" min="0.01" step="0.01" required value={form.amount} onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))} placeholder="0,00" /></label>
        <label>Forma de pagamento<select value={form.paymentMethod} onChange={(event) => setForm((current) => ({ ...current, paymentMethod: event.target.value }))}>{Object.entries(paymentLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="finance-notes-field">Observação <span className="optional-label">opcional</span><input maxLength={240} value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Detalhes para seu controle" /></label>
        <div className="finance-form-actions">{editingId && <button className="button button-secondary" type="button" onClick={resetForm}>Cancelar edição</button>}<button className="button button-primary" disabled={saving}>{saving ? 'Salvando…' : editingId ? 'Salvar alterações' : 'Salvar lançamento'}</button></div>
      </form>
    </section>

    <section className="panel finance-ledger-panel">
      <header className="finance-section-heading finance-ledger-heading"><div><p className="eyebrow">HISTÓRICO</p><h3>Lançamentos de {monthLabel(month)}</h3><p>Vendas aparecem no resumo; esta lista mostra receitas adicionais e despesas manuais.</p></div><span className="count-chip">{report.monthTransactions.length} registros</span></header>
      {transactionsLoading ? <div className="sales-loading">Carregando lançamentos…</div> : report.monthTransactions.length === 0 ? <div className="finance-empty"><span aria-hidden="true">＋</span><strong>Nenhum lançamento manual neste mês</strong><small>Use o formulário acima para registrar despesas ou outras receitas.</small></div> : <div className="finance-table-scroll"><table className="finance-table"><thead><tr><th>Data</th><th>Lançamento</th><th>Categoria</th><th>Pagamento</th><th>Status</th><th className="finance-amount-column">Valor</th><th>Ações</th></tr></thead><tbody>{report.monthTransactions.map((entry) => {
        const cancelled = entry.status === 'cancelled'
        return <tr className={cancelled ? 'finance-voided-row' : ''} key={entry.id}>
          <td>{dateLabel(entry.date)}</td>
          <td><strong>{entry.description}</strong>{entry.notes && <small>{entry.notes}</small>}</td>
          <td>{categoryLabels[entry.category] || 'Outro'}</td>
          <td>{paymentLabels[entry.paymentMethod] || 'Outro'}</td>
          <td><span className={`finance-kind finance-kind-${entry.type}`}>{cancelled ? 'Estornado' : entry.type === 'income' ? 'Receita' : 'Despesa'}</span></td>
          <td className={`finance-amount finance-amount-${entry.type}`}>{entry.type === 'income' ? '+' : '−'} {money(entry.amount)}</td>
          <td><div className="finance-row-actions"><button type="button" disabled={cancelled || busyId === entry.id || saving} onClick={() => startEdit(entry)}>Editar</button><button type="button" className="finance-void-action" disabled={cancelled || busyId === entry.id || saving} onClick={() => voidEntry(entry)}>{busyId === entry.id ? 'Estornando…' : 'Estornar'}</button></div></td>
        </tr>
      })}</tbody></table></div>}
    </section>
    <p className="finance-footnote">Valores recebidos e taxas são calculados a partir das vendas ativas pela data da venda. Não registre essas mesmas vendas como receitas manuais.</p>
  </div>
}
