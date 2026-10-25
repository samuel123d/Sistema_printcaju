import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext.jsx'
import { watchQuotes } from '../services/sales/externalSales.js'

export default function useQuotes() {
  const { workspaceUid } = useAuth()
  const [quotes, setQuotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!workspaceUid) {
      setQuotes([])
      setLoading(false)
      return undefined
    }
    setLoading(true)
    setError('')
    return watchQuotes(workspaceUid, (rows) => {
      setQuotes(rows)
      setLoading(false)
    }, (cause) => {
      console.error('Não foi possível carregar os orçamentos.', cause)
      setError(cause.code === 'permission-denied'
        ? 'O Firestore bloqueou a leitura dos orçamentos. Confira as regras publicadas.'
        : 'Não foi possível carregar os orçamentos. Verifique sua conexão.')
      setLoading(false)
    })
  }, [workspaceUid])

  return { quotes, loading, error }
}
