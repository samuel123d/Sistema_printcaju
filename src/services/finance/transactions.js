import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore'
import { db } from '../firebase/config.js'

const transactionsCollection = (uid) => collection(db, 'users', uid, 'financialTransactions')

export function watchFinancialTransactions(uid, onRows, onError) {
  return onSnapshot(query(transactionsCollection(uid), orderBy('date', 'desc')), (snapshot) => {
    onRows(snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() })))
  }, onError)
}

export function createFinancialTransaction(uid, transaction, createdBy = uid) {
  return addDoc(transactionsCollection(uid), {
    ...transaction,
    status: 'active',
    createdBy,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

export function updateFinancialTransaction(uid, transactionId, transaction) {
  return updateDoc(doc(db, 'users', uid, 'financialTransactions', transactionId), {
    ...transaction,
    updatedAt: serverTimestamp(),
  })
}

export function voidFinancialTransaction(uid, transactionId) {
  return updateDoc(doc(db, 'users', uid, 'financialTransactions', transactionId), {
    status: 'cancelled',
    cancelledAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

export function deleteFinancialTransaction(uid, transactionId) {
  return deleteDoc(doc(db, 'users', uid, 'financialTransactions', transactionId))
}
