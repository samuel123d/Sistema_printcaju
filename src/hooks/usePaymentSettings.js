import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext.jsx'
import { watchPaymentSettings } from '../services/payments/paymentSettings.js'

export default function usePaymentSettings() {
  const { workspaceUid } = useAuth()
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!workspaceUid) {
      setSettings(null)
      setLoading(false)
      return undefined
    }
    setLoading(true)
    return watchPaymentSettings(workspaceUid, (nextSettings) => {
      setSettings(nextSettings)
      setLoading(false)
      setError('')
    }, (cause) => {
      console.error('Não foi possível carregar as configurações de pagamento.', cause)
      setError(cause.code === 'permission-denied'
        ? 'As regras do Firestore ainda não permitem ler as configurações do administrador.'
        : 'Não foi possível carregar as configurações de pagamento.')
      setLoading(false)
    })
  }, [workspaceUid])

  return { settings, loading, error }
}
