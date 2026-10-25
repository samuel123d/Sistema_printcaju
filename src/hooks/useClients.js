import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext.jsx'
import { watchClients } from '../services/clients/clients.js'

export default function useClients() {
  const { workspaceUid } = useAuth()
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!workspaceUid) {
      setClients([])
      setLoading(false)
      return undefined
    }
    setClients([])
    setLoading(true)
    setError('')
    return watchClients(workspaceUid, (rows) => {
      setClients(rows.sort((left, right) => left.name.localeCompare(right.name, 'pt-BR')))
      setLoading(false)
      setError('')
    }, (cause) => {
      console.error('Não foi possível carregar os clientes.', cause)
      setError(cause.code === 'permission-denied'
        ? 'O Firestore bloqueou o acesso aos clientes. Confira as regras publicadas.'
        : 'Não foi possível carregar os clientes. Verifique sua conexão.')
      setLoading(false)
    })
  }, [workspaceUid])

  return { clients, loading, error }
}
