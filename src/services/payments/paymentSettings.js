import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from '../firebase/config.js'

function settingsRef(uid) {
  return doc(db, 'users', uid, 'settings', 'payment')
}

export function watchPaymentSettings(uid, onSettings, onError) {
  return onSnapshot(settingsRef(uid), (snapshot) => onSettings(snapshot.exists() ? snapshot.data() : null), onError)
}

export function savePaymentSettings(uid, settings) {
  return setDoc(settingsRef(uid), { ...settings, updatedAt: serverTimestamp() }, { merge: true })
}
