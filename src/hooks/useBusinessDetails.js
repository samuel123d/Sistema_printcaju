import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext.jsx'
import { DEFAULT_BUSINESS_DETAILS, watchBusinessDetails } from '../services/settings/settings.js'

export default function useBusinessDetails() {
  const { workspaceUid } = useAuth()
  const [business, setBusiness] = useState(DEFAULT_BUSINESS_DETAILS)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!workspaceUid) {
      setBusiness(DEFAULT_BUSINESS_DETAILS)
      setLoading(false)
      return undefined
    }
    setLoading(true)
    setError('')
    return watchBusinessDetails(workspaceUid, (details) => {
      setBusiness(details)
      setLoading(false)
    }, (cause) => {
      console.error('Não foi possível carregar os dados comerciais da empresa.', cause)
      setError('Não foi possível carregar os dados da empresa. Verifique as regras e a conexão.')
      setLoading(false)
    })
  }, [workspaceUid])

  return { business, loading, error }
}
