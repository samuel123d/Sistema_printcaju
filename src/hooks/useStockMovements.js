import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext.jsx'
import { watchStockMovements } from '../services/inventory/stockMovements.js'

export default function useStockMovements() {
  const { workspaceUid } = useAuth()
  const [movements, setMovements] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!workspaceUid) { setMovements([]); setLoading(false); return undefined }
    setLoading(true)
    setError('')
    return watchStockMovements(workspaceUid, (rows) => { setMovements(rows); setLoading(false); setError('') }, (cause) => {
      console.error('Não foi possível carregar as movimentações de estoque.', cause)
      setError(cause.code === 'permission-denied' ? 'O Firestore bloqueou a leitura das movimentações. Confira as regras da sua conta.' : 'Não foi possível carregar as movimentações. Verifique sua conexão.')
      setMovements([])
      setLoading(false)
    })
  }, [workspaceUid])

  return { movements, loading, error }
}
