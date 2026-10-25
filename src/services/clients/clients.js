import { addDoc, collection, deleteDoc, doc, getDocs, onSnapshot, query, serverTimestamp, updateDoc, where } from 'firebase/firestore'
import { db } from '../firebase/config.js'
import { digitsOnly } from '../../utils/inputMasks.js'

const clientsCollection = (uid) => collection(db, 'users', uid, 'clients')

export function watchClients(uid, onRows, onError) {
  return onSnapshot(query(clientsCollection(uid)), (snapshot) => {
    onRows(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })))
  }, onError)
}

function normalizeClient(client) {
  const data = {
    name: String(client.name || '').trim(),
    taxId: String(client.taxId || '').trim(),
    phone: String(client.phone || '').trim(),
    email: String(client.email || '').trim(),
    address: String(client.address || '').trim(),
    city: String(client.city || '').trim(),
    state: String(client.state || '').trim().toUpperCase(),
    postalCode: String(client.postalCode || '').trim(),
    updatedAt: serverTimestamp(),
  }
  data.taxIdDigits = digitsOnly(data.taxId)
  data.phoneDigits = digitsOnly(data.phone)
  data.emailNormalized = data.email.toLocaleLowerCase('pt-BR')
  return data
}

export async function saveClient(uid, client, clientId = '') {
  if (!uid) throw new Error('Não foi possível identificar o espaço de trabalho.')
  const data = normalizeClient(client)
  if (!data.name) throw new Error('Informe o nome do cliente.')
  if (clientId) {
    await updateDoc(doc(db, 'users', uid, 'clients', clientId), data)
    return clientId
  }

  const identity = data.taxIdDigits
    ? ['taxIdDigits', data.taxIdDigits]
    : data.phoneDigits
      ? ['phoneDigits', data.phoneDigits]
      : data.emailNormalized
        ? ['emailNormalized', data.emailNormalized]
        : null
  if (identity) {
    const matches = await getDocs(query(clientsCollection(uid), where(identity[0], '==', identity[1])))
    if (!matches.empty) {
      const existingId = matches.docs[0].id
      await updateDoc(doc(db, 'users', uid, 'clients', existingId), data)
      return existingId
    }
  }

  const created = await addDoc(clientsCollection(uid), { ...data, createdAt: serverTimestamp() })
  return created.id
}

export function deleteClient(uid, clientId) {
  if (!uid || !clientId) throw new Error('Não foi possível identificar o cliente para excluir.')
  return deleteDoc(doc(db, 'users', uid, 'clients', clientId))
}
