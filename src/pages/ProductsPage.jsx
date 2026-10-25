import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../contexts/AuthContext.jsx'
import useProducts from '../hooks/useProducts.js'
import { archiveProduct, createProduct, updateProduct } from '../services/products/products.js'
import { getMercadoLivreConnection, startMercadoLivreConnection, syncMercadoLivreProducts } from '../services/mercadolivre.js'

const blankProduct = (type) => ({ name: '', sku: '', type, category: '', description: '', cost: '', price: '', quantity: '0', minStock: '0' })
const money = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value) || 0)
const typeName = (type) => type === 'mercadolivre' ? 'Mercado Livre' : 'Físico'

function ProductForm({ product, type, onClose, onSaved }) {
  const { workspaceUid } = useAuth()
  const [form, setForm] = useState(() => product ? { ...blankProduct(product.type), ...product, cost: String(product.cost ?? ''), price: String(product.price ?? ''), quantity: String(product.quantity ?? 0), minStock: String(product.minStock ?? 0) } : blankProduct(type))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }))

  async function submit(event) {
    event.preventDefault()
    setError('')
    if (!form.name.trim()) return setError('Informe o nome do produto.')
    if (Number(form.quantity) < 0 || Number(form.minStock) < 0 || Number(form.cost) < 0 || Number(form.price) < 0) return setError('Estoque e valores não podem ser negativos.')
    const data = { name: form.name.trim(), sku: form.sku.trim(), type, category: form.category.trim(), description: form.description.trim(), cost: Number(form.cost) || 0, price: Number(form.price) || 0, quantity: Number(form.quantity) || 0, minStock: Number(form.minStock) || 0 }
    setSaving(true)
    try {
      if (product) await updateProduct(workspaceUid, product.id, data)
      else await createProduct(workspaceUid, data)
      onSaved(product ? 'Produto atualizado.' : 'Produto cadastrado.')
    } catch { setError('Não foi possível salvar. Confira sua conexão e tente novamente.') }
    finally { setSaving(false) }
  }

  return <div className="sale-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section className="sale-modal product-modal" role="dialog" aria-modal="true" aria-labelledby="product-form-title"><header className="sale-modal-header"><div><p className="eyebrow">{typeName(type).toUpperCase()}</p><h2 id="product-form-title">{product ? 'Editar produto' : 'Novo produto'}</h2><p>Cadastre informações comerciais e o saldo inicial.</p></div><button className="modal-close" onClick={onClose} aria-label="Fechar">×</button></header><form className="sale-form" onSubmit={submit}><div className="form-grid form-grid-two">
    <label className="field-span-two">Nome do produto <b>*</b><input required maxLength={120} value={form.name} onChange={(event) => set('name', event.target.value)} placeholder="Ex.: Vaso decorativo personalizado" /></label>
    <label>SKU / código<input maxLength={60} value={form.sku} onChange={(event) => set('sku', event.target.value)} placeholder="Código interno" /></label>
    <label>Categoria<input maxLength={80} value={form.category} onChange={(event) => set('category', event.target.value)} placeholder="Ex.: Decoração" /></label>
    <label>Custo unitário (R$)<input type="number" min="0" step="0.01" value={form.cost} onChange={(event) => set('cost', event.target.value)} /></label>
    <label>Preço de venda (R$)<input type="number" min="0" step="0.01" value={form.price} onChange={(event) => set('price', event.target.value)} /></label>
    <label>{product ? 'Saldo atual' : 'Saldo inicial'}<input type="number" min="0" step="1" readOnly={Boolean(product)} value={form.quantity} onChange={(event) => set('quantity', event.target.value)} />{product && <small>Para alterar o saldo, use os ajustes na área Estoque.</small>}</label>
    <label>Estoque mínimo<input type="number" min="0" step="1" value={form.minStock} onChange={(event) => set('minStock', event.target.value)} /><small>O sistema sinaliza quando o saldo chegar a este limite.</small></label>
    <label className="field-span-two">Descrição<textarea rows="3" maxLength={600} value={form.description} onChange={(event) => set('description', event.target.value)} /></label>
  </div>{error && <div className="alert alert-error" role="alert">{error}</div>}<footer className="sale-form-footer"><span>Classificação: <b>{typeName(type)}</b></span><div><button type="button" className="button button-secondary" onClick={onClose}>Cancelar</button><button className="button button-primary" disabled={saving}>{saving ? 'Salvando…' : 'Salvar produto'}</button></div></footer></form></section></div>
}

