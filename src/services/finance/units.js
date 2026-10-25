export const purchaseUnits = [
  { value: 'g', label: 'grama (g)', baseUnit: 'g', factor: 1 },
  { value: 'kg', label: 'quilograma (kg)', baseUnit: 'g', factor: 1000 },
  { value: 'ml', label: 'mililitro (ml)', baseUnit: 'ml', factor: 1 },
  { value: 'l', label: 'litro (L)', baseUnit: 'ml', factor: 1000 },
  { value: 'cm', label: 'centímetro (cm)', baseUnit: 'm', factor: 0.01 },
  { value: 'm', label: 'metro (m)', baseUnit: 'm', factor: 1 },
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

export function formatUnit(unit) {
  return { g: 'g', ml: 'ml', m: 'm', unidade: 'un.', folha: 'folha', kWh: 'kWh', hora: 'h' }[unit] || unit
}
