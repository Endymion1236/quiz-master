import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CEREMONY_SOUNDS } from '../lib/sounds'

// ==============================
// 🎙️ LIVE COMMENTARY
// Shows contextual messages during the game
// ==============================

const COMMENTARY_MESSAGES = {
  streak3: (name) => [`🔥 ${name} est en feu !`, `3 bonnes réponses d'affilée !`],
  streak5: (name) => [`⚡ INCROYABLE ! ${name}`, `5 bonnes réponses de suite !!`],
  streak7: (name) => [`🌟 INARRÊTABLE ! ${name}`, `7 bonnes réponses consécutives !!!`],
  firstBlood: (name) => [`⚡ Premier sang !`, `${name} ouvre le score !`],
  comeback: (name) => [`📈 Le comeback de ${name} !`, `Remontée spectaculaire !`],
  closeRace: (names) => [`🏁 Au coude à coude !`, `${names[0]} et ${names[1]} : même score !`],
  lastQuestion: () => [`⏰ DERNIÈRE QUESTION !`, `Tout peut encore basculer...`],
  lastThree: () => [`🔔 Plus que 3 questions !`, `La tension monte !`],
  perfectScore: (name) => [`💎 SANS FAUTE !`, `${name} n'a fait aucune erreur !`],
  bigLead: (name, lead) => [`👑 ${name} domine !`, `+${lead} points d'avance !`],
  buzzerSpeed: (name) => [`⚡ ÉCLAIR ! ${name}`, `A buzzé en un temps record !`],
  halfTime: () => [`📊 Mi-temps !`, `On fait le point...`],
  nobodyCorrect: () => [`😱 PERSONNE !`, `Aucune bonne réponse sur celle-là !`],
  everybodyCorrect: () => [`🎉 BRAVO À TOUS !`, `100% de bonnes réponses !`],
}

