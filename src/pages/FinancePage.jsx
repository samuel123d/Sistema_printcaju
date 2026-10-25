import { useMemo, useState } from 'react'
import { useAuth } from '../contexts/AuthContext.jsx'
import useExternalSales from '../hooks/useExternalSales.js'
import useFinancialMaterials from '../hooks/useFinancialMaterials.js'
import useFinancialTransactions from '../hooks/useFinancialTransactions.js'
import { createMaterialPurchase } from '../services/finance/materials.js'
import { formatUnit, normalizeQuantity, purchaseUnits } from '../services/finance/units.js'
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
function unitCostMoney(value) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 6 }).format(Number(value) || 0) }
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
function emptyMaterialForm() {
  return { materialId: '', name: '', date: localDate(), packageQuantity: '1', packageUnit: 'kg', packageCost: '', minStock: '0', paymentMethod: 'pix' }
}
function errorMessage(cause) {
  if (cause.code === 'permission-denied') return 'O Firestore bloqueou o lançamento. Confira se as regras permitem gravar em users/{uid}/financialTransactions.'
  if (cause.code === 'unavailable' || cause.code === 'network-request-failed') return 'Sem conexão com o Firestore. Verifique sua internet e tente novamente.'
  return cause.message || 'Não foi possível salvar o lançamento. Confira os dados e tente novamente.'
}

function SummaryCard({ title, value, detail, tone }) {
  return <article className="finance-summary-card"><div><span>{title}</span><span className={`finance-summary-icon finance-tone-${tone}`} aria-hidden="true">{tone === 'income' ? '↗' : tone === 'expense' ? '↘' : tone === 'balance' ? '＝' : '＋'}</span></div><strong>{value}</strong><small>{detail}</small></article>
}

