import { useMemo, useState } from 'react'
import { useAuth } from '../contexts/AuthContext.jsx'
import useProducts from '../hooks/useProducts.js'
import { adjustProductStock } from '../services/products/products.js'

const money = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value) || 0)

function StockAdjustment({ product, onClose, onSaved }) {
  const { workspaceUid } = useAuth()
  const [direction, setDirection] = useState('in')
  const [quantity, setQuantity] = useState('1')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  async function submit(event) {
    event.preventDefault()
    if (!Number.isInteger(Number(quantity)) || Number(quantity) < 1) return setError('Informe uma quantidade inteira maior que zero.')
    if (!reason.trim()) return setError('Informe o motivo do ajuste.')
    setSaving(true)
    try { await adjustProductStock(workspaceUid, product.id, (direction === 'in' ? 1 : -1) * Number(quantity), reason); onSaved('Estoque atualizado e movimentação registrada.') }
    catch (cause) { setError(cause.message || 'Não foi possível ajustar o estoque.') }
    finally { setSaving(false) }
  }
  return <div className="sale-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section className="sale-modal stock-modal" role="dialog" aria-modal="true"><header className="sale-modal-header"><div><p className="eyebrow">AJUSTE DE SALDO</p><h2>{product.name}</h2><p>Saldo atual: <strong>{product.quantity || 0}</strong></p></div><button className="modal-close" onClick={onClose} aria-label="Fechar">×</button></header><form className="sale-form" onSubmit={submit}><div className="form-grid form-grid-two"><label>Tipo de movimentação<select value={direction} onChange={(event) => setDirection(event.target.value)}><option value="in">Entrada no estoque</option><option value="out">Saída do estoque</option></select></label><label>Quantidade<input autoFocus type="number" min="1" step="1" required value={quantity} onChange={(event) => setQuantity(event.target.value)} /></label><label className="field-span-two">Motivo<input required maxLength={160} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Ex.: compra de material, produção, perda" /></label></div>{error && <div className="alert alert-error" role="alert">{error}</div>}<footer className="sale-form-footer"><span>O saldo não pode ficar negativo.</span><div><button type="button" className="button button-secondary" onClick={onClose}>Cancelar</button><button className="button button-primary" disabled={saving}>{saving ? 'Salvando…' : 'Registrar ajuste'}</button></div></footer></form></section></div>
}

export default function InventoryPage() {
  const { products, loading, error } = useProducts()
  const [type, setType] = useState('mercadolivre')
  const [search, setSearch] = useState('')
  const [adjusting, setAdjusting] = useState(null)
  const [toast, setToast] = useState('')
  const active = products.filter((product) => product.active !== false)
  const list = useMemo(() => active.filter((product) => product.type === type && `${product.name} ${product.sku} ${product.category}`.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR'))), [active, type, search])
  const lowStock = list.filter((product) => Number(product.quantity) <= Number(product.minStock)).length
  const totalUnits = list.reduce((sum, product) => sum + (Number(product.quantity) || 0), 0)
  const typeCounts = { mercadolivre: active.filter((product) => product.type === 'mercadolivre').length, fisico: active.filter((product) => product.type === 'fisico').length }
  function saved(message) { setAdjusting(null); setToast(message); window.setTimeout(() => setToast(''), 3200) }

  return <div className="page-stack">
    <div className="page-intro"><div><p className="eyebrow">OPERAÇÃO</p><h2>Estoque</h2><p>Controle saldos e registre entradas e saídas separadas por canal de venda.</p></div></div>
    <div className="product-tabs" role="tablist" aria-label="Grupo de estoque"><button role="tab" aria-selected={type === 'mercadolivre'} className={type === 'mercadolivre' ? 'product-tab-active' : ''} onClick={() => setType('mercadolivre')}><span>Mercado Livre</span><b>{typeCounts.mercadolivre}</b></button><button role="tab" aria-selected={type === 'fisico'} className={type === 'fisico' ? 'product-tab-active' : ''} onClick={() => setType('fisico')}><span>Físicos</span><b>{typeCounts.fisico}</b></button></div>
    <div className="sales-summary-grid"><article className="sales-summary-card"><span>Produtos neste grupo</span><strong>{list.length}</strong><small>Cadastros ativos</small></article><article className="sales-summary-card"><span>Unidades disponíveis</span><strong>{totalUnits}</strong><small>Soma do saldo registrado</small></article><article className="sales-summary-card"><span>Estoque baixo</span><strong>{lowStock}</strong><small>No limite mínimo ou abaixo</small></article></div>
    <section className="panel products-panel"><div className="products-toolbar"><label className="search-field"><span aria-hidden="true">⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar produto ou SKU" /></label><span className="count-chip">{list.length} itens</span></div>{error && <div className="sales-error">{error}</div>}
      {loading ? <div className="sales-loading">Carregando estoque…</div> : <div className="sales-table-scroll"><table className="sales-table products-table"><thead><tr><th>Produto</th><th>SKU</th><th>Saldo atual</th><th>Estoque mínimo</th><th>Valor em estoque</th><th>Ação</th></tr></thead><tbody>{list.map((product) => { const low = Number(product.quantity) <= Number(product.minStock); return <tr key={product.id} className={low ? 'stock-low-row' : ''}><td><strong className="table-primary-text">{product.name}</strong><small>{product.category || (type === 'mercadolivre' ? 'Mercado Livre' : 'Produto físico')}</small></td><td>{product.sku || '—'}</td><td><strong>{Number(product.quantity) || 0}</strong>{low && <small className="stock-alert-text">Estoque baixo</small>}</td><td>{Number(product.minStock) || 0}</td><td>{money((Number(product.quantity) || 0) * (Number(product.cost) || 0))}</td><td><button className="button button-secondary stock-adjust-button" onClick={() => setAdjusting(product)}>Ajustar saldo</button></td></tr>})}{list.length === 0 && <tr><td colSpan="6"><div className="table-empty"><strong>Nenhum produto neste grupo</strong><span>Cadastre produtos pela área Produtos para controlar o saldo aqui.</span></div></td></tr>}</tbody></table></div>}
    </section>
    <div className="info-banner"><span>i</span><p>As movimentações são registradas com quantidade anterior, alteração, saldo final e motivo. A separação por canal é manual e não sincroniza estoque com o Mercado Livre.</p></div>
    {adjusting && <StockAdjustment product={adjusting} onClose={() => setAdjusting(null)} onSaved={saved} />}{toast && <div className="toast-success" role="status">{toast}</div>}
  </div>
}

