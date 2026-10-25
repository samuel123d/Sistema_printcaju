import { collection, doc, onSnapshot, orderBy, query, runTransaction, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase/config.js'
import { purchaseUnits } from './units.js'
import { calculateWeightedUnitCost } from './costing.js'

const materialsCollection = (uid) => collection(db, 'users', uid, 'materials')

export function watchMaterials(uid, onRows, onError) {
  return onSnapshot(query(materialsCollection(uid), orderBy('name')), (snapshot) => {
    onRows(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })))
  }, onError)
}

export function createMaterialPurchase(uid, purchase, createdBy = uid, materialId = '') {
  const materialRef = materialId
    ? doc(db, 'users', uid, 'materials', materialId)
    : doc(materialsCollection(uid))
  const purchaseRef = doc(collection(db, 'users', uid, 'materialPurchases'))
  const expenseRef = doc(collection(db, 'users', uid, 'financialTransactions'))

  return runTransaction(db, async (transaction) => {
    if (!Number.isFinite(Number(purchase.packageQuantity)) || Number(purchase.packageQuantity) <= 0) throw new Error('A quantidade comprada precisa ser maior que zero.')
    if (!Number.isFinite(Number(purchase.packageCost)) || Number(purchase.packageCost) <= 0) throw new Error('O valor da compra precisa ser maior que zero.')
    const existing = materialId ? await transaction.get(materialRef) : null
    if (existing && !existing.exists()) throw new Error('O material não foi encontrado.')
    const current = existing?.data()
    const selectedUnit = purchaseUnits.find((item) => item.value === purchase.packageUnit)
    if (!selectedUnit || selectedUnit.baseUnit !== purchase.baseUnit) throw new Error('A unidade da compra não corresponde à unidade base do material.')
    if (current && current.baseUnit !== purchase.baseUnit) throw new Error('Use a mesma unidade de medida cadastrada para este material.')
    const purchasedQuantity = Number(purchase.packageQuantity) * selectedUnit.factor
    if (!Number.isFinite(purchasedQuantity) || purchasedQuantity <= 0) throw new Error('A quantidade convertida está fora do intervalo permitido.')
    const previousQuantity = Number(current?.stockQuantity) || 0
    const nextQuantity = previousQuantity + purchasedQuantity
    const unitCost = calculateWeightedUnitCost(previousQuantity, current?.unitCost, purchasedQuantity, purchase.packageCost)
    if (!Number.isFinite(nextQuantity) || !Number.isFinite(unitCost)) throw new Error('O estoque ou o custo calculado está fora do intervalo permitido.')
    const minimumStock = current ? Number(current.minStock) || 0 : Number(purchase.minStock) || 0
    if (!Number.isFinite(minimumStock) || minimumStock < 0) throw new Error('O estoque mínimo não pode ser negativo.')
    const material = {
      name: current?.name || purchase.name.trim(),
      baseUnit: purchase.baseUnit,
      stockQuantity: nextQuantity,
      minStock: minimumStock,
      unitCost,
      active: true,
      updatedAt: serverTimestamp(),
    }

    if (current) {
      transaction.update(materialRef, material)
    } else {
      transaction.set(materialRef, { ...material, createdAt: serverTimestamp() })
    }

    transaction.set(purchaseRef, {
      materialId: materialRef.id,
      materialName: material.name,
      date: purchase.date,
      packageQuantity: Number(purchase.packageQuantity),
      packageUnit: purchase.packageUnit,
      baseQuantity: purchasedQuantity,
      baseUnit: purchase.baseUnit,
      total: Number(purchase.packageCost),
      paymentMethod: purchase.paymentMethod,
      createdBy,
      createdAt: serverTimestamp(),
    })
    transaction.set(expenseRef, {
      type: 'expense',
      date: purchase.date,
      description: `Compra de material: ${material.name}`,
      category: 'materials',
      amount: Number(purchase.packageCost),
      paymentMethod: purchase.paymentMethod,
      notes: `Entrada de ${purchase.packageQuantity} ${purchase.packageUnit} no estoque de materiais.`,
      status: 'active',
      sourceMaterialPurchaseId: purchaseRef.id,
      createdBy,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    return materialRef.id
  })
}
