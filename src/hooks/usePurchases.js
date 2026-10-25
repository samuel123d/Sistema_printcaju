import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext.jsx'
import { watchPurchases } from '../services/inventory/purchases.js'

export default function usePurchases() {
  const { workspaceUid } = useAuth()
  const [purchases, setPurchases] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  useEffect(() => {
    if (!workspaceUid) { setPurchases([]); setLoading(false); return undefined }
    setLoading(true)
    return watchPurchases(workspaceUid, (rows) => { setPurchases(rows); setLoading(false); setError('') }, (cause) => {
      setError(cause.code === 'permission-denied' ? 'A leitura das compras foi bloqueada pelas regras do Firestore.' : 'Não foi possível carregar as compras.')
      setLoading(false)
    })
  }, [workspaceUid])
  return { purchases, loading, error }
}