export function LiveCommentary({ session, players, sorted, qIdx, totalQ, answers, status }) {
  const [commentary, setCommentary] = useState(null)
  const lastCommentRef = useRef('')
  const timeoutRef = useRef(null)

  useEffect(() => {
    if (status !== 'revealing') return

    const q = session?.quiz?.questions?.[qIdx]
    if (!q) return

    // Gather data
    const playerList = Object.values(players || {})
    const scoreboard = session?.scoreboard || {}
    const qAnswers = {}
    Object.values(answers || {}).forEach(a => {
      if (a.questionIndex === qIdx) qAnswers[a.playerId] = a
    })

    // Calculate correct count
    let correctCount = 0
    Object.values(qAnswers).forEach(a => {
      if (a.isCorrect) correctCount++
    })

    const messages = []

    // Streak check
    sorted?.forEach(p => {
      const sb = scoreboard[p.did]
      if (!sb) return
      if (sb.streak >= 7) messages.push({ priority: 10, msg: COMMENTARY_MESSAGES.streak7(p.name) })
      else if (sb.streak >= 5) messages.push({ priority: 9, msg: COMMENTARY_MESSAGES.streak5(p.name) })
      else if (sb.streak >= 3) messages.push({ priority: 5, msg: COMMENTARY_MESSAGES.streak3(p.name) })
    })

    // First blood
    if (qIdx === 0 && sorted?.[0]) {
      const topScore = scoreboard[sorted[0].did]?.score || 0
      if (topScore > 0) messages.push({ priority: 7, msg: COMMENTARY_MESSAGES.firstBlood(sorted[0].name) })
    }

    // Close race (top 2 within 200 pts)
    if (sorted?.length >= 2) {
      const s1 = scoreboard[sorted[0].did]?.score || 0
      const s2 = scoreboard[sorted[1].did]?.score || 0
      if (s1 > 0 && Math.abs(s1 - s2) <= 200) {
        messages.push({ priority: 6, msg: COMMENTARY_MESSAGES.closeRace([sorted[0].name, sorted[1].name]) })
      }
      // Big lead
      if (s1 - s2 >= 2000 && qIdx >= 3) {
        messages.push({ priority: 4, msg: COMMENTARY_MESSAGES.bigLead(sorted[0].name, s1 - s2) })
      }
    }

    // Last question / last 3
    if (qIdx === totalQ - 1) messages.push({ priority: 8, msg: COMMENTARY_MESSAGES.lastQuestion() })
    else if (qIdx === totalQ - 3) messages.push({ priority: 6, msg: COMMENTARY_MESSAGES.lastThree() })

    // Half time
    if (totalQ >= 6 && qIdx === Math.floor(totalQ / 2)) {
      messages.push({ priority: 3, msg: COMMENTARY_MESSAGES.halfTime() })
    }

    // Nobody / everybody correct
    if (playerList.length >= 3) {
      if (correctCount === 0) messages.push({ priority: 7, msg: COMMENTARY_MESSAGES.nobodyCorrect() })
      else if (correctCount === playerList.length) messages.push({ priority: 6, msg: COMMENTARY_MESSAGES.everybodyCorrect() })
    }

    // Pick highest priority message that's different from last
    const sorted_msgs = messages.sort((a, b) => b.priority - a.priority)
    const best = sorted_msgs.find(m => m.msg[0] !== lastCommentRef.current)
    
    if (best) {
      lastCommentRef.current = best.msg[0]
      setCommentary(best.msg)
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      timeoutRef.current = setTimeout(() => setCommentary(null), 4500)
    }

    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current) }
  }, [status, qIdx])

  return (
    <AnimatePresence>
      {commentary && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: 'spring', damping: 20 }}
          className="fixed bottom-0 left-0 right-0 z-50 pointer-events-none"
        >
          <div className="bg-gradient-to-r from-brand/95 via-purple-600/95 to-brand/95 border-t-4 border-amber-400/80 shadow-[0_-4px_30px_rgba(139,92,246,0.5)]">
            <div className="flex items-center h-[4.5rem] overflow-hidden">
              <div className="flex-shrink-0 bg-amber-500 text-black font-black text-lg px-6 h-full flex items-center tracking-wider uppercase gap-2">
                <motion.span animate={{ scale: [1, 1.3, 1] }} transition={{ repeat: Infinity, duration: 1.5 }}>🎙️</motion.span> LIVE
              </div>
              <div className="flex-1 overflow-hidden relative">
                <motion.div
                  key={commentary[0] + commentary[1]}
                  initial={{ x: '100%' }}
                  animate={{ x: '-100%' }}
                  transition={{ duration: 12, ease: 'linear' }}
                  className="whitespace-nowrap font-black"
                  style={{ fontSize: 'clamp(1.5rem, 3vw, 2.2rem)' }}
                >
                  <span className="text-amber-300">{commentary[0]}</span>
                  <span className="mx-6 text-amber-400/60">★</span>
                  <span className="text-white">{commentary[1]}</span>
                  <span className="mx-6 text-amber-400/60">★</span>
                  <span className="text-amber-300">{commentary[0]}</span>
                  <span className="mx-6 text-amber-400/60">★</span>
                  <span className="text-white">{commentary[1]}</span>
                </motion.div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}


// ==============================
// 🏆 OSCARS CEREMONY
// Dramatic winner reveal before showing podium
// ==============================

