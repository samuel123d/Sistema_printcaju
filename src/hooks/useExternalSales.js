import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext.jsx'
import { watchExternalSales } from '../services/sales/externalSales.js'

export default function useExternalSales() {
  const { workspaceUid } = useAuth()
  const [sales, setSales] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!workspaceUid) {
      setSales([])
      setLoading(false)
      return undefined
    }
    setLoading(true)
    setError('')
    return watchExternalSales(workspaceUid, (rows) => {
      setSales(rows)
      setLoading(false)
      setError('')
    }, (cause) => {
      console.error('Não foi possível carregar as vendas externas.', cause)
      setSales([])
      setLoading(false)
      setError(cause.code === 'permission-denied'
        ? 'O Firestore bloqueou a leitura. Confira se as regras atualizadas foram publicadas.'
        : 'Não foi possível carregar as vendas. Verifique sua conexão e tente novamente.')
    })
  }, [workspaceUid])

  return { sales, loading, error }
}
