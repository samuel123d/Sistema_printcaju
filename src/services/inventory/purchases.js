import { collection, doc, onSnapshot, orderBy, query, runTransaction, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase/config.js'

const purchasesCollection = (uid) => collection(db, 'users', uid, 'purchases')

export function watchPurchases(uid, onRows, onError) {
  return onSnapshot(query(purchasesCollection(uid), orderBy('date', 'desc')), (snapshot) => {
    onRows(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })))
  }, onError)
}

export function createPurchase(uid, purchase) {
  const purchaseRef = doc(purchasesCollection(uid))
  const productRef = doc(db, 'users', uid, 'products', purchase.productId)
  const movementRef = doc(collection(db, 'users', uid, 'stockMovements'))
  return runTransaction(db, async (transaction) => {
    const product = await transaction.get(productRef)
    if (!product.exists()) throw new Error('Produto não encontrado.')
    const before = Number(product.data().quantity) || 0
    const after = before + purchase.quantity
    transaction.update(productRef, { quantity: after, updatedAt: serverTimestamp() })
    transaction.set(movementRef, { productId: purchase.productId, productName: product.data().name, delta: purchase.quantity, before, after, reason: `Compra${purchase.supplier ? ` · ${purchase.supplier}` : ''}`, purchaseId: purchaseRef.id, createdAt: serverTimestamp() })
    transaction.set(purchaseRef, { ...purchase, productName: product.data().name, status: 'active', createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
    return purchaseRef.id
  })
}

export function addPurchaseToExpenses(uid, purchaseId, createdBy = uid) {
  const purchaseRef = doc(db, 'users', uid, 'purchases', purchaseId)
  const expenseRef = doc(collection(db, 'users', uid, 'financialTransactions'))
  return runTransaction(db, async (transaction) => {
    const purchase = await transaction.get(purchaseRef)
    if (!purchase.exists()) throw new Error('Compra não encontrada.')
    const data = purchase.data()
    if (data.expenseId) return data.expenseId
    transaction.set(expenseRef, {
      type: 'expense', date: data.date, description: `Compra: ${data.productName}`,
      category: 'materials', amount: data.total, paymentMethod: data.paymentMethod || 'other',
      notes: [data.supplier && `Fornecedor: ${data.supplier}`, data.notes, `Compra ${purchaseId}`].filter(Boolean).join(' · '),
      status: 'active', createdBy, sourcePurchaseId: purchaseId, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    })
    transaction.update(purchaseRef, { expenseId: expenseRef.id, expenseCreatedAt: serverTimestamp(), updatedAt: serverTimestamp() })
    return expenseRef.id
  })
}
