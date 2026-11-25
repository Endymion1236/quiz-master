import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '../hooks/useSession'
import { SOUNDBOARD_SOUNDS } from '../lib/sounds'

const SOUNDS = [
  { id: 'applause', emoji: '👏', label: 'Applaudissements', mp3: 'applause' },
  { id: 'drumroll', emoji: '🥁', label: 'Roulement', mp3: 'drumroll' },
  { id: 'fail', emoji: '😵', label: 'Fail', mp3: 'fail' },
  { id: 'tada', emoji: '🎉', label: 'Tada !', mp3: 'tada' },
  { id: 'wrongBuzz', emoji: '❌', label: 'Erreur', mp3: 'wrong' },
  { id: 'ticking', emoji: '⏰', label: 'Tic-tac', mp3: 'tick' },
  { id: 'laugh', emoji: '😂', label: 'Rires', mp3: 'laugh' },
  { id: 'wow', emoji: '😮', label: 'Woooow', mp3: 'wow' },
  { id: 'suspense', emoji: '🎬', label: 'Suspense', mp3: 'suspense' },
]

// Try to play MP3 first, fall back to synth
function playSoundEffect(sound) {
  const mp3Path = `/sounds/${sound.mp3}.mp3`
  const audio = new Audio(mp3Path)
  audio.volume = 0.7
  audio.play().catch(() => {
    // MP3 not found or blocked — use synth fallback
    try { SOUNDBOARD_SOUNDS[sound.id]?.() } catch {}
  })
}

export default function Soundboard() {
  const [open, setOpen] = useState(false)
  const [lastPlayed, setLastPlayed] = useState(null)
  const triggerSound = useStore(s => s.triggerSound)

  const playSound = (sound) => {
    playSoundEffect(sound)
    if (triggerSound) triggerSound(sound.id)
    setLastPlayed(sound.id)
    setTimeout(() => setLastPlayed(null), 500)
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            className="mb-3 bg-dark-800/95 backdrop-blur-xl border border-white/10 rounded-2xl p-3 shadow-2xl"
          >
            <div className="text-xs text-slate-500 font-bold text-center mb-2">🔊 SOUNDBOARD</div>
            <div className="grid grid-cols-4 gap-2">
              {SOUNDS.map(s => (
                <motion.button
                  key={s.id}
                  whileTap={{ scale: 0.85 }}
                  animate={lastPlayed === s.id ? { scale: [1, 1.2, 1] } : {}}
                  onClick={() => playSound(s)}
                  className="flex flex-col items-center gap-1 p-2 rounded-xl bg-white/5 hover:bg-white/10 active:bg-white/15 transition-colors border border-white/5"
                >
                  <span className="text-xl">{s.emoji}</span>
                  <span className="text-[10px] text-slate-400 leading-tight">{s.label}</span>
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={() => setOpen(!open)}
        className={`w-12 h-12 rounded-full flex items-center justify-center text-xl shadow-lg border transition-colors ${open ? 'bg-brand border-brand/50 text-dark-900' : 'bg-dark-700 border-white/10 text-white'}`}
      >
        🔊
      </motion.button>
    </div>
  )
}
