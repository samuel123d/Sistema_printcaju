export const purchaseUnits = [
  { value: 'g', label: 'grama (g)', baseUnit: 'g', factor: 1 },
  { value: 'kg', label: 'quilograma (kg)', baseUnit: 'g', factor: 1000 },
  { value: 'ml', label: 'mililitro (ml)', baseUnit: 'ml', factor: 1 },
  { value: 'l', label: 'litro (L)', baseUnit: 'ml', factor: 1000 },
  { value: 'cm', label: 'centímetro (cm)', baseUnit: 'm', factor: 0.01 },
  { value: 'mm', label: 'milímetro (mm)', baseUnit: 'm', factor: 0.001 },
  { value: 'm', label: 'metro (m)', baseUnit: 'm', factor: 1 },
  { value: 'area', label: 'unidade por largura × comprimento (m²)', baseUnit: 'm2', factor: 1, dimensions: true },
  { value: 'unidade', label: 'unidade', baseUnit: 'unidade', factor: 1 },
  { value: 'folha', label: 'folha', baseUnit: 'folha', factor: 1 },
  { value: 'kWh', label: 'quilowatt-hora (kWh)', baseUnit: 'kWh', factor: 1 },
  { value: 'hora', label: 'hora', baseUnit: 'hora', factor: 1 },
]

export function normalizeQuantity(quantity, unit) {
  const selectedUnit = purchaseUnits.find((item) => item.value === unit)
  if (!selectedUnit) throw new Error('Selecione uma unidade válida.')
  return { quantity: Number(quantity) * selectedUnit.factor, baseUnit: selectedUnit.baseUnit }
}

export function calculateAreaInSquareMeters(width, length, dimensionUnit) {
  const factor = { mm: 0.001, cm: 0.01, m: 1 }[dimensionUnit]
  const normalizedWidth = Number(width) * factor
  const normalizedLength = Number(length) * factor
  if (!Number.isFinite(normalizedWidth) || !Number.isFinite(normalizedLength) || normalizedWidth <= 0 || normalizedLength <= 0) {
    throw new Error('Informe largura e comprimento maiores que zero.')
  }
  return normalizedWidth * normalizedLength
}

export function calculatePurchaseBaseQuantity(quantity, unit, dimensions = {}) {
  const selectedUnit = purchaseUnits.find((item) => item.value === unit)
  if (!selectedUnit) throw new Error('Selecione uma unidade válida.')
  const packageCount = Number(quantity)
  if (!Number.isFinite(packageCount) || packageCount <= 0) throw new Error('A quantidade comprada precisa ser maior que zero.')
  const baseQuantity = selectedUnit.dimensions
    ? packageCount * calculateAreaInSquareMeters(dimensions.width ?? dimensions.packageWidth, dimensions.length ?? dimensions.packageLength, dimensions.dimensionUnit)
    : packageCount * selectedUnit.factor
  if (!Number.isFinite(baseQuantity) || baseQuantity <= 0) throw new Error('A quantidade convertida está fora do intervalo permitido.')
  return baseQuantity
}

export function formatUnit(unit) {
  return { g: 'g', ml: 'ml', m: 'm', m2: 'm²', unidade: 'un.', folha: 'folha', kWh: 'kWh', hora: 'h' }[unit] || unit
}
