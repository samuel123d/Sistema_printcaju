export function calculateProductCost({ recipe, energyCost, laborHours, laborRate }) {
  const materialCost = recipe.reduce((total, item) => total + Number(item.quantity || 0) * Number(item.unitCost || 0), 0)
  return materialCost + Number(energyCost || 0) + Number(laborHours || 0) * Number(laborRate || 0)
}

export function calculateWeightedUnitCost(stockQuantity, unitCost, purchaseQuantity, purchaseCost) {
  const totalQuantity = Number(stockQuantity || 0) + Number(purchaseQuantity || 0)
  if (totalQuantity <= 0) return 0
  return (Number(stockQuantity || 0) * Number(unitCost || 0) + Number(purchaseCost || 0)) / totalQuantity
}

export function suggestSalePrice(cost, marginPercent, feePercent) {
  const feeDivisor = 1 - Number(feePercent || 0) / 100
  if (feeDivisor <= 0) return null
  return Number(cost || 0) * (1 + Number(marginPercent || 0) / 100) / feeDivisor
}

export function calculatePrintingEnergyCost(printHours, electricityRate, powerWatts = 220) {
  return Number(printHours || 0) * Number(powerWatts) / 1000 * Number(electricityRate || 0)
}
