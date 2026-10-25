import { useMemo, useState } from 'react'
import { useAuth } from '../contexts/AuthContext.jsx'
import useFinancialMaterials from '../hooks/useFinancialMaterials.js'
import useProducts from '../hooks/useProducts.js'
import { formatUnit } from '../services/finance/units.js'
import { adjustProductStock } from '../services/products/products.js'
import { updateMaterialStock } from '../services/finance/materials.js'

const money = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value) || 0)
const unitCostMoney = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 6 }).format(Number(value) || 0)
const matchesSearch = (value, search) => value.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR'))

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

function MaterialStockEditor({ material, onClose, onSaved }) {
  const { user, workspaceUid } = useAuth()
  const [quantity, setQuantity] = useState(String(material.stockQuantity ?? 0))
  const [minStock, setMinStock] = useState(String(material.minStock ?? 0))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function submit(event) {
    event.preventDefault()
    setError('')
    if (!Number.isFinite(Number(quantity)) || Number(quantity) < 0) return setError('O saldo precisa ser um número igual ou maior que zero.')
    if (!Number.isFinite(Number(minStock)) || Number(minStock) < 0) return setError('O estoque mínimo precisa ser um número igual ou maior que zero.')
    setSaving(true)
    try {
      await updateMaterialStock(workspaceUid, material.id, Number(quantity), Number(minStock), user.uid)
      onSaved('Saldo do material atualizado.')
    } catch (cause) {
      setError(cause.message || 'Não foi possível atualizar o saldo do material.')
    } finally {
      setSaving(false)
    }
  }

  return <div className="sale-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section className="sale-modal stock-modal" role="dialog" aria-modal="true" aria-labelledby="material-stock-title"><header className="sale-modal-header"><div><p className="eyebrow">AJUSTE DE ESTOQUE</p><h2 id="material-stock-title">{material.name}</h2><p>Informe a quantidade física atual. Unidade: {formatUnit(material.baseUnit)}.</p></div><button className="modal-close" onClick={onClose} aria-label="Fechar">×</button></header><form className="sale-form" onSubmit={submit}><div className="form-grid form-grid-two"><label>Saldo atual ({formatUnit(material.baseUnit)})<input autoFocus type="number" min="0" step="any" required value={quantity} onChange={(event) => setQuantity(event.target.value)} /></label><label>Estoque mínimo ({formatUnit(material.baseUnit)})<input type="number" min="0" step="any" required value={minStock} onChange={(event) => setMinStock(event.target.value)} /></label></div>{error && <div className="alert alert-error" role="alert">{error}</div>}<footer className="sale-form-footer"><span>O custo unitário médio será preservado.</span><div><button type="button" className="button button-secondary" onClick={onClose}>Cancelar</button><button className="button button-primary" disabled={saving}>{saving ? 'Salvando…' : 'Salvar saldo'}</button></div></footer></form></section></div>
}

