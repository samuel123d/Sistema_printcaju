import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext.jsx'
import { watchFinancialTransactions } from '../services/finance/transactions.js'

export default function useFinancialTransactions() {
  const { workspaceUid } = useAuth()
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!workspaceUid) {
      setTransactions([])
      setLoading(false)
      return undefined
    }

    setTransactions([])
    setLoading(true)
    setError('')
    return watchFinancialTransactions(workspaceUid, (rows) => {
      setTransactions(rows)
      setLoading(false)
      setError('')
    }, (cause) => {
      console.error('Não foi possível carregar os lançamentos financeiros.', cause)
      setTransactions([])
      setLoading(false)
      setError(cause.code === 'permission-denied'
        ? 'O Firestore bloqueou a leitura dos lançamentos financeiros. Confira as regras da sua conta.'
        : 'Não foi possível carregar os lançamentos. Verifique sua conexão e tente novamente.')
    })
  }, [workspaceUid])

  return { transactions, loading, error }
}