export default function ProductsPage() {
  const { workspaceUid } = useAuth()
  const { products, loading, error } = useProducts()
  const [type, setType] = useState('mercadolivre')
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState(null)
  const [formOpen, setFormOpen] = useState(false)
  const [toast, setToast] = useState('')
  const [actionError, setActionError] = useState('')
  const [mlConnected, setMlConnected] = useState(false)
  const [mlBusy, setMlBusy] = useState(false)
  const [mlStatus, setMlStatus] = useState('')
  const [mlError, setMlError] = useState('')
  const list = useMemo(() => products.filter((product) => product.active !== false && product.type === type && `${product.name} ${product.sku} ${product.category}`.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR'))), [products, type, search])
  const counts = { mercadolivre: products.filter((item) => item.active !== false && item.type === 'mercadolivre').length, fisico: products.filter((item) => item.active !== false && item.type === 'fisico').length }

  function saved(message) { setFormOpen(false); setEditing(null); setToast(message); window.setTimeout(() => setToast(''), 3000) }
  useEffect(() => { getMercadoLivreConnection().then((status) => setMlConnected(status.connected)).catch(() => {}) }, [workspaceUid])
  async function connectMercadoLivre() {
    setMlBusy(true); setMlError(''); setMlStatus('')
    try { const { authorizationUrl } = await startMercadoLivreConnection(); window.location.assign(authorizationUrl) }
    catch (cause) { setMlError(cause.message || 'Não foi possível iniciar a conexão. Confira a configuração do Mercado Livre.'); setMlBusy(false) }
  }
  async function importMercadoLivre() {
    setMlBusy(true); setMlError(''); setMlStatus('')
    try { const result = await syncMercadoLivreProducts(); setMlStatus(`${result.imported} anúncio(s) ativo(s) importado(s) com estoque atualizado.${result.truncated ? ' Rode a importação novamente para continuar com os próximos.' : ''}`) }
    catch (cause) { setMlError(cause.message || 'Não foi possível importar os anúncios do Mercado Livre.') }
    finally { setMlBusy(false) }
  }
  async function archive(product) {
    if (!window.confirm(`Arquivar ${product.name}? O produto e o histórico de estoque serão preservados.`)) return
    try { await archiveProduct(workspaceUid, product.id); saved('Produto arquivado.') }
    catch { setActionError('Não foi possível arquivar o produto.') }
  }

  return <div className="page-stack">
    <div className="page-intro"><div><p className="eyebrow">CATÁLOGO</p><h2>Produtos</h2><p>Cadastre e organize separadamente os produtos do Mercado Livre e os produtos físicos.</p></div><button className="button button-primary" onClick={() => { setEditing(null); setFormOpen(true) }}>＋ Novo produto</button></div>
    <div className="product-tabs" role="tablist" aria-label="Tipo de produto"><button role="tab" aria-selected={type === 'mercadolivre'} className={type === 'mercadolivre' ? 'product-tab-active' : ''} onClick={() => setType('mercadolivre')}><span>Mercado Livre</span><b>{counts.mercadolivre}</b></button><button role="tab" aria-selected={type === 'fisico'} className={type === 'fisico' ? 'product-tab-active' : ''} onClick={() => setType('fisico')}><span>Físicos</span><b>{counts.fisico}</b></button></div>
    <section className="panel products-panel"><div className="products-toolbar"><label className="search-field"><span aria-hidden="true">⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por produto, SKU ou categoria" /></label><span className="count-chip">{list.length} {list.length === 1 ? 'produto' : 'produtos'}</span></div>
      {error && <div className="sales-error" role="alert">{error}</div>}{actionError && <div className="sales-error" role="alert">{actionError}</div>}
      {loading ? <div className="sales-loading">Carregando produtos…</div> : <div className="sales-table-scroll"><table className="sales-table products-table"><thead><tr><th>Produto</th><th>SKU</th><th>Estoque</th><th>Custo</th><th>Preço</th><th>Ações</th></tr></thead><tbody>{list.map((product) => <tr key={product.id} className={Number(product.quantity) <= Number(product.minStock) ? 'stock-low-row' : ''}><td><strong className="table-primary-text">{product.name}</strong><small>{product.category || 'Sem categoria'}</small></td><td>{product.sku || '—'}</td><td><strong>{Number(product.quantity) || 0}</strong><small>mínimo {Number(product.minStock) || 0}</small></td><td>{money(product.cost)}</td><td>{money(product.price)}</td><td><div className="sale-actions"><button onClick={() => { setEditing(product); setFormOpen(true) }}>Editar</button><button className="cancel-action" onClick={() => archive(product)}>Arquivar</button></div></td></tr>)}{list.length === 0 && <tr><td colSpan="6"><div className="table-empty"><strong>{search ? 'Nenhum produto encontrado' : `Nenhum produto ${typeName(type).toLowerCase()} cadastrado`}</strong><span>Use “Novo produto” para cadastrar neste grupo.</span></div></td></tr>}</tbody></table></div>}
    </section>
    {type === 'mercadolivre' && <section className="panel ml-sync-panel"><div><p className="eyebrow">IMPORTAÇÃO DO MERCADO LIVRE</p><strong>{mlConnected ? 'Conta conectada' : 'Conecte sua conta'}</strong><p>{mlConnected ? 'Importe seus anúncios ativos e atualize produtos e estoque neste sistema.' : 'A autorização importa dados do Mercado Livre para cá. O sistema não altera seus anúncios.'}</p>{mlStatus && <small className="ml-sync-success" role="status">{mlStatus}</small>}{mlError && <small className="ml-sync-error" role="alert">{mlError}</small>}</div><div className="ml-sync-actions">{mlConnected ? <button className="button button-primary" disabled={mlBusy} onClick={importMercadoLivre}>{mlBusy ? 'Importando…' : 'Importar anúncios'}</button> : <button className="button button-primary" disabled={mlBusy} onClick={connectMercadoLivre}>{mlBusy ? 'Conectando…' : 'Conectar Mercado Livre'}</button>}</div></section>}
    {formOpen && <ProductForm product={editing} type={type} onClose={() => { setFormOpen(false); setEditing(null) }} onSaved={saved} />}{toast && <div className="toast-success" role="status">{toast}</div>}
  </div>
}
