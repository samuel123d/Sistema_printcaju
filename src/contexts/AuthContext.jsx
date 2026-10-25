import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth'
import { doc, onSnapshot } from 'firebase/firestore'
import { auth, db } from '../services/firebase/config.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [workspaceUid, setWorkspaceUid] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let stopProfileListener = () => {}
    let stopOwnerListener = () => {}
    let accessTimeout
    const stopAuthListener = onAuthStateChanged(auth, (nextUser) => {
      stopProfileListener()
      stopOwnerListener()
      clearTimeout(accessTimeout)
      setUser(nextUser)
      setIsAdmin(false)
      setWorkspaceUid(null)
      if (!nextUser) {
        setLoading(false)
        return
      }
      setLoading(true)
      let hasAdminRole = false
      let isLegacyOwner = false
      let receivedProfile = false
      let receivedOwner = false
      // Do not leave the whole app behind the loading screen if Firestore is
      // unreachable or its rules reject one of the initial reads.
      accessTimeout = setTimeout(() => setLoading(false), 10000)
      const updateAccess = () => {
        setIsAdmin(hasAdminRole || isLegacyOwner)
        if (receivedProfile && receivedOwner) {
          clearTimeout(accessTimeout)
          setLoading(false)
        }
      }
      stopProfileListener = onSnapshot(doc(db, 'users', nextUser.uid), (profile) => {
        hasAdminRole = profile.exists() && profile.data().role === 'admin'
        receivedProfile = true
        updateAccess()
      }, (error) => {
        console.error('Não foi possível validar a função no Firestore.', error)
        receivedProfile = true
        updateAccess()
      })
      stopOwnerListener = onSnapshot(doc(db, '_system', 'owner'), (owner) => {
        isLegacyOwner = owner.exists() && owner.data().uid === nextUser.uid
        setWorkspaceUid(owner.exists() ? owner.data().uid : nextUser.uid)
        receivedOwner = true
        updateAccess()
      }, (error) => {
        console.error('Não foi possível validar o registro antigo do administrador.', error)
        setWorkspaceUid(nextUser.uid)
        receivedOwner = true
        updateAccess()
      })
    })
    return () => {
      clearTimeout(accessTimeout)
      stopProfileListener()
      stopOwnerListener()
      stopAuthListener()
    }
  }, [])

  const value = useMemo(() => ({
    user,
    isAdmin,
    workspaceUid,
    loading,
    signOut: () => firebaseSignOut(auth),
  }), [user, isAdmin, workspaceUid, loading])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth precisa ser usado dentro de AuthProvider.')
  return context
}
