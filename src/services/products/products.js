import { addDoc, collection, doc, onSnapshot, orderBy, query, runTransaction, serverTimestamp, updateDoc } from 'firebase/firestore'
import { db } from '../firebase/config.js'

const productCollection = (uid) => collection(db, 'users', uid, 'products')

export function watchProducts(uid, onRows, onError) {
  return onSnapshot(query(productCollection(uid), orderBy('name')), (snapshot) => {
    onRows(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })))
  }, onError)
}

export function createProduct(uid, product) {
  return addDoc(productCollection(uid), {
    ...product,
    active: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

export function updateProduct(uid, productId, product) {
  return updateDoc(doc(db, 'users', uid, 'products', productId), { ...product, updatedAt: serverTimestamp() })
}

export function adjustProductStock(uid, productId, delta, reason) {
  const productRef = doc(db, 'users', uid, 'products', productId)
  const movementRef = doc(collection(db, 'users', uid, 'stockMovements'))
  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(productRef)
    if (!snapshot.exists()) throw new Error('O produto não foi encontrado.')
    const before = Number(snapshot.data().quantity) || 0
    const after = before + Number(delta)
    if (after < 0) throw new Error('O saldo não pode ficar negativo.')
    transaction.update(productRef, { quantity: after, updatedAt: serverTimestamp() })
    transaction.set(movementRef, {
      productId,
      productName: snapshot.data().name,
      delta: Number(delta),
      before,
      after,
      reason: String(reason || '').trim(),
      createdAt: serverTimestamp(),
    })
    return after
  })
}

export function archiveProduct(uid, productId) {
  return updateDoc(doc(db, 'users', uid, 'products', productId), { active: false, updatedAt: serverTimestamp() })
}
