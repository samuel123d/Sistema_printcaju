import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, runTransaction, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'
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

export function watchQuotes(uid, onRows, onError) {
  return onSnapshot(query(collection(db, 'users', uid, 'quotes'), orderBy('createdAt', 'desc')), (snapshot) => {
    onRows(snapshot.docs.map((quote) => ({ id: quote.id, ...quote.data() })))
  }, onError)
}

export function createQuote(uid, quote, createdBy = uid) {
  const quoteRef = doc(collection(db, 'users', uid, 'quotes'))
  return setDoc(quoteRef, {
    ...quote,
    quoteNumber: `ORC-${quoteRef.id.slice(0, 8).toUpperCase()}`,
    status: 'open',
    createdBy,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
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

export function convertQuoteToSale(uid, quoteId, sale, createdBy = uid) {
  const quoteRef = doc(db, 'users', uid, 'quotes', quoteId)
  const saleRef = doc(collection(db, 'users', uid, 'externalSales'))
  return runTransaction(db, async (transaction) => {
    const quoteSnapshot = await transaction.get(quoteRef)
    if (!quoteSnapshot.exists()) throw new Error('O orçamento não foi encontrado.')
    if (quoteSnapshot.data().status !== 'open') throw new Error('Este orçamento já foi convertido ou encerrado.')
    transaction.update(quoteRef, { status: 'converted', saleId: saleRef.id, convertedAt: serverTimestamp(), updatedAt: serverTimestamp() })
    transaction.set(saleRef, {
      ...sale,
      source: 'quote',
      quoteId,
      status: 'active',
      createdBy,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    return saleRef.id
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

export function deleteExternalSale(uid, saleId) {
  return deleteDoc(doc(db, 'users', uid, 'externalSales', saleId))
}

export function cancelQuote(uid, quoteId) {
  return updateDoc(doc(db, 'users', uid, 'quotes', quoteId), {
    status: 'cancelled',
    cancelledAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

export function deleteQuote(uid, quoteId) {
  return deleteDoc(doc(db, 'users', uid, 'quotes', quoteId))
}
