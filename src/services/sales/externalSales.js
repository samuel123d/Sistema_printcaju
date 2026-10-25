import { addDoc, collection, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore'
import { db } from '../firebase/config.js'

function salesCollection(uid) {
  return collection(db, 'users', uid, 'externalSales')
}

export function watchExternalSales(uid, onRows, onError) {
  const salesQuery = query(salesCollection(uid), orderBy('soldAt', 'desc'))
  return onSnapshot(salesQuery, (snapshot) => {
    onRows(snapshot.docs.map((sale) => ({ id: sale.id, ...sale.data() })))
  }, onError)
}

export function createExternalSale(uid, sale, createdBy = uid) {
  return addDoc(salesCollection(uid), {
    ...sale,
    source: 'manual',
    status: 'active',
    createdBy,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

export function updateExternalSale(uid, saleId, sale) {
  return updateDoc(doc(db, 'users', uid, 'externalSales', saleId), {
    ...sale,
    updatedAt: serverTimestamp(),
  })
}

export function cancelExternalSale(uid, saleId) {
  return updateDoc(doc(db, 'users', uid, 'externalSales', saleId), {
    status: 'cancelled',
    cancelledAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}
