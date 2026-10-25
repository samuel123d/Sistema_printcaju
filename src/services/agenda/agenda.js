import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore'
import { db } from '../firebase/config.js'

const agendaItems = (uid) => collection(db, 'users', uid, 'agendaItems')

export function watchAgendaItems(uid, onRows, onError) {
  return onSnapshot(query(agendaItems(uid), orderBy('date', 'asc')), (snapshot) => {
    onRows(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })))
  }, onError)
}

export function createAgendaItem(uid, item) {
  return addDoc(agendaItems(uid), { ...item, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
}

export function updateAgendaItem(uid, id, item) {
  return updateDoc(doc(db, 'users', uid, 'agendaItems', id), { ...item, updatedAt: serverTimestamp() })
}

export function removeAgendaItem(uid, id) {
  return deleteDoc(doc(db, 'users', uid, 'agendaItems', id))
}
