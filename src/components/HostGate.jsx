import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { db } from '../firebase'
import { doc, getDoc } from 'firebase/firestore'
import { Card, Btn } from '../components/UI'

const STORAGE_KEY = 'qm_host_auth'

// Simple hash for comparison (not crypto-secure, just enough for quiz night)
function simpleHash(str) {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash |= 0
  }
  return hash.toString(36)
}

export function useHostAuth() {
  const [isHost, setIsHost] = useState(() => {
    return sessionStorage.getItem(STORAGE_KEY) === 'true'
  })

  const login = () => {
    sessionStorage.setItem(STORAGE_KEY, 'true')
    setIsHost(true)
  }

  const logout = () => {
    sessionStorage.removeItem(STORAGE_KEY)
    setIsHost(false)
  }

  return { isHost, login, logout }
}

export default function HostGate({ children, onBack }) {
  const { isHost, login } = useHostAuth()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [configPassword, setConfigPassword] = useState(null)

  // Load password from Firestore config
  useEffect(() => {
    getDoc(doc(db, 'config', 'host')).then(snap => {
      if (snap.exists()) {
        setConfigPassword(snap.data().password || '')
      } else {
        // No config yet — no password required (first time setup)
        setConfigPassword(null)
      }
    }).catch(() => {
      setConfigPassword(null)
    })
  }, [])

  if (isHost) return children

  const handleSubmit = (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    // If no config exists, allow access (first time)
    if (configPassword === null || configPassword === '') {
      login()
      return
    }

    if (password === configPassword) {
      login()
    } else {
      setError('Mot de passe incorrect')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-[360px]">
        <Card>
          <div className="text-center mb-6">
            <div className="text-5xl mb-3">🔒</div>
            <h2 className="text-xl font-black">Accès Host</h2>
            <p className="text-slate-400 text-sm mt-1">Entrez le mot de passe pour accéder à la console</p>
          </div>

          {configPassword === null ? (
            <div className="text-center">
              <div className="text-amber-400 text-sm mb-4">
                ⚠️ Aucun mot de passe configuré.
                <br />Ajoutez un document <code className="bg-white/10 px-1 rounded">config/host</code> dans Firestore avec un champ <code className="bg-white/10 px-1 rounded">password</code>.
              </div>
              <Btn onClick={login} className="w-full">Accéder sans mot de passe</Btn>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <input
                type="password"
                value={password}
                onChange={e => { setPassword(e.target.value); setError('') }}
                placeholder="Mot de passe..."
                autoFocus
                className="w-full bg-white/5 border border-dark-500 rounded-xl px-4 py-3 text-white outline-none focus:border-brand text-center text-lg mb-4"
              />
              {error && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-accent-red text-sm text-center mb-3">
                  {error}
                </motion.div>
              )}
              <Btn type="submit" className="w-full" disabled={!password.trim()}>
                🔓 Connexion
              </Btn>
            </form>
          )}

          <button onClick={onBack} className="w-full mt-4 text-slate-500 text-sm hover:text-slate-300 transition">
            ← Retour
          </button>
        </Card>
      </motion.div>
    </div>
  )
}