export default function FinancePage() {
  const { user, workspaceUid } = useAuth()
  const { sales, loading: salesLoading, error: salesError } = useExternalSales()
  const { transactions, loading: transactionsLoading, error: transactionsError } = useFinancialTransactions()
  const { materials, loading: materialsLoading, error: materialsError } = useFinancialMaterials()
  const [month, setMonth] = useState(localMonth)
  const [form, setForm] = useState(emptyForm)
  const [materialForm, setMaterialForm] = useState(emptyMaterialForm)
  const [editingId, setEditingId] = useState('')
  const [saving, setSaving] = useState(false)
  const [savingMaterial, setSavingMaterial] = useState(false)
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

  async function submitMaterialPurchase(event) {
    event.preventDefault()
    setMessage('')
    setError('')
    const selectedMaterial = materials.find((item) => item.id === materialForm.materialId)
    if (materialForm.materialId && !selectedMaterial) return setError('O material selecionado não está mais disponível.')
    if (!selectedMaterial && !materialForm.name.trim()) return setError('Informe o nome do material.')
    if (!selectedMaterial && materials.some((item) => item.name.trim().toLocaleLowerCase('pt-BR') === materialForm.name.trim().toLocaleLowerCase('pt-BR'))) return setError('Este material já existe. Selecione-o para registrar uma nova compra.')
    if (!materialForm.date) return setError('Informe a data da compra do material.')
    if (!Number.isFinite(Number(materialForm.packageQuantity)) || amount(materialForm.packageQuantity) <= 0) return setError('A quantidade comprada precisa ser um número maior que zero.')
    if (!Number.isFinite(amount(materialForm.packageCost)) || amount(materialForm.packageCost) <= 0) return setError('Informe um valor total da compra maior que zero.')
    if (!selectedMaterial && (!Number.isFinite(Number(materialForm.minStock)) || Number(materialForm.minStock) < 0)) return setError('O estoque mínimo precisa ser um número igual ou maior que zero.')
    const { baseUnit } = normalizeQuantity(materialForm.packageQuantity, materialForm.packageUnit)
    const purchase = {
      ...materialForm,
      name: materialForm.name.trim(),
      packageQuantity: Number(materialForm.packageQuantity),
      packageCost: Number(amount(materialForm.packageCost).toFixed(2)),
      minStock: Number(materialForm.minStock) || 0,
      baseUnit,
    }
    setSavingMaterial(true)
    try {
      await createMaterialPurchase(workspaceUid, purchase, user.uid, selectedMaterial?.id || '')
      setMaterialForm(emptyMaterialForm())
      setMessage('Material cadastrado, estoque atualizado e compra lançada como despesa.')
    } catch (cause) {
      setError(errorMessage(cause))
    } finally {
      setSavingMaterial(false)
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
  const selectedMaterial = materials.find((item) => item.id === materialForm.materialId)
  const selectedPurchaseUnit = purchaseUnits.find((unit) => unit.value === materialForm.packageUnit)
  const purchaseBaseUnit = selectedMaterial?.baseUnit || selectedPurchaseUnit?.baseUnit
  const purchasedBaseQuantity = amount(materialForm.packageQuantity) * (selectedPurchaseUnit?.factor || 1)
  const purchaseUnitCost = purchasedBaseQuantity > 0 ? amount(materialForm.packageCost) / purchasedBaseQuantity : 0

  return <div className="page-stack finance-page">
    <div className="page-intro finance-intro"><div><p className="eyebrow">CONTROLE FINANCEIRO</p><h2>Financeiro</h2><p>Veja o que entrou, o que saiu e o resultado do período.</p></div><label className="finance-month-picker">Período<input type="month" value={month} onChange={(event) => setMonth(event.target.value)} /></label></div>

    {(loadError || materialsError) && <div className="sales-error" role="alert">{loadError || materialsError}</div>}
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

    <section className="panel finance-entry-panel materials-finance-panel">
      <header className="finance-section-heading"><div><p className="eyebrow">MATERIAIS E INSUMOS</p><h3>Estoque de materiais</h3><p>Registre a compra, a unidade e o custo. Cada compra também entra automaticamente como despesa no Financeiro.</p></div></header>
      <form className="finance-form material-purchase-form" onSubmit={submitMaterialPurchase}>
        <label>Material<select value={materialForm.materialId} onChange={(event) => {
          const materialId = event.target.value
          const selected = materials.find((item) => item.id === materialId)
          const packageUnit = selected ? purchaseUnits.find((unit) => unit.baseUnit === selected.baseUnit)?.value || 'unidade' : 'kg'
          setMaterialForm((current) => ({ ...current, materialId, packageUnit }))
        }}><option value="">Cadastrar material novo</option>{materials.map((material) => <option key={material.id} value={material.id}>{material.name}</option>)}</select></label>
        {materialForm.materialId ? <div className="material-selected-summary"><strong>{materials.find((item) => item.id === materialForm.materialId)?.name}</strong><small>Estoque: {Number(materials.find((item) => item.id === materialForm.materialId)?.stockQuantity || 0).toLocaleString('pt-BR', { maximumFractionDigits: 3 })} {formatUnit(materials.find((item) => item.id === materialForm.materialId)?.baseUnit)}</small></div> : <label className="finance-description-field">Nome do material<input required maxLength={120} value={materialForm.name} onChange={(event) => setMaterialForm((current) => ({ ...current, name: event.target.value }))} placeholder="Ex.: Filamento PLA" /></label>}
        <label>Data da compra<input type="date" required value={materialForm.date} onChange={(event) => setMaterialForm((current) => ({ ...current, date: event.target.value }))} /></label>
        <label>Quantidade comprada<input type="number" min="0.001" step="any" required value={materialForm.packageQuantity} onChange={(event) => setMaterialForm((current) => ({ ...current, packageQuantity: event.target.value }))} /></label>
        <label>Unidade<select value={materialForm.packageUnit} onChange={(event) => setMaterialForm((current) => ({ ...current, packageUnit: event.target.value }))}>{purchaseUnits.filter((unit) => !materialForm.materialId || unit.baseUnit === materials.find((item) => item.id === materialForm.materialId)?.baseUnit).map((unit) => <option key={unit.value} value={unit.value}>{unit.label}</option>)}</select></label>
        <label>Valor total da compra (R$)<input type="number" min="0.01" step="0.01" required value={materialForm.packageCost} onChange={(event) => setMaterialForm((current) => ({ ...current, packageCost: event.target.value }))} placeholder="0,00" />{purchaseUnitCost > 0 && <small>Custo desta compra: {unitCostMoney(purchaseUnitCost)} / {formatUnit(purchaseBaseUnit)}</small>}</label>
        {!materialForm.materialId && <label>Estoque mínimo ({formatUnit(purchaseBaseUnit)})<input type="number" min="0" step="any" value={materialForm.minStock} onChange={(event) => setMaterialForm((current) => ({ ...current, minStock: event.target.value }))} /></label>}
        <label>Forma de pagamento<select value={materialForm.paymentMethod} onChange={(event) => setMaterialForm((current) => ({ ...current, paymentMethod: event.target.value }))}>{Object.entries(paymentLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <div className="finance-form-actions"><button className="button button-primary" disabled={savingMaterial}>{savingMaterial ? 'Salvando…' : 'Registrar compra e material'}</button></div>
      </form>
      {materialsLoading ? <div className="sales-loading">Carregando materiais…</div> : materials.length === 0 ? <div className="finance-empty"><strong>Nenhum material cadastrado</strong><small>Registre filamento, papel, plástico-bolha, embalagens ou outros insumos acima.</small></div> : <div className="finance-table-scroll"><table className="finance-table materials-table"><thead><tr><th>Material</th><th>Estoque atual</th><th>Estoque mínimo</th><th>Custo médio por unidade</th><th>Valor em estoque</th></tr></thead><tbody>{materials.map((material) => {
        const lowStock = Number(material.stockQuantity) <= Number(material.minStock)
        return <tr className={lowStock ? 'material-low-row' : ''} key={material.id}><td><strong>{material.name}</strong>{lowStock && <small className="material-low-label">Estoque baixo</small>}</td><td>{Number(material.stockQuantity).toLocaleString('pt-BR', { maximumFractionDigits: 3 })} {formatUnit(material.baseUnit)}</td><td>{Number(material.minStock || 0).toLocaleString('pt-BR', { maximumFractionDigits: 3 })} {formatUnit(material.baseUnit)}</td><td>{unitCostMoney(material.unitCost)} / {formatUnit(material.baseUnit)}</td><td>{money(Number(material.stockQuantity) * Number(material.unitCost))}</td></tr>
      })}</tbody></table></div>}
    </section>

    <section className="panel finance-ledger-panel">
      <header className="finance-section-heading finance-ledger-heading"><div><p className="eyebrow">HISTÓRICO</p><h3>Lançamentos de {monthLabel(month)}</h3><p>Vendas aparecem no resumo; esta lista mostra receitas adicionais e despesas manuais.</p></div><span className="count-chip">{report.monthTransactions.length} registros</span></header>
      {transactionsLoading ? <div className="sales-loading">Carregando lançamentos…</div> : report.monthTransactions.length === 0 ? <div className="finance-empty"><span aria-hidden="true">＋</span><strong>Nenhum lançamento manual neste mês</strong><small>Use o formulário acima para registrar despesas ou outras receitas.</small></div> : <div className="finance-table-scroll"><table className="finance-table"><thead><tr><th>Data</th><th>Lançamento</th><th>Categoria</th><th>Pagamento</th><th>Status</th><th className="finance-amount-column">Valor</th><th>Ações</th></tr></thead><tbody>{report.monthTransactions.map((entry) => {
        const cancelled = entry.status === 'cancelled'
        const materialPurchase = Boolean(entry.sourceMaterialPurchaseId)
        return <tr className={cancelled ? 'finance-voided-row' : ''} key={entry.id}>
          <td>{dateLabel(entry.date)}</td>
          <td><strong>{entry.description}</strong>{entry.notes && <small>{entry.notes}</small>}</td>
          <td>{categoryLabels[entry.category] || 'Outro'}</td>
          <td>{paymentLabels[entry.paymentMethod] || 'Outro'}</td>
          <td><span className={`finance-kind finance-kind-${entry.type}`}>{cancelled ? 'Estornado' : entry.type === 'income' ? 'Receita' : 'Despesa'}</span></td>
          <td className={`finance-amount finance-amount-${entry.type}`}>{entry.type === 'income' ? '+' : '−'} {money(entry.amount)}</td>
          <td><div className="finance-row-actions"><button type="button" title={materialPurchase ? 'A compra está vinculada ao estoque de materiais.' : undefined} disabled={materialPurchase || cancelled || busyId === entry.id || saving} onClick={() => startEdit(entry)}>Editar</button><button type="button" className="finance-void-action" title={materialPurchase ? 'Ajuste as compras pelo estoque de materiais para manter os saldos corretos.' : undefined} disabled={materialPurchase || cancelled || busyId === entry.id || saving} onClick={() => voidEntry(entry)}>{busyId === entry.id ? 'Estornando…' : 'Estornar'}</button></div></td>
        </tr>
      })}</tbody></table></div>}
    </section>
    <p className="finance-footnote">Valores recebidos e taxas são calculados a partir das vendas ativas pela data da venda. Não registre essas mesmas vendas como receitas manuais.</p>
  </div>
}
