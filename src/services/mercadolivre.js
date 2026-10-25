import { getFunctions, httpsCallable } from 'firebase/functions'
import { firebaseApp } from './firebase/config.js'

const functions = getFunctions(firebaseApp, 'southamerica-east1')
async function invoke(name) { return (await httpsCallable(functions, name)()).data }

export const getMercadoLivreConnection = () => invoke('getMercadoLivreConnection')
export const startMercadoLivreConnection = () => invoke('startMercadoLivreConnection')
export const syncMercadoLivreProducts = () => invoke('syncMercadoLivreProducts')
