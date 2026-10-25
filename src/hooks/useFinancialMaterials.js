import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext.jsx'
import { watchMaterials } from '../services/finance/materials.js'

export default function useFinancialMaterials() {
  const { workspaceUid } = useAuth()
  const [materials, setMaterials] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!workspaceUid) {
      setMaterials([])
      setLoading(false)
      return undefined
    }
    setLoading(true)
    setError('')
    return watchMaterials(workspaceUid, (rows) => {
      setMaterials(rows.filter((item) => item.active !== false))
      setLoading(false)
    }, (cause) => {
      console.error('Não foi possível carregar o estoque de materiais.', cause)
      setError(cause.code === 'permission-denied'
        ? 'O Firestore bloqueou o acesso aos materiais. Confira as regras publicadas.'
        : 'Não foi possível carregar os materiais. Verifique sua conexão.')
      setLoading(false)
    })
  }, [workspaceUid])

  return { materials, loading, error }
}
