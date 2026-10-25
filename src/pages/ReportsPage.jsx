import { useMemo, useState } from 'react'
import useExternalSales from '../hooks/useExternalSales.js'
import useFinancialTransactions from '../hooks/useFinancialTransactions.js'
import useProducts from '../hooks/useProducts.js'
import useStockMovements from '../hooks/useStockMovements.js'

const localDate = () => {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
const number = (value) => Number.parseFloat(String(value ?? 0).replace(',', '.')) || 0
const money = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(number(value))
const dateLabel = (value) => {
  if (!value) return '—'
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number)
    return new Intl.DateTimeFormat('pt-BR').format(new Date(year, month - 1, day))
  }
  const date = value?.toDate ? value.toDate() : new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('pt-BR').format(date)
}
const escapeXml = (value) => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;')
const escapeHtml = (value) => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;')
const saleItems = (sale) => (sale.items || []).map((item) => `${item.quantity || 1}x ${item.description || item.name || item.productName || 'Produto'}`).join(', ')
const timestampDate = (value) => {
  if (!value) return ''
  const date = value?.toDate ? value.toDate() : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function saveFile(content, type, filename) {
  const blob = new Blob(['\ufeff', content], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function xmlCell(value, type = 'String') {
  return `<Cell><Data ss:Type="${type}">${escapeXml(value)}</Data></Cell>`
}
function xmlSheet(name, headers, rows) {
  const head = `<Row>${headers.map((item) => xmlCell(item)).join('')}</Row>`
  const body = rows.map((row) => `<Row>${row.map((cell) => xmlCell(cell.value ?? cell, cell.type || 'String')).join('')}</Row>`).join('')
  return `<Worksheet ss:Name="${escapeXml(name)}"><Table>${head}${body}</Table></Worksheet>`
}
function createWorkbook(data) {
  const { sales, transactions, products, movements, productionSales, summary } = data
  const sheets = [
    xmlSheet('Resumo', ['Indicador', 'Valor'], [
      ['Período', data.period], ['Vendas registradas', summary.salesCount], ['Vendas canceladas', summary.cancelledSales], ['Total vendido', { value: summary.gross, type: 'Number' }], ['Recebido', { value: summary.received, type: 'Number' }], ['Em aberto', { value: summary.open, type: 'Number' }], ['Taxas das vendas', { value: summary.fees, type: 'Number' }], ['Outras receitas ativas', { value: summary.income, type: 'Number' }], ['Despesas ativas', { value: summary.expenses, type: 'Number' }], ['Saldo do período', { value: summary.balance, type: 'Number' }], ['Produtos cadastrados', summary.productsCount], ['Unidades em estoque', summary.stockUnits], ['Produtos no mínimo ou abaixo', summary.lowStock], ['Movimentações de estoque', movements.length],
    ]),
    xmlSheet('Vendas', ['Data', 'Cliente', 'Contato', 'Canal', 'Itens', 'Tipo pedido', 'Total', 'Recebido', 'Em aberto', 'Taxas', 'Pagamento', 'Status pagamento', 'Produção', 'Entrega', 'Prazo', 'Status venda', 'Observações'], sales.map((sale) => [dateLabel(sale.soldAt), sale.client?.name, sale.client?.phone || sale.client?.email, sale.channel, saleItems(sale), sale.orderType, { value: number(sale.total), type: 'Number' }, { value: number(sale.receivedAmount), type: 'Number' }, { value: number(sale.outstandingAmount), type: 'Number' }, { value: number(sale.fees), type: 'Number' }, sale.paymentMethod, sale.paymentStatus, sale.productionStatus, sale.deliveryStatus, dateLabel(sale.dueDate), sale.status === 'cancelled' ? 'Cancelada' : 'Ativa', sale.notes])),
    xmlSheet('Financeiro', ['Data', 'Tipo', 'Descrição', 'Categoria', 'Valor', 'Pagamento', 'Status', 'Observações'], transactions.map((entry) => [dateLabel(entry.date), entry.type === 'income' ? 'Receita' : 'Despesa', entry.description, entry.category, { value: number(entry.amount), type: 'Number' }, entry.paymentMethod, entry.status === 'cancelled' ? 'Estornado' : 'Ativo', entry.notes])),
    xmlSheet('Produtos e estoque', ['Produto', 'SKU', 'Tipo', 'Categoria', 'Custo', 'Preço', 'Saldo atual', 'Estoque mínimo', 'Status', 'Descrição'], products.map((product) => [product.name, product.sku, product.type === 'mercadolivre' ? 'Mercado Livre' : 'Físico', product.category, { value: number(product.cost), type: 'Number' }, { value: number(product.price), type: 'Number' }, { value: number(product.quantity), type: 'Number' }, { value: number(product.minStock), type: 'Number' }, product.active === false ? 'Arquivado' : 'Ativo', product.description])),
    xmlSheet('Mov. estoque', ['Data', 'Produto', 'Variação', 'Saldo anterior', 'Saldo posterior', 'Motivo'], movements.map((item) => [dateLabel(timestampDate(item.createdAt)), item.productName, { value: number(item.delta), type: 'Number' }, { value: number(item.before), type: 'Number' }, { value: number(item.after), type: 'Number' }, item.reason])),
    xmlSheet('Pedidos e produção', ['Venda', 'Cliente', 'Itens', 'Tipo', 'Produção', 'Entrega', 'Prazo', 'Venda'], productionSales.map((sale) => [dateLabel(sale.soldAt), sale.client?.name, saleItems(sale), sale.orderType, sale.productionStatus, sale.deliveryStatus, dateLabel(sale.dueDate), sale.status || 'active'])),
  ]
  return `<?xml version="1.0" encoding="UTF-8"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">${sheets.join('')}</Workbook>`
}

function createDocument(data) {
  const { sales, transactions, products, movements, productionSales, summary } = data
  const table = (headers, rows) => `<table><thead><tr>${headers.map((item) => `<th>${escapeHtml(item)}</th>`).join('')}</tr></thead><tbody>${rows.length ? rows.map((row) => `<tr>${row.map((item) => `<td>${escapeHtml(item)}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${headers.length}">Sem registros no período</td></tr>`}</tbody></table>`
  const metrics = [['Vendas ativas', summary.salesCount], ['Vendas canceladas', summary.cancelledSales], ['Total vendido', money(summary.gross)], ['Recebido', money(summary.received)], ['Em aberto', money(summary.open)], ['Taxas das vendas', money(summary.fees)], ['Outras receitas ativas', money(summary.income)], ['Despesas ativas', money(summary.expenses)], ['Saldo do período', money(summary.balance)], ['Produtos cadastrados', summary.productsCount], ['Unidades em estoque', summary.stockUnits], ['Produtos no mínimo ou abaixo', summary.lowStock], ['Movimentações de estoque', movements.length]]
  return `<!doctype html><html><head><meta charset="utf-8"><style>body{font:12px Arial,sans-serif;color:#1e293b;margin:32px}h1{color:#f08a00}h2{margin-top:28px;border-bottom:2px solid #f08a00;padding-bottom:6px}p{color:#64748b}table{width:100%;border-collapse:collapse;margin:10px 0 20px;font-size:10px}th{background:#10293b;color:white;text-align:left}td,th{border:1px solid #d9dee4;padding:6px;vertical-align:top}tr:nth-child(even){background:#f5f7f8}</style></head><body><h1>PrintCaju — Relatório</h1><p>Período: ${escapeHtml(data.period)} · Gerado em ${escapeHtml(dateLabel(localDate()))}</p><h2>Resumo</h2>${table(['Indicador', 'Resultado'], metrics)}<h2>Vendas</h2>${table(['Data', 'Cliente', 'Canal', 'Itens', 'Total', 'Recebido', 'Em aberto', 'Produção', 'Entrega', 'Prazo', 'Status'], sales.map((sale) => [dateLabel(sale.soldAt), sale.client?.name, sale.channel, saleItems(sale), money(sale.total), money(sale.receivedAmount), money(sale.outstandingAmount), sale.productionStatus, sale.deliveryStatus, dateLabel(sale.dueDate), sale.status === 'cancelled' ? 'Cancelada' : 'Ativa']))}<h2>Financeiro</h2>${table(['Data', 'Tipo', 'Descrição', 'Categoria', 'Valor', 'Pagamento', 'Status'], transactions.map((entry) => [dateLabel(entry.date), entry.type === 'income' ? 'Receita' : 'Despesa', entry.description, entry.category, money(entry.amount), entry.paymentMethod, entry.status === 'cancelled' ? 'Estornado' : 'Ativo']))}<h2>Produtos e saldo atual</h2>${table(['Produto', 'SKU', 'Tipo', 'Categoria', 'Custo', 'Preço', 'Saldo', 'Mínimo', 'Status'], products.map((product) => [product.name, product.sku, product.type === 'mercadolivre' ? 'Mercado Livre' : 'Físico', product.category, money(product.cost), money(product.price), product.quantity, product.minStock, product.active === false ? 'Arquivado' : 'Ativo']))}<h2>Movimentações de estoque</h2>${table(['Data', 'Produto', 'Variação', 'Antes', 'Depois', 'Motivo'], movements.map((item) => [dateLabel(timestampDate(item.createdAt)), item.productName, item.delta, item.before, item.after, item.reason]))}<h2>Pedidos e produção</h2>${table(['Venda', 'Cliente', 'Itens', 'Produção', 'Entrega', 'Prazo'], productionSales.map((sale) => [dateLabel(sale.soldAt), sale.client?.name, saleItems(sale), sale.productionStatus, sale.deliveryStatus, dateLabel(sale.dueDate)]))}</body></html>`
}

export default function ReportsPage() {
  const { sales, loading: salesLoading, error: salesError } = useExternalSales()
  const { transactions, loading: transactionsLoading, error: transactionsError } = useFinancialTransactions()
  const { products, loading: productsLoading, error: productsError } = useProducts()
  const { movements, loading: movementsLoading, error: movementsError } = useStockMovements()
  const [startDate, setStartDate] = useState(localDate)
  const [endDate, setEndDate] = useState(localDate)
  const [generated, setGenerated] = useState(false)
  const loading = salesLoading || transactionsLoading || productsLoading || movementsLoading
  const error = salesError || transactionsError || productsError || movementsError
  const availableDays = useMemo(() => {
    const dates = new Set([localDate()])
    sales.forEach((sale) => sale.soldAt && dates.add(sale.soldAt))
    transactions.forEach((entry) => entry.date && dates.add(entry.date))
    movements.forEach((entry) => { const date = timestampDate(entry.createdAt); if (date) dates.add(date) })
    return [...dates].sort((left, right) => right.localeCompare(left)).slice(0, 12)
  }, [sales, transactions, movements])

  const data = useMemo(() => {
    const inside = (date) => (!startDate || date >= startDate) && (!endDate || date <= endDate)
    const selectedSales = sales.filter((sale) => inside(sale.soldAt || ''))
    const productionSales = sales.filter((sale) => sale.status !== 'cancelled' && (inside(sale.dueDate || '') || inside(sale.soldAt || '')))
    const selectedTransactions = transactions.filter((entry) => inside(entry.date || ''))
    const selectedMovements = movements.filter((entry) => inside(timestampDate(entry.createdAt)))
    const activeSales = selectedSales.filter((sale) => sale.status !== 'cancelled')
    const activeTransactions = selectedTransactions.filter((entry) => entry.status !== 'cancelled')
    const gross = activeSales.reduce((sum, sale) => sum + number(sale.total), 0)
    const received = activeSales.reduce((sum, sale) => sum + number(sale.receivedAmount), 0)
    const open = activeSales.reduce((sum, sale) => sum + number(sale.outstandingAmount), 0)
    const fees = activeSales.reduce((sum, sale) => sum + number(sale.fees), 0)
    const income = activeTransactions.filter((entry) => entry.type === 'income').reduce((sum, entry) => sum + number(entry.amount), 0)
    const expenses = activeTransactions.filter((entry) => entry.type === 'expense').reduce((sum, entry) => sum + number(entry.amount), 0)
    const lowStock = products.filter((product) => product.active !== false && number(product.quantity) <= number(product.minStock)).length
    const period = startDate === endDate ? dateLabel(startDate) : `${startDate ? dateLabel(startDate) : 'Início'} a ${endDate ? dateLabel(endDate) : 'Hoje'}`
    return { sales: selectedSales, transactions: selectedTransactions, products, movements: selectedMovements, productionSales, period, summary: { salesCount: activeSales.length, cancelledSales: selectedSales.length - activeSales.length, gross, received, open, fees, income, expenses, balance: received + income - fees - expenses, productsCount: products.length, stockUnits: products.reduce((sum, product) => sum + number(product.quantity), 0), lowStock } }
    }, [sales, transactions, products, movements, startDate, endDate])

  function filename() {
    return startDate === endDate ? startDate : `${startDate || 'inicio'}_a_${endDate || 'hoje'}`
  }

  function downloadExcel() {
    saveFile(createWorkbook(data), 'application/vnd.ms-excel;charset=utf-8', `printcaju-relatorio-${filename()}.xls`)
  }

  function downloadDocument() {
    saveFile(createDocument(data), 'application/msword;charset=utf-8', `printcaju-relatorio-${filename()}.doc`)
  }

  function generate() {
    setGenerated(true)
  }

  return <div className="page-stack reports-page">
    <div className="page-intro"><div><p className="eyebrow">ACOMPANHAMENTO DO NEGÓCIO</p><h2>Relatórios</h2><p>Consulte seus relatórios diários e baixe os registros do sistema em planilha e documento.</p></div></div>
    {error && <div className="sales-error" role="alert">{error}</div>}
    <section className="panel report-generator"><div className="report-generator-copy"><span className="report-icon" aria-hidden="true">▤</span><div><p className="eyebrow">RELATÓRIO DIÁRIO</p><h3>Escolha o dia para consultar</h3><p>Os dados ficam disponíveis nesta tela e são atualizados conforme suas vendas, lançamentos, produtos e estoque.</p></div></div><div className="report-controls"><label>De<input type="date" value={startDate} onChange={(event) => { setStartDate(event.target.value); setGenerated(false) }} /></label><label>Até<input type="date" value={endDate} onChange={(event) => { setEndDate(event.target.value); setGenerated(false) }} /></label><button type="button" className="button button-secondary" onClick={() => { setStartDate(localDate()); setEndDate(localDate()); setGenerated(false) }}>Hoje</button><button type="button" className="button button-primary" onClick={generate} disabled={loading || Boolean(error) || !startDate || !endDate || startDate > endDate}>{loading ? 'Carregando dados…' : 'Ver relatório'}</button></div></section>
    <section className="panel report-history"><header><div><p className="eyebrow">DIAS COM REGISTROS</p><h3>Relatórios diários disponíveis</h3></div><span className="count-chip">Mais recentes</span></header><div className="report-day-list">{availableDays.map((day) => <button type="button" key={day} className={startDate === day && endDate === day ? 'report-day-active' : ''} onClick={() => { setStartDate(day); setEndDate(day); setGenerated(false) }}><strong>{day === localDate() ? 'Hoje' : dateLabel(day)}</strong><span>{day}</span></button>)}</div><p>Selecione um dia para abrir o resumo e baixar sua planilha e seu documento. Dias antigos continuam consultáveis conforme os registros mantidos no sistema.</p></section>
    {generated && <section className="panel report-preview"><header><div><p className="eyebrow">PRÉVIA DO RELATÓRIO</p><h3>Confira antes de baixar</h3><p>Período: {data.period}. Escolha o formato depois de revisar o conteúdo.</p></div><div className="report-downloads"><button type="button" className="button button-secondary" onClick={downloadExcel}>Baixar Excel</button><button type="button" className="button button-primary" onClick={downloadDocument}>Baixar Word</button></div></header><iframe title={`Prévia do relatório de ${data.period}`} srcDoc={createDocument(data)} /></section>}
    <section className="report-metrics" aria-label="Resumo do período"><article><span>Vendas registradas</span><strong>{loading ? '…' : data.summary.salesCount + data.summary.cancelledSales}</strong><small>{data.summary.cancelledSales} canceladas</small></article><article><span>Recebido</span><strong>{loading ? '…' : money(data.summary.received)}</strong><small>Vendas ativas no período</small></article><article><span>Saldo financeiro</span><strong>{loading ? '…' : money(data.summary.balance)}</strong><small>Recebimentos + receitas − taxas − despesas</small></article><article><span>Estoque baixo</span><strong>{loading ? '…' : data.summary.lowStock}</strong><small>Produtos no mínimo ou abaixo</small></article></section>
    <section className="panel report-includes"><header><div><p className="eyebrow">CONTEÚDO DO ARQUIVO</p><h3>O que entra no relatório</h3></div><span className="count-chip">{data.period}</span></header><div className="report-includes-grid"><article><b>Vendas e pedidos</b><span>{data.sales.length} registros · clientes, itens, valores, pagamentos, produção e prazos</span></article><article><b>Financeiro</b><span>{data.transactions.length} lançamentos · receitas, despesas e estornos</span></article><article><b>Produtos e estoque</b><span>{data.products.length} produtos · saldos atuais e níveis mínimos</span></article><article><b>Movimentações</b><span>{data.movements.length} ajustes de estoque no período</span></article></div></section>
    <p className="report-footnote">Os relatórios são gerados a partir dos dados registrados no Firestore. Os arquivos ficam na pasta de downloads do seu dispositivo; para guardar no Google Docs ou Planilhas, envie ou importe os arquivos baixados.</p>
  </div>
}
