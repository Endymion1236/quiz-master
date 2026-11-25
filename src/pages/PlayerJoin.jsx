import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { Btn } from '../components/UI'
import { useStore } from '../hooks/useSession'
import { useSound } from '../hooks/useSound'
import { AVATARS, AVATAR_CATEGORIES, TEAM_COLORS, getTeamName } from '../lib/constants'
import { db } from '../firebase'
import { collection, query, where, getDocs } from 'firebase/firestore'

export default function PlayerJoin({ onNavigate }) {
  const [step, setStep] = useState('pin')  // 'pin' | 'profile' | 'team'
  const [pin, setPin] = useState('')
  const [name, setName] = useState('')
  const [avatar, setAvatar] = useState('🐴')
  const [teamId, setTeamId] = useState(null)
  const [loading, setLoading] = useState(false)
  const [sessionInfo, setSessionInfo] = useState(null)
  const { joinSession } = useStore()
  const sfx = useSound()

  // Auto-fill PIN from URL ?pin=XXXXXX (QR code)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const urlPin = params.get('pin')
    if (urlPin && urlPin.length === 6) {
      setPin(urlPin)
      // Clean URL without reloading
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

  const handleCheckPIN = async () => {
    if (pin.length !== 6) return toast.error('Code à 6 chiffres requis')
    setLoading(true)
    try {
      const q = query(collection(db, 'sessions'), where('pin', '==', pin))
      const snap = await getDocs(q)
      let found = null
      snap.forEach(d => {
        const data = d.data()
        if (data.status !== 'ended') found = data
      })
      if (!found) { toast.error('Aucune salle trouvée'); setLoading(false); return }

      const info = {
        teamMode: found.teamMode === true,
        enabledTeams: Array.isArray(found.enabledTeams) ? found.enabledTeams : [],
        teamNames: found.teamNames || {},
      }
      console.log('Session found, teamMode:', info.teamMode, 'teams:', info.enabledTeams)
      setSessionInfo(info)
      setStep('profile')
    } catch (e) {
      console.error('PIN check error:', e)
      toast.error('Erreur: ' + e.message)
    }
    setLoading(false)
  }

  const handleJoin = async () => {
    if (!name.trim()) return toast.error('Entrez un pseudo !')
    // If team mode, go to team selection step first
    if (sessionInfo?.teamMode && sessionInfo.enabledTeams.length > 0 && !teamId) {
      setStep('team')
      return
    }
    doJoin()
  }

  const doJoin = async () => {
    setLoading(true)
    try {
      await joinSession(pin, name.trim(), avatar, teamId)
      sfx.join()
      onNavigate('player-game')
    } catch (e) {
      toast.error(e.message)
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-5">
      <div className="w-full max-w-[400px]">
        <Btn variant="ghost" size="sm" onClick={() => {
          if (step === 'team') setStep('profile')
          else if (step === 'profile') setStep('pin')
          else onNavigate('landing')
        }} className="mb-6">
          ← Retour
        </Btn>

        {/* STEP 1: PIN */}
        {step === 'pin' && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center">
            <div className="text-5xl mb-4">📱</div>
            <h2 className="text-2xl font-extrabold mb-2">Rejoindre une partie</h2>
            <p className="text-slate-400 mb-8">Entrez le code PIN affiché sur l'écran</p>
            <input
              type="text" inputMode="numeric" maxLength={6}
              value={pin}
              onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
              placeholder="000000"
              className="w-full text-center text-4xl font-black font-mono tracking-[10px] bg-white/5 border border-dark-500 rounded-2xl p-4 text-brand outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 mb-4"
            />
            <Btn onClick={handleCheckPIN} disabled={pin.length !== 6 || loading} className="w-full">
              {loading ? '⏳...' : 'Continuer'}
            </Btn>
          </motion.div>
        )}

        {/* STEP 2: PROFILE (pseudo + avatar) */}
        {step === 'profile' && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center">
            <h2 className="text-2xl font-extrabold mb-4">Choisissez votre pseudo</h2>
            <input
              type="text" maxLength={20}
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Votre pseudo..."
              className="w-full text-center text-xl bg-white/5 border border-dark-500 rounded-2xl p-4 text-white outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 mb-4"
            />
            {/* Avatar preview */}
            <motion.div key={avatar} initial={{ scale: 0.8 }} animate={{ scale: 1 }} transition={{ type: 'spring', damping: 10 }}
              className="w-24 h-24 mx-auto rounded-2xl flex items-center justify-center text-5xl mb-3"
              style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(236,72,153,0.2))', border: '2px solid rgba(99,102,241,0.3)' }}>
              {avatar}
            </motion.div>
            <div className="mb-5">
              <div className="text-slate-400 text-sm mb-2">Choisissez votre avatar</div>
              <div className="max-h-[220px] overflow-y-auto rounded-xl px-1">
                {Object.entries(AVATAR_CATEGORIES).map(([cat, emojis]) => (
                  <div key={cat} className="mb-3">
                    <div className="text-xs text-slate-500 font-semibold mb-1.5">{cat}</div>
                    <div className="flex flex-wrap gap-1.5 justify-center">
                      {emojis.map((a, i) => (
                        <motion.button key={`${cat}-${i}`} whileTap={{ scale: 0.9 }} onClick={() => setAvatar(a)}
                          className={`w-11 h-11 rounded-xl text-xl flex items-center justify-center transition-all ${avatar === a ? 'bg-brand/20 border-2 border-brand scale-110 shadow-lg shadow-brand/20' : 'bg-white/5 border-2 border-transparent hover:bg-white/10'}`}
                        >{a}</motion.button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <Btn onClick={handleJoin} disabled={!name.trim() || loading} className="w-full">
              <span className="text-xl">{avatar}</span> {loading ? 'Connexion...' : sessionInfo?.teamMode ? 'Choisir mon équipe →' : 'Rejoindre !'}
            </Btn>
          </motion.div>
        )}

        {/* STEP 3: TEAM SELECTION */}
        {step === 'team' && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center">
            <div className="text-4xl mb-3">👥</div>
            <h2 className="text-2xl font-extrabold mb-2">Choisissez votre équipe</h2>
            <p className="text-slate-400 mb-6">{name} {avatar}</p>
            <div className="flex flex-col gap-3 mb-6">
              {(sessionInfo?.enabledTeams || []).map(tid => {
                const tc = TEAM_COLORS.find(t => t.id === tid)
                if (!tc) return null
                const selected = teamId === tid
                return (
                  <motion.button key={tid} whileTap={{ scale: 0.97 }} onClick={() => setTeamId(tid)}
                    className="w-full p-5 rounded-2xl font-bold text-xl flex items-center justify-center gap-3 transition-all border-3"
                    style={{
                      background: selected ? tc.color + '30' : tc.bg,
                      borderColor: selected ? tc.color : tc.color + '30',
                      borderWidth: selected ? 3 : 2,
                      color: tc.color,
                      transform: selected ? 'scale(1.03)' : 'scale(1)',
                    }}
                  >
                    <span className="text-3xl">{tc.emoji}</span> {sessionInfo?.teamNames?.[tid] || tc.name}
                    {selected && <span className="text-lg">✓</span>}
                  </motion.button>
                )
              })}
            </div>
            <Btn onClick={doJoin} disabled={!teamId || loading} className="w-full">
              {loading ? '⏳ Connexion...' : '🚀 Rejoindre !'}
            </Btn>
          </motion.div>
        )}
      </div>
    </div>
  )
}
