import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext.jsx'
import { watchProducts } from '../services/products/products.js'

export default function useProducts() {
  const { workspaceUid } = useAuth()
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!workspaceUid) { setProducts([]); setLoading(false); return undefined }
    setLoading(true)
    return watchProducts(workspaceUid, (rows) => { setProducts(rows); setLoading(false); setError('') }, (cause) => {
      console.error('Não foi possível carregar produtos e estoque.', cause)
      setError(cause.code === 'permission-denied' ? 'O Firestore bloqueou o acesso. Confira se as regras foram publicadas.' : 'Não foi possível carregar os produtos. Verifique sua conexão.')
      setLoading(false)
    })
  }, [workspaceUid])

  return { products, loading, error }
}
