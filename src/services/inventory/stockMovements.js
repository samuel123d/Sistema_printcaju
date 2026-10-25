import { collection, onSnapshot, orderBy, query } from 'firebase/firestore'
import { db } from '../firebase/config.js'

export function watchStockMovements(uid, onRows, onError) {
  const movements = collection(db, 'users', uid, 'stockMovements')
  return onSnapshot(query(movements, orderBy('createdAt', 'desc')), (snapshot) => {
    onRows(snapshot.docs.map((movement) => ({ id: movement.id, ...movement.data() })))
  }, onError)
}