export default function InventoryPage() {
  const { products, loading, error } = useProducts()
  const { materials, loading: materialsLoading, error: materialsError } = useFinancialMaterials()
  const [search, setSearch] = useState('')
  const [inventoryType, setInventoryType] = useState('all')
  const [adjusting, setAdjusting] = useState(null)
  const [editingMaterial, setEditingMaterial] = useState(null)
  const [toast, setToast] = useState('')
  const searchableProducts = useMemo(() => products.filter((product) => product.active !== false && product.type === 'fisico' && matchesSearch(`${product.name} ${product.sku || ''} ${product.category || ''}`, search)), [products, search])
  const searchableMaterials = useMemo(() => materials.filter((material) => matchesSearch(material.name, search)), [materials, search])
  const productList = inventoryType === 'material' || inventoryType === 'other' ? [] : searchableProducts
  const materialList = inventoryType === 'product' || inventoryType === 'other' ? [] : searchableMaterials
  const lowStock = searchableProducts.filter((product) => Number(product.quantity) <= Number(product.minStock)).length
    + searchableMaterials.filter((material) => Number(material.stockQuantity) <= Number(material.minStock)).length
  const inventoryItemCount = searchableProducts.length + searchableMaterials.length
  const loadingInventory = loading || materialsLoading
  function saved(message) { setAdjusting(null); setEditingMaterial(null); setToast(message); window.setTimeout(() => setToast(''), 3200) }

  return <div className="page-stack">
    <div className="page-intro"><div><p className="eyebrow">OPERAÇÃO</p><h2>Estoque</h2><p>Acompanhe produtos físicos, materiais e insumos em um só lugar. Produtos de venda online não aparecem aqui.</p></div></div>
    <div className="sales-summary-grid"><article className="sales-summary-card"><span>Produtos físicos</span><strong>{productList.length}</strong><small>Cadastros ativos</small></article><article className="sales-summary-card"><span>Materiais e insumos</span><strong>{materialList.length}</strong><small>Materiais ativos</small></article><article className="sales-summary-card"><span>Itens no estoque</span><strong>{inventoryItemCount}</strong><small>Produtos e materiais</small></article><article className="sales-summary-card"><span>Estoque baixo</span><strong>{lowStock}</strong><small>No limite mínimo ou abaixo</small></article></div>
    <div className="product-tabs inventory-type-tabs" role="tablist" aria-label="Filtrar itens do estoque">
      <button type="button" role="tab" aria-selected={inventoryType === 'all'} className={inventoryType === 'all' ? 'product-tab-active' : ''} onClick={() => setInventoryType('all')}><span>Todos</span><b>{inventoryItemCount}</b></button>
      <button type="button" role="tab" aria-selected={inventoryType === 'product'} className={inventoryType === 'product' ? 'product-tab-active' : ''} onClick={() => setInventoryType('product')}><span>Produtos</span><b>{searchableProducts.length}</b></button>
      <button type="button" role="tab" aria-selected={inventoryType === 'material'} className={inventoryType === 'material' ? 'product-tab-active' : ''} onClick={() => setInventoryType('material')}><span>Materiais</span><b>{searchableMaterials.length}</b></button>
      <button type="button" role="tab" aria-selected={inventoryType === 'other'} className={inventoryType === 'other' ? 'product-tab-active' : ''} onClick={() => setInventoryType('other')}><span>Outros</span><b>0</b></button>
    </div>
    <section className="panel products-panel"><div className="products-toolbar"><label className="search-field"><span aria-hidden="true">⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar produto, SKU ou material" /></label><span className="count-chip">{productList.length + materialList.length} itens</span></div>{(error || materialsError) && <div className="sales-error" role="alert">{error || materialsError}</div>}
      {loadingInventory ? <div className="sales-loading">Carregando estoque…</div> : <div className="sales-table-scroll"><table className="sales-table products-table"><thead><tr><th>Produto ou material</th><th>Tipo / SKU</th><th>Saldo atual</th><th>Estoque mínimo</th><th>Custo unitário</th><th>Valor em estoque</th><th>Ação</th></tr></thead><tbody>
        {productList.map((product) => { const low = Number(product.quantity) <= Number(product.minStock); return <tr key={`product-${product.id}`} className={low ? 'stock-low-row' : ''}><td><strong className="table-primary-text">{product.name}</strong><small>{product.category || 'Produto físico'}</small></td><td>{product.sku || 'Produto físico'}</td><td><strong>{Number(product.quantity) || 0}</strong>{low && <small className="stock-alert-text">Estoque baixo</small>}</td><td>{Number(product.minStock) || 0}</td><td>{money(product.cost)}</td><td>{money((Number(product.quantity) || 0) * (Number(product.cost) || 0))}</td><td><button className="button button-secondary stock-adjust-button" onClick={() => setAdjusting(product)}>Ajustar saldo</button></td></tr>})}
        {materialList.map((material) => { const low = Number(material.stockQuantity) <= Number(material.minStock); return <tr key={`material-${material.id}`} className={low ? 'stock-low-row' : ''}><td><strong className="table-primary-text">{material.name}</strong><small>Material / insumo</small></td><td>{formatUnit(material.baseUnit)}</td><td><strong>{Number(material.stockQuantity || 0).toLocaleString('pt-BR', { maximumFractionDigits: 3 })} {formatUnit(material.baseUnit)}</strong>{low && <small className="stock-alert-text">Estoque baixo</small>}</td><td>{Number(material.minStock || 0).toLocaleString('pt-BR', { maximumFractionDigits: 3 })} {formatUnit(material.baseUnit)}</td><td>{unitCostMoney(material.unitCost)} / {formatUnit(material.baseUnit)}</td><td>{money((Number(material.stockQuantity) || 0) * (Number(material.unitCost) || 0))}</td><td><button className="button button-secondary stock-adjust-button" onClick={() => setEditingMaterial(material)}>Editar estoque</button></td></tr>})}
        {inventoryType === 'other' ? <tr><td colSpan="7"><div className="table-empty"><strong>Outros itens ainda não estão disponíveis</strong><span>O estoque atualmente organiza produtos físicos e materiais/insumos.</span></div></td></tr> : productList.length + materialList.length === 0 && <tr><td colSpan="7"><div className="table-empty"><strong>Nenhum item encontrado no estoque</strong><span>Cadastre produtos físicos em Produtos e materiais/insumos no Financeiro.</span></div></td></tr>}
      </tbody></table></div>}
    </section>
    <div className="info-banner"><span>i</span><p>Ajuste os saldos dos produtos físicos nesta tela. Cadastre materiais e registre compras pelo Financeiro; seus saldos e custos médios aparecem aqui automaticamente. Produtos de venda online ficam fora do estoque.</p></div>
    {adjusting && <StockAdjustment product={adjusting} onClose={() => setAdjusting(null)} onSaved={saved} />}{editingMaterial && <MaterialStockEditor material={editingMaterial} onClose={() => setEditingMaterial(null)} onSaved={saved} />}{toast && <div className="toast-success" role="status">{toast}</div>}
  </div>
}