export function OscarsCeremony({ sorted, players, onComplete }) {
  const [phase, setPhase] = useState(0)
  // Phase 0: Drum roll + "Et le gagnant est..."
  // Phase 1: Envelope opens
  // Phase 2: 3rd place reveal
  // Phase 3: 2nd place reveal
  // Phase 4: WINNER reveal + confetti explosion
  // Phase 5: Done → call onComplete

  const third = sorted?.[2]
  const second = sorted?.[1]
  const winner = sorted?.[0]

  useEffect(() => {
    const timings = [
      2500,  // Phase 0 → 1 (drum roll)
      2000,  // Phase 1 → 2 (envelope)
      3000,  // Phase 2 → 3 (3rd place)
      3000,  // Phase 3 → 4 (2nd place)
      4000,  // Phase 4 → 5 (winner celebration)
    ]

    // Play sounds for each phase — try MP3 first, fall back to synth
    const tryMP3 = (name, fallback) => {
      const audio = new Audio(`/sounds/${name}.mp3`)
      audio.volume = 0.7
      audio.play().catch(() => { try { fallback?.() } catch {} })
    }
    if (phase === 0) tryMP3('drumroll', CEREMONY_SOUNDS.drumroll)
    if (phase === 1) try { CEREMONY_SOUNDS.envelope() } catch {}
    if (phase === 2 || phase === 3) try { CEREMONY_SOUNDS.placeReveal() } catch {}
    if (phase === 4) tryMP3('winner', CEREMONY_SOUNDS.winnerReveal)

    if (phase < 5) {
      const t = setTimeout(() => setPhase(p => p + 1), timings[phase])
      return () => clearTimeout(t)
    } else {
      const t = setTimeout(onComplete, 1000)
      return () => clearTimeout(t)
    }
  }, [phase])

  return (
    <div className="fixed inset-0 z-50 bg-black flex items-center justify-center overflow-hidden">
      {/* Dramatic background */}
      <motion.div
        animate={{ opacity: [0.1, 0.3, 0.1] }}
        transition={{ duration: 2, repeat: Infinity }}
        className="absolute inset-0"
        style={{ background: 'radial-gradient(circle at 50% 30%, rgba(245,158,11,0.15), transparent 70%)' }}
      />

      {/* Spotlight beams */}
      {phase >= 1 && [0,1,2].map(i => (
        <motion.div key={i}
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.2, 0], rotate: [-15 + i*15, -5 + i*15] }}
          transition={{ duration: 3, delay: i * 0.3, repeat: Infinity }}
          className="absolute pointer-events-none"
          style={{
            top: '-20%', left: `${25 + i * 25}%`, width: '4px', height: '150%',
            background: `linear-gradient(180deg, rgba(245,158,11,0.5), transparent)`,
            filter: 'blur(20px)', transformOrigin: 'top center',
          }}
        />
      ))}

      <AnimatePresence mode="wait">
        {/* Phase 0: Drum roll */}
        {phase === 0 && (
          <motion.div key="drumroll" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="text-center">
            <motion.div
              animate={{ scale: [1, 1.1, 1], rotate: [0, 2, -2, 0] }}
              transition={{ duration: 0.5, repeat: Infinity }}
              className="text-8xl mb-6"
            >🥁</motion.div>
            <motion.div
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1, repeat: Infinity }}
              className="text-3xl font-black text-amber-400 tracking-wider"
            >
              ROULEMENT DE TAMBOUR...
            </motion.div>
          </motion.div>
        )}

        {/* Phase 1: Envelope */}
        {phase === 1 && (
          <motion.div key="envelope" initial={{ scale: 0, rotate: -10 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0.5, opacity: 0 }}
            transition={{ type: 'spring', damping: 8 }}
            className="text-center">
            <motion.div
              animate={{ y: [0, -15, 0] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="text-[120px] mb-4"
            >✉️</motion.div>
            <div className="text-4xl font-black text-white">Et les résultats sont...</div>
          </motion.div>
        )}

        {/* Phase 2: 3rd place */}
        {phase === 2 && third && (
          <motion.div key="third" initial={{ x: 300, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -300, opacity: 0 }}
            transition={{ type: 'spring', damping: 12 }}
            className="text-center">
            <div className="text-2xl text-amber-600 font-bold mb-4 tracking-widest">🥉 3ÈME PLACE</div>
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.3, type: 'spring' }}
              className="text-8xl mb-4">{third.avatar}</motion.div>
            <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.5 }}>
              <div className="text-4xl font-black text-white mb-2">{third.name}</div>
              <div className="text-2xl text-amber-600 font-bold font-mono">{third.score?.toLocaleString()} pts</div>
            </motion.div>
          </motion.div>
        )}

        {/* Phase 3: 2nd place */}
        {phase === 3 && second && (
          <motion.div key="second" initial={{ x: 300, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -300, opacity: 0 }}
            transition={{ type: 'spring', damping: 12 }}
            className="text-center">
            <div className="text-2xl text-slate-300 font-bold mb-4 tracking-widest">🥈 2ÈME PLACE</div>
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.3, type: 'spring' }}
              className="text-8xl mb-4">{second.avatar}</motion.div>
            <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.5 }}>
              <div className="text-4xl font-black text-white mb-2">{second.name}</div>
              <div className="text-2xl text-slate-300 font-bold font-mono">{second.score?.toLocaleString()} pts</div>
            </motion.div>
          </motion.div>
        )}

        {/* Phase 4: WINNER */}
        {phase >= 4 && winner && (
          <motion.div key="winner" initial={{ scale: 0 }} animate={{ scale: 1 }}
            transition={{ type: 'spring', damping: 6, stiffness: 100 }}
            className="text-center relative">
            
            {/* Gold particle burst */}
            {Array.from({ length: 30 }).map((_, i) => (
              <motion.div key={i}
                initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                animate={{
                  x: (Math.random() - 0.5) * 600,
                  y: (Math.random() - 0.5) * 600,
                  opacity: 0,
                  scale: 0,
                }}
                transition={{ duration: 2 + Math.random(), delay: Math.random() * 0.5 }}
                className="absolute left-1/2 top-1/2 w-3 h-3 rounded-full pointer-events-none"
                style={{ background: ['#f59e0b', '#fbbf24', '#d97706', '#fcd34d', '#ef4444', '#8b5cf6'][i % 6] }}
              />
            ))}

            <motion.div animate={{ scale: [1, 1.15, 1] }} transition={{ duration: 1, repeat: Infinity }}
              className="text-6xl mb-2">👑</motion.div>
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.3, type: 'spring' }}
              className="text-[140px] mb-4 drop-shadow-[0_0_60px_rgba(245,158,11,0.5)]">{winner.avatar}</motion.div>
            <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.5 }}>
              <div className="text-6xl font-black bg-gradient-to-r from-yellow-300 via-amber-400 to-yellow-500 bg-clip-text text-transparent mb-3">
                {winner.name}
              </div>
              <div className="text-3xl text-amber-400 font-bold font-mono mb-2">{winner.score?.toLocaleString()} pts</div>
              <motion.div
                animate={{ opacity: [0, 1, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="text-2xl text-amber-300 font-bold mt-4"
              >🏆 CHAMPION 🏆</motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}


// ==============================
// 🎵 DYNAMIC MUSIC CONTEXT
// Returns the appropriate mood for current game state
// ==============================

export function useDynamicMusicMood({ session, qIdx, totalQ, sorted, status }) {
  const [mood, setMood] = useState('normal')

  useEffect(() => {
    if (!session) return

    const scoreboard = session.scoreboard || {}

    // Last question
    if (qIdx === totalQ - 1 && (status === 'running' || status === 'countdown')) {
      setMood('final')
      return
    }

    // Last 3 questions
    if (qIdx >= totalQ - 3 && (status === 'running' || status === 'countdown')) {
      setMood('tense')
      return
    }

    // Close race (top 2 within 500 pts and past half)
    if (sorted?.length >= 2 && qIdx >= Math.floor(totalQ / 2)) {
      const s1 = scoreboard[sorted[0].did]?.score || 0
      const s2 = scoreboard[sorted[1].did]?.score || 0
      if (s1 > 0 && Math.abs(s1 - s2) <= 500) {
        setMood('tense')
        return
      }
    }

    // Revealing
    if (status === 'revealing' || status === 'scoreboard') {
      setMood('reveal')
      return
    }

    setMood('normal')
  }, [qIdx, status, sorted?.length])

  return mood
}
