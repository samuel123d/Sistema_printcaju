import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { signInWithEmailAndPassword } from 'firebase/auth'
import Brand from '../components/Brand.jsx'
import { auth } from '../services/firebase/config.js'

function authErrorMessage(error) {
  const messages = {
    'auth/invalid-credential': 'E-mail ou senha incorretos.',
    'auth/invalid-email': 'Digite um e-mail válido.',
    'auth/too-many-requests': 'Muitas tentativas. Aguarde um pouco e tente novamente.',
    'auth/network-request-failed': 'Falha de conexão. Verifique sua internet e tente novamente.',
    'auth/user-disabled': 'Esta conta está desativada.',
    'auth/operation-not-allowed': 'Ative o método E-mail/senha no Console do Firebase.',
  }
  return messages[error.code] || 'Não foi possível entrar. Confira os dados e tente novamente.'
}

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const location = useLocation()
  const denied = new URLSearchParams(location.search).has('acesso')

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password)
    } catch (cause) {
      setError(authErrorMessage(cause))
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="auth-screen">
      <section className="auth-card">
        <Brand />
        <p className="eyebrow auth-eyebrow">ÁREA ADMINISTRATIVA</p>
        <h1>Acesse sua conta</h1>
        <p className="auth-subtitle">Entre para continuar no painel da PrintCaju.</p>
        {denied && <div className="alert alert-error">Esta conta não está vinculada ao administrador da PrintCaju.</div>}
        {error && <div className="alert alert-error" role="alert">{error}</div>}
        <form onSubmit={handleSubmit} className="auth-form">
          <label>E-mail<input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="voce@exemplo.com" /></label>
          <label>Senha<input type="password" autoComplete="current-password" required minLength={6} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Sua senha" /></label>
          <button className="button button-primary button-full" disabled={busy}>{busy ? 'Entrando…' : 'Entrar'}</button>
        </form>
        <p className="auth-private"><span />Acesso privado da PrintCaju</p>
      </section>
    </main>
  )
}
