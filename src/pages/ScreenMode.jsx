import React, { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { QRCodeSVG } from 'qrcode.react'
import { TimerBar, Scoreboard, Podium, Confetti, TeamScoreboard, TeamPodium, MediaPlayer, AliveCounter } from '../components/UI'
import Countdown from '../components/Countdown'
import BonusWheel from '../components/BonusWheel'
import TVIntro from '../components/TVIntro'
import TVTransition from '../components/TVTransition'
import { ReactionOverlay, useReactions } from '../components/Reactions'
import ScoreChart from '../components/ScoreChart'
import { LiveCommentary, OscarsCeremony, useDynamicMusicMood } from '../components/TVCommentary'
import { SOUNDBOARD_SOUNDS } from '../lib/sounds'
import { useStore } from '../hooks/useSession'
import { useTimer } from '../hooks/useTimer'
import { CHOICE_COLORS, CHOICE_SHAPES, QUESTION_TYPES, TEAM_COLORS, getTeamName } from '../lib/constants'

export default function ScreenMode() {
  const { session, players, answers, getSorted, getAnswerCount, getTeamScores, getAliveCount, sessionId, listen } = useStore()
  const [audioUnlocked, setAudioUnlocked] = useState(false)
  const [introPlayed, setIntroPlayed] = useState(false)
  const [showIntro, setShowIntro] = useState(false)
  const prevStatusRef = useRef(null)
  const { reactions, addReaction } = useReactions()

  // Detect lobby → first question transition to show intro
  const lobbyMusicStopRef = useRef(null)
  useEffect(() => {
    const prevStatus = prevStatusRef.current
    const curStatus = session?.status
    if (prevStatus === 'lobby' && curStatus && curStatus !== 'lobby' && !introPlayed) {
      // Stop lobby music when quiz starts
      if (lobbyMusicStopRef.current) { lobbyMusicStopRef.current(); lobbyMusicStopRef.current = null }
      setShowIntro(true)
      setIntroPlayed(true)
    }
    prevStatusRef.current = curStatus
  }, [session?.status])

  // Lobby music — play lobby.mp3 in loop when in lobby with audio unlocked
  useEffect(() => {
    if (session?.status === 'lobby' && audioUnlocked) {
      // Try to play lobby.mp3 in loop
      try {
        const audio = new Audio('/sounds/lobby.mp3')
        audio.volume = 0.4
        audio.loop = true
        audio.play().then(() => {
          lobbyMusicStopRef.current = () => { audio.pause(); audio.currentTime = 0 }
        }).catch(() => {})
      } catch {}
    }
    return () => {
      if (lobbyMusicStopRef.current) { lobbyMusicStopRef.current(); lobbyMusicStopRef.current = null }
    }
  }, [session?.status, audioUnlocked])

  // Auto-connect: if opened as separate window with ?screen=1&sid=xxx
  useEffect(() => {
    if (session) return // Already connected
    // Try to get sessionId from URL params
    const params = new URLSearchParams(window.location.search)
    const sid = params.get('sid')
    if (sid) {
      useStore.setState({ sessionId: sid, role: 'screen' })
      listen(sid)
    }
  }, [])

  // Also store sessionId in localStorage so screen window can find it
  useEffect(() => {
    if (sessionId) {
      localStorage.setItem('qm_current_session', sessionId)
    }
  }, [sessionId])

  // If no session from URL, try localStorage
  useEffect(() => {
    if (session) return
    const params = new URLSearchParams(window.location.search)
    if (params.get('screen') === '1' && !params.get('sid')) {
      const stored = localStorage.getItem('qm_current_session')
      if (stored) {
        useStore.setState({ sessionId: stored, role: 'screen' })
        listen(stored)
      }
    }
  }, [])

  const qIdx = session?.currentQuestionIndex ?? -1
  const quiz = session?.quiz
  const q = qIdx >= 0 ? quiz?.questions[qIdx] : null
  const status = session?.status
  const playerList = Object.values(players)
  const playerMap = players // players is already { id: data }
  const sorted = getSorted()

  // Oscars ceremony before podium
  const [showOscars, setShowOscars] = useState(false)
  const oscarsShownRef = useRef(false)
  useEffect(() => {
    if (status === 'ended' && !oscarsShownRef.current && sorted.length >= 1) {
      oscarsShownRef.current = true
      setShowOscars(true)
    }
  }, [status, sorted.length])

  // Dynamic music mood
  const musicMood = useDynamicMusicMood({ session, qIdx, totalQ: quiz?.questions?.length || 0, sorted, status })

  // TV Transition between questions
  const [showTransition, setShowTransition] = useState(false)
  const prevQIdxRef = React.useRef(-1)
  useEffect(() => {
    if (status === 'countdown' && qIdx > 0 && qIdx !== prevQIdxRef.current) {
      setShowTransition(true)
    }
    prevQIdxRef.current = qIdx
  }, [qIdx, status])

  const timer = useTimer(session?.questionStartTimestamp, q?.timerSeconds, status === 'running')

  // Listen for live reactions (only if enabled)
  const lastReactionRef = React.useRef(null)
  useEffect(() => {
    if (session?.settings?.enableReactions === false) return
    if (session?.lastReaction && session.lastReaction.id !== lastReactionRef.current) {
      lastReactionRef.current = session.lastReaction.id
      addReaction(session.lastReaction.emoji)
    }
  }, [session?.lastReaction])

  // Listen for soundboard triggers from Host
  const SOUNDBOARD_MP3_MAP = { applause: 'applause', drumroll: 'drumroll', fail: 'fail', tada: 'tada', wrongBuzz: 'wrong', ticking: 'tick', laugh: 'laugh', wow: 'wow', suspense: 'suspense' }
  const lastSoundRef = React.useRef(null)
  useEffect(() => {
    if (session?.soundTrigger && session.soundTrigger.ts !== lastSoundRef.current) {
      lastSoundRef.current = session.soundTrigger.ts
      const soundId = session.soundTrigger.id
      const mp3Name = SOUNDBOARD_MP3_MAP[soundId] || soundId
      // Try MP3 first
      const audio = new Audio(`/sounds/${mp3Name}.mp3`)
      audio.volume = 0.8
      audio.play().catch(() => {
        // Fallback to synth
        try { SOUNDBOARD_SOUNDS[soundId]?.() } catch {}
      })
    }
  }, [session?.soundTrigger])

  if (!session) {
    return (
      <div className="screen-bg min-h-screen flex flex-col items-center justify-center tv-safe">
        <motion.div animate={{ scale: [1, 1.05, 1] }} transition={{ repeat: Infinity, duration: 2 }} className="text-6xl mb-6">📺</motion.div>
        <h1 className="text-3xl font-black text-brand mb-4">Quiz Master</h1>
        <p className="text-slate-400 text-lg">En attente de connexion à une session...</p>
        <p className="text-slate-500 text-sm mt-4">Lancez une partie depuis la console Host</p>
      </div>
    )
  }

  // === LOBBY ===
  if (status === 'lobby') {
    return (
      <div className="screen-bg-lobby min-h-screen flex flex-col items-center pt-[3vh] tv-safe">
        {/* Audio unlock overlay — must be clicked once per screen to allow autoplay */}
        {!audioUnlocked && (
          <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center cursor-pointer"
            onClick={() => {
              setAudioUnlocked(true)
              // Create + resume AudioContext (unlocks Web Audio)
              try {
                const ctx = new (window.AudioContext || window.webkitAudioContext)()
                ctx.resume()
                // Play a silent sound to fully unlock audio policy
                const osc = ctx.createOscillator()
                const gain = ctx.createGain()
                gain.gain.value = 0
                osc.connect(gain)
                gain.connect(ctx.destination)
                osc.start()
                osc.stop(ctx.currentTime + 0.01)
              } catch(e){}
            }}
          >
            <motion.div initial={{ scale: 0.8 }} animate={{ scale: [1, 1.05, 1] }} transition={{ repeat: Infinity, duration: 2 }} className="text-center">
              <div className="text-7xl mb-6">🔊</div>
              <div className="text-3xl font-black text-white mb-3">Cliquez ici pour activer le son</div>
              <div className="text-lg text-slate-400">Obligatoire pour que la musique démarre automatiquement</div>
              <div className="mt-6 inline-block bg-brand/20 border-2 border-brand text-brand font-bold px-8 py-3 rounded-2xl text-lg">
                👆 Cliquer
              </div>
            </motion.div>
          </div>
        )}

        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-6">
          <img src="/images/logo.png" alt="Quiz Master" className="w-20 h-20 mx-auto mb-2 object-contain drop-shadow-lg"
            onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block' }} />
          <div className="text-4xl mb-2 hidden">🎪</div>
          <h1 className="text-[clamp(1.5rem,4vw,3rem)] font-black text-brand mb-1 drop-shadow-lg">Quiz Master</h1>
          <p className="text-[clamp(0.8rem,2vw,1.2rem)] text-slate-400">{quiz.title}</p>
          {session.quizNumber > 1 && (
            <p className="text-brand font-bold mt-1 text-sm">🌙 Soirée — Quiz n°{session.quizNumber}</p>
          )}
        </motion.div>
        <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }} className="text-center mb-6">
          <div className="text-slate-300 text-base uppercase tracking-[6px] mb-3 drop-shadow-md">Rejoignez avec le code</div>
          <div className="flex items-center justify-center gap-6">
            <div className="bg-dark-700/80 backdrop-blur-sm rounded-2xl px-8 py-4 border-2 border-brand/30">
              <div className="text-[clamp(2.5rem,6vw,5rem)] font-black font-mono tracking-[12px] text-brand drop-shadow-lg">
                {session.pin}
              </div>
            </div>
            <motion.div
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.5, type: 'spring' }}
              className="bg-white rounded-xl p-3 shadow-xl"
            >
              <QRCodeSVG
                value={`${window.location.origin}?pin=${session.pin}`}
                size={120}
                bgColor="#ffffff"
                fgColor="#0f172a"
                level="M"
              />
              <div className="text-dark-900 text-[10px] font-bold text-center mt-1">Scanner pour jouer</div>
            </motion.div>
          </div>
        </motion.div>
        <div className="text-center">
          <div className="text-slate-400 text-sm mb-3">
            {playerList.length === 0 ? 'En attente de joueurs...' : `${playerList.length} joueur${playerList.length > 1 ? 's' : ''} connecté${playerList.length > 1 ? 's' : ''}`}
          </div>
          <div className="flex flex-wrap gap-2 justify-center max-w-[900px]">
            {playerList.map((p, i) => (
              <motion.div key={p.playerId} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: i * 0.08, type: 'spring' }}
                className="bg-white/10 backdrop-blur-sm rounded-xl px-3 py-2 flex items-center gap-2 border border-white/10 shadow-lg"
              >
                <span className="text-lg">{p.avatar}</span>
                <span className="font-bold text-sm">{p.name}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // === TV INTRO (plays once on game start) ===
  if (showIntro) {
    return (
      <TVIntro
        quizTitle={session?.quiz?.title}
        onComplete={() => setShowIntro(false)}
      />
    )
  }

  // === PREDICTION PHASE ===
  if (status === 'prediction') {
    const predictions = session.predictions || {}
    const totalQ = session.quiz?.questions?.length || 0
    return (
      <div className="screen-bg-lobby min-h-screen flex flex-col items-center justify-center tv-safe">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring' }}>
          <div className="text-[clamp(4rem,8vw,7rem)] mb-4 text-center">🎯</div>
        </motion.div>
        <h1 className="text-[clamp(2rem,5vw,4rem)] font-black text-amber-400 mb-2">Je te mets combien ?</h1>
        <p className="text-[clamp(1rem,2vw,1.5rem)] text-slate-400 mb-8">
          {totalQ} questions — Faites votre prédiction !
        </p>
        <div className="text-[clamp(1.5rem,3vw,2.5rem)] font-bold text-brand mb-8">
          {Object.keys(predictions).length} / {playerList.length} prédictions
        </div>
        <div className="flex flex-wrap gap-4 justify-center max-w-[800px]">
          {playerList.map((p, i) => {
            const pred = predictions[p.playerId]
            return (
              <motion.div key={p.playerId} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: i * 0.05, type: 'spring' }}
                className={`rounded-2xl px-5 py-3 flex items-center gap-3 border ${pred !== undefined ? 'bg-amber-500/10 border-amber-500/30' : 'bg-white/5 border-white/10'}`}>
                <span className="text-2xl">{p.avatar}</span>
                <span className="font-bold text-lg">{p.name}</span>
                {pred !== undefined ? (
                  <span className="text-amber-400 font-black text-xl ml-2">→ {pred}</span>
                ) : (
                  <span className="text-slate-500 text-sm ml-2">🤔</span>
                )}
              </motion.div>
            )
          })}
        </div>
      </div>
    )
  }

  // === ENDED ===
  if (status === 'ended') {
    const teamScores = session.teamMode ? getTeamScores() : []
    const top3 = sorted.slice(0, 3)
    const winner = top3[0]
    const second = top3[1]
    const third = top3[2]

    // Show Oscars ceremony first
    if (showOscars) {
      return <OscarsCeremony sorted={sorted} players={players} onComplete={() => setShowOscars(false)} />
    }

    return (
      <div className="screen-bg-podium min-h-screen flex flex-col items-center justify-center tv-safe relative overflow-hidden">
        <Confetti show />

        {/* Animated spotlight beams */}
        {[0,1,2,3,4].map(i => (
          <motion.div key={`sp-${i}`}
            animate={{ opacity: [0, 0.15, 0], rotate: [-20 + i*10, -10 + i*10, -20 + i*10] }}
            transition={{ duration: 4, delay: i * 0.5, repeat: Infinity }}
            className="absolute pointer-events-none"
            style={{
              top: '-20%', left: `${10 + i * 20}%`, width: '6px', height: '140%',
              background: `linear-gradient(180deg, ${['rgba(99,102,241,0.6)','rgba(236,72,153,0.5)','rgba(245,158,11,0.6)','rgba(6,182,212,0.5)','rgba(99,102,241,0.4)'][i]}, transparent)`,
              filter: 'blur(25px)', transformOrigin: 'top center',
            }}
          />
        ))}

        {/* Pulsing glow behind podium */}
        <motion.div
          animate={{ scale: [1, 1.3, 1], opacity: [0.2, 0.4, 0.2] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="absolute w-[600px] h-[600px] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(245,158,11,0.15), transparent 70%)', filter: 'blur(60px)' }}
        />

        {/* Trophy + Title */}
        <motion.div initial={{ scale: 0, y: -50 }} animate={{ scale: 1, y: 0 }} transition={{ type: 'spring', damping: 8, delay: 0.2 }}
          className="relative z-10 text-center mb-8">
          <motion.div animate={{ y: [0, -10, 0] }} transition={{ duration: 2, repeat: Infinity }}
            className="text-[clamp(5rem,10vw,8rem)] drop-shadow-[0_0_40px_rgba(245,158,11,0.5)]">🏆</motion.div>
          <h1 className="text-[clamp(2rem,5vw,4rem)] font-black bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-500 bg-clip-text text-transparent drop-shadow-lg">
            Résultats finaux
          </h1>
        </motion.div>

        {/* Podium blocks — 2nd | 1st | 3rd */}
        <div className="relative z-10 flex items-end justify-center gap-4 mb-8">
          {/* 2nd place */}
          {second && (
            <motion.div initial={{ y: 200, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 1.2, type: 'spring', damping: 12 }}
              className="text-center">
              <motion.div animate={{ y: [0, -5, 0] }} transition={{ duration: 3, repeat: Infinity, delay: 0.5 }}>
                <div className="text-[clamp(3rem,6vw,5rem)] mb-2">{second.avatar}</div>
                <div className="text-[clamp(1rem,2vw,1.5rem)] font-bold text-slate-200 mb-1">{second.name}</div>
                <div className="text-[clamp(0.8rem,1.5vw,1.1rem)] text-slate-400 font-mono">{second.score?.toLocaleString()} pts</div>
              </motion.div>
              <div className="w-[clamp(100px,15vw,160px)] h-[clamp(80px,12vw,120px)] mt-3 rounded-t-xl flex items-center justify-center"
                style={{ background: 'linear-gradient(180deg, rgba(192,192,192,0.3), rgba(192,192,192,0.1))', border: '2px solid rgba(192,192,192,0.3)' }}>
                <span className="text-[clamp(2rem,4vw,3.5rem)] font-black text-slate-400">2</span>
              </div>
            </motion.div>
          )}

          {/* 1st place (tallest) */}
          {winner && (
            <motion.div initial={{ y: 200, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 1.6, type: 'spring', damping: 12 }}
              className="text-center">
              <motion.div animate={{ y: [0, -8, 0], scale: [1, 1.02, 1] }} transition={{ duration: 2.5, repeat: Infinity }}>
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 2, type: 'spring' }}
                  className="text-3xl mb-1">👑</motion.div>
                <div className="text-[clamp(4rem,8vw,7rem)] mb-2 drop-shadow-[0_0_20px_rgba(245,158,11,0.4)]">{winner.avatar}</div>
                <div className="text-[clamp(1.2rem,2.5vw,2rem)] font-black text-white mb-1">{winner.name}</div>
                <div className="text-[clamp(1rem,2vw,1.3rem)] text-amber-400 font-bold font-mono">{winner.score?.toLocaleString()} pts</div>
              </motion.div>
              <div className="w-[clamp(120px,18vw,200px)] h-[clamp(120px,18vw,180px)] mt-3 rounded-t-xl flex items-center justify-center"
                style={{ background: 'linear-gradient(180deg, rgba(245,158,11,0.3), rgba(245,158,11,0.1))', border: '2px solid rgba(245,158,11,0.4)' }}>
                <span className="text-[clamp(3rem,5vw,4.5rem)] font-black text-amber-400">1</span>
              </div>
            </motion.div>
          )}

          {/* 3rd place */}
          {third && (
            <motion.div initial={{ y: 200, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.8, type: 'spring', damping: 12 }}
              className="text-center">
              <motion.div animate={{ y: [0, -4, 0] }} transition={{ duration: 3.5, repeat: Infinity, delay: 1 }}>
                <div className="text-[clamp(2.5rem,5vw,4rem)] mb-2">{third.avatar}</div>
                <div className="text-[clamp(0.9rem,1.8vw,1.3rem)] font-bold text-slate-300 mb-1">{third.name}</div>
                <div className="text-[clamp(0.7rem,1.3vw,1rem)] text-slate-400 font-mono">{third.score?.toLocaleString()} pts</div>
              </motion.div>
              <div className="w-[clamp(90px,13vw,140px)] h-[clamp(60px,9vw,90px)] mt-3 rounded-t-xl flex items-center justify-center"
                style={{ background: 'linear-gradient(180deg, rgba(205,127,50,0.3), rgba(205,127,50,0.1))', border: '2px solid rgba(205,127,50,0.3)' }}>
                <span className="text-[clamp(1.5rem,3vw,2.5rem)] font-black text-amber-600">3</span>
              </div>
            </motion.div>
          )}
        </div>

        {/* Team scores if applicable */}
        {session.teamMode && teamScores.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 2.5 }}
            className="relative z-10 max-w-[600px] w-full">
            <TeamPodium teams={teamScores} />
          </motion.div>
        )}

        {/* Remaining players */}
        {sorted.length > 3 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 3 }}
            className="relative z-10 mt-4 flex flex-wrap gap-3 justify-center max-w-[800px]">
            {sorted.slice(3, 10).map((p, i) => (
              <div key={p.did} className="bg-white/5 rounded-xl px-4 py-2 flex items-center gap-2 border border-white/10">
                <span className="text-slate-500 font-bold text-sm">#{i + 4}</span>
                <span className="text-lg">{p.avatar}</span>
                <span className="font-semibold text-sm">{p.name}</span>
                <span className="text-slate-500 text-xs font-mono">{p.score?.toLocaleString()}</span>
              </div>
            ))}
          </motion.div>
        )}

        {/* Score evolution chart */}
        {session.scoreHistory && Object.keys(session.scoreHistory).length > 0 && (
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 3.2 }}
            className="relative z-10 mt-6 max-w-[800px] w-full">
            <ScoreChart scoreHistory={session.scoreHistory} players={players} />
          </motion.div>
        )}

        {/* Prediction results — "Je te mets combien ?" */}
        {session.predictionResults && Object.keys(session.predictionResults).length > 0 && (
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 3.5 }}
            className="relative z-10 mt-6 max-w-[700px] w-full">
            <div className="text-center mb-3">
              <span className="text-amber-400 font-bold text-lg">🎯 Je te mets combien ?</span>
            </div>
            <div className="flex flex-wrap gap-3 justify-center">
              {Object.entries(session.predictionResults).map(([pid, r]) => (
                <motion.div key={pid} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring' }}
                  className="bg-white/5 rounded-xl px-4 py-3 border border-amber-500/20 text-center min-w-[140px]">
                  <div className="flex items-center gap-2 justify-center mb-1">
                    <span className="text-lg">{players[pid]?.avatar}</span>
                    <span className="font-bold text-sm">{players[pid]?.name}</span>
                  </div>
                  <div className="text-sm text-slate-400">
                    Prédit <span className="text-amber-400 font-bold">{r.predicted}</span> — Réel <span className="text-brand font-bold">{r.actual}</span>
                  </div>
                  <div className="text-xs mt-1">
                    <span>{r.label}</span>
                    {r.bonus > 0 && <span className="text-emerald-400 font-bold ml-1">+{r.bonus.toLocaleString()}</span>}
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* 🏅 Honors — Titres honorifiques */}
        {session.honors && Object.keys(session.honors).length > 0 && (
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 4 }}
            className="relative z-10 mt-8 max-w-[800px] w-full">
            <div className="text-center mb-4">
              <span className="text-[clamp(1.2rem,2.5vw,1.8rem)] font-black text-amber-400">🏅 Titres Honorifiques</span>
            </div>
            <div className="flex flex-wrap gap-3 justify-center">
              {Object.entries(session.honors).map(([pid, h], i) => (
                <motion.div key={pid}
                  initial={{ scale: 0, rotate: -10 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ delay: 4.3 + i * 0.15, type: 'spring', damping: 12 }}
                  className="bg-gradient-to-br from-amber-500/10 to-purple-500/10 rounded-2xl px-5 py-4 border border-amber-500/20 text-center min-w-[160px]">
                  <div className="text-3xl mb-1">{h.icon}</div>
                  <div className="flex items-center gap-2 justify-center mb-1">
                    <span className="text-lg">{players[pid]?.avatar}</span>
                    <span className="font-bold">{players[pid]?.name}</span>
                  </div>
                  <div className="font-black text-amber-400 text-sm">{h.title}</div>
                  <div className="text-xs text-slate-400 mt-0.5">{h.desc}</div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* 📊 ELO Rating Changes */}
        {session.eloChanges && Object.keys(session.eloChanges).length > 0 && (
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 4.5 }}
            className="relative z-10 mt-8 max-w-[800px] w-full">
            <div className="text-center mb-4">
              <span className="text-[clamp(1.2rem,2.5vw,1.8rem)] font-black text-cyan-400">📊 Classement ELO</span>
            </div>
            <div className="flex flex-wrap gap-3 justify-center">
              {sorted.map((p, i) => {
                const elo = session.eloChanges[p.did]
                if (!elo) return null
                return (
                  <motion.div key={p.did}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 4.8 + i * 0.1, type: 'spring' }}
                    className="bg-white/5 rounded-xl px-4 py-3 border border-cyan-500/20 text-center min-w-[130px]">
                    <div className="flex items-center gap-2 justify-center mb-1">
                      <span className="text-lg">{p.avatar}</span>
                      <span className="font-bold text-sm">{p.name}</span>
                    </div>
                    <div className="text-cyan-400 font-black text-lg font-mono">{elo.newElo}</div>
                    <div className={`text-xs font-bold ${elo.delta >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {elo.delta >= 0 ? '▲' : '▼'} {elo.delta >= 0 ? '+' : ''}{elo.delta}
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </motion.div>
        )}
      </div>
    )
  }

  // === SCOREBOARD ===
  if (status === 'scoreboard') {
    const teamScores = session.teamMode ? getTeamScores() : []

    // Compute live stats
    const stats = (() => {
      const sb = session.scoreboard || {}
      const playerList = Object.entries(players)
      const answerList = Object.values(answers)

      // Best streak (current)
      let bestStreak = { name: '', avatar: '', streak: 0 }
      playerList.forEach(([did, p]) => {
        const s = sb[did]?.streak || 0
        if (s > bestStreak.streak) bestStreak = { name: p.name, avatar: p.avatar, streak: s }
      })

      // Most correct answers
      let mostCorrect = { name: '', avatar: '', correct: 0 }
      playerList.forEach(([did, p]) => {
        const c = sb[did]?.correct || 0
        if (c > mostCorrect.correct) mostCorrect = { name: p.name, avatar: p.avatar, correct: c }
      })

      // Fastest average response
      let fastest = { name: '', avatar: '', avg: Infinity }
      playerList.forEach(([did, p]) => {
        const myAnswers = answerList.filter(a => a.playerId === did && a.timeElapsed)
        if (myAnswers.length > 0) {
          const avg = myAnswers.reduce((sum, a) => sum + a.timeElapsed, 0) / myAnswers.length
          if (avg < fastest.avg) fastest = { name: p.name, avatar: p.avatar, avg: Math.round(avg * 10) / 10 }
        }
      })

      // Highest single score (in revealResults)
      let highScore = { name: '', avatar: '', score: 0, qNum: 0 }
      // Check last reveal
      if (session.revealResults) {
        Object.entries(session.revealResults).forEach(([did, r]) => {
          if (r.score > highScore.score && players[did]) {
            highScore = { name: players[did].name, avatar: players[did].avatar, score: r.score, qNum: (session.currentQuestionIndex || 0) + 1 }
          }
        })
      }

      return { bestStreak, mostCorrect, fastest, highScore }
    })()

    const statCards = [
      stats.bestStreak.streak > 1 && { icon: '🔥', label: 'Meilleure série', value: `${stats.bestStreak.avatar} ${stats.bestStreak.name}`, sub: `${stats.bestStreak.streak} de suite`, color: 'rgba(239,68,68,0.15)', border: 'rgba(239,68,68,0.3)' },
      stats.fastest.avg < Infinity && { icon: '⚡', label: 'Le plus rapide', value: `${stats.fastest.avatar} ${stats.fastest.name}`, sub: `${stats.fastest.avg}s en moyenne`, color: 'rgba(245,158,11,0.15)', border: 'rgba(245,158,11,0.3)' },
      stats.mostCorrect.correct > 0 && { icon: '🧠', label: 'Le plus savant', value: `${stats.mostCorrect.avatar} ${stats.mostCorrect.name}`, sub: `${stats.mostCorrect.correct} bonne${stats.mostCorrect.correct > 1 ? 's' : ''} réponse${stats.mostCorrect.correct > 1 ? 's' : ''}`, color: 'rgba(99,102,241,0.15)', border: 'rgba(99,102,241,0.3)' },
      stats.highScore.score > 0 && { icon: '💎', label: 'Meilleur score (Q' + stats.highScore.qNum + ')', value: `${stats.highScore.avatar} ${stats.highScore.name}`, sub: `${stats.highScore.score.toLocaleString()} pts`, color: 'rgba(16,185,129,0.15)', border: 'rgba(16,185,129,0.3)' },
    ].filter(Boolean)

    return (
      <div className="screen-bg-podium min-h-screen flex flex-col items-center justify-center tv-safe">
        <h2 className="text-[clamp(1.5rem,4vw,3rem)] font-black text-brand mb-6">📊 Classement</h2>
        {session.teamMode && teamScores.length > 0 && (
          <div className="max-w-[700px] w-full mb-6">
            <h3 className="text-xl font-bold text-center mb-4">👥 Équipes</h3>
            <TeamScoreboard teams={teamScores} />
          </div>
        )}
        <div className="w-full max-w-[900px]">
          {session.teamMode && <h3 className="text-lg font-bold text-center mb-4 text-slate-400">Joueurs</h3>}
          {(() => {
            const maxScore = Math.max(...sorted.slice(0, 10).map(p => p.score), 1)
            const podiumColors = ['#f59e0b', '#94a3b8', '#cd7f32']
            return sorted.slice(0, 10).map((p, i) => {
              const pct = Math.max((p.score / maxScore) * 70, 5)
              const barColor = i < 3 ? podiumColors[i] : '#8b5cf6'
              return (
                <motion.div
                  key={p.did}
                  layout
                  transition={{ type: 'spring', damping: 20, stiffness: 120 }}
                  className="flex items-center gap-3 mb-2 h-14"
                >
                  <div className="w-10 text-center flex-shrink-0">
                    {i < 3 ? (
                      <span className="text-2xl">{['🥇','🥈','🥉'][i]}</span>
                    ) : (
                      <span className="font-black text-xl text-slate-500">{i + 1}</span>
                    )}
                  </div>
                  <span className="text-2xl flex-shrink-0">{p.avatar}</span>
                  <span className="font-bold text-lg flex-shrink-0 w-[120px] truncate">{p.name}</span>
                  <div className="flex-1 relative h-10 flex items-center">
                    <motion.div
                      className="rounded-xl h-full absolute left-0 top-0"
                      initial={{ width: '5%' }}
                      animate={{ width: pct + '%' }}
                      transition={{ duration: 1.2, ease: 'easeOut', delay: i * 0.06 }}
                      style={{
                        background: `linear-gradient(90deg, ${barColor}30, ${barColor}80)`,
                        borderLeft: `4px solid ${barColor}`,
                        boxShadow: i < 3 ? `0 0 20px ${barColor}30` : 'none',
                      }}
                    />
                  </div>
                  <motion.span
                    className="font-black text-2xl font-mono flex-shrink-0 min-w-[100px] text-right"
                    style={{ color: barColor }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 + i * 0.06 }}
                  >
                    {p.score.toLocaleString()}
                  </motion.span>
                </motion.div>
              )
            })
          })()}
        </div>

        {/* Live Stats */}
        {statCards.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
            className="flex flex-wrap gap-4 justify-center mt-6 max-w-[900px]">
            {statCards.map((s, i) => (
              <motion.div key={i} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.7 + i * 0.15, type: 'spring' }}
                className="rounded-2xl px-5 py-3 text-center min-w-[180px]"
                style={{ background: s.color, border: `1px solid ${s.border}` }}>
                <div className="text-2xl mb-1">{s.icon}</div>
                <div className="text-xs text-slate-400 font-semibold uppercase tracking-wide">{s.label}</div>
                <div className="text-lg font-bold text-white mt-1">{s.value}</div>
                <div className="text-sm text-slate-300">{s.sub}</div>
              </motion.div>
            ))}
          </motion.div>
        )}

        {/* Score Evolution Chart */}
        {session.scoreHistory && Object.keys(session.scoreHistory).length > 0 && (
          <div className="mt-8 max-w-[800px] w-full">
            <ScoreChart scoreHistory={session.scoreHistory} players={players} />
          </div>
        )}
      </div>
    )
  }

  // === BETTING PHASE ===
  if (status === 'betting') {
    const betCount = Object.keys(session.bets || {}).length
    return (
      <div className="screen-bg-question min-h-screen flex flex-col items-center justify-center tv-safe">
        <div className="text-[100px] mb-6">🎰</div>
        <h1 className="text-[clamp(2rem,5vw,4rem)] font-black text-emerald-400 mb-4 drop-shadow-lg">Question Pari !</h1>
        <p className="text-[clamp(1rem,2.5vw,1.5rem)] text-slate-300 mb-8">Misez vos points sur la prochaine question !</p>
        <div className="text-2xl text-slate-400">{betCount}/{playerList.length} paris placés</div>
      </div>
    )
  }

  // === DESTINY WHEEL PHASE ===
  if (status === 'destinyWheel' && session.destinyPlayer) {
    const chosen = players[session.destinyPlayer]
    return (
      <div className="screen-bg-question min-h-screen flex flex-col items-center justify-center tv-safe relative overflow-hidden">
        {/* Spinning background */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
          className="absolute w-[800px] h-[800px] pointer-events-none"
          style={{ background: 'conic-gradient(from 0deg, rgba(239,68,68,0.1), rgba(245,158,11,0.1), rgba(16,185,129,0.1), rgba(59,130,246,0.1), rgba(139,92,246,0.1), rgba(239,68,68,0.1))', borderRadius: '50%', filter: 'blur(40px)' }}
        />

        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', damping: 8 }}
          className="relative z-10 text-center">
          <motion.div animate={{ rotate: [0, 10, -10, 0] }} transition={{ repeat: Infinity, duration: 0.8, delay: 0.5 }}
            className="text-[clamp(5rem,10vw,9rem)] mb-4">🎰</motion.div>
          <h1 className="text-[clamp(2rem,5vw,4rem)] font-black text-red-400 mb-6">ROUE DU DESTIN !</h1>
        </motion.div>

        {/* Player reveal with dramatic delay */}
        <motion.div initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 1.5, type: 'spring', damping: 8 }}
          className="relative z-10 bg-white/5 rounded-3xl px-12 py-8 border-2 border-red-500/40 text-center">
          <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ repeat: Infinity, duration: 1.5 }}
            className="text-[clamp(4rem,8vw,7rem)] mb-3">{chosen?.avatar || '?'}</motion.div>
          <div className="text-[clamp(1.5rem,3vw,2.5rem)] font-black text-white mb-2">{chosen?.name || '?'}</div>
          <div className="text-red-400 font-bold text-lg">doit répondre SEUL !</div>
          <div className="text-amber-400 font-bold mt-2">✨ Double ou rien !</div>
        </motion.div>
      </div>
    )
  }

  // === BONUS WHEEL PHASE ===
  if (status === 'bonusWheel') {
    return (
      <div className="screen-bg-question min-h-screen flex flex-col items-center justify-center tv-safe">
        <h1 className="text-[clamp(2rem,5vw,3.5rem)] font-black text-cyan-400 mb-8 drop-shadow-lg">🎲 Roue Bonus !</h1>
        <div className="transform scale-150">
          <BonusWheel autoSpin onResult={() => {}} />
        </div>
      </div>
    )
  }

  // === CATEGORY PICK ===
  if (status === 'categoryPick' && session.categoryPickData) {
    const picker = playerMap[session.categoryPickData.pickerId]
    const chosen = session.categoryPickData.chosen
    return (
      <div className="screen-bg-lobby min-h-screen flex flex-col items-center justify-center tv-safe">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring' }} className="text-center">
          <div className="text-[clamp(4rem,10vw,8rem)] mb-4">👑</div>
          <div className="text-[clamp(3rem,6vw,5rem)]">{picker?.avatar || '?'}</div>
          <div className="text-[clamp(1.5rem,3vw,2.5rem)] font-black text-amber-400 mt-4">
            {chosen ? `A choisi : ${chosen}` : `${picker?.name || '?'} choisit la catégorie...`}
          </div>
          {!chosen && (
            <div className="flex gap-4 mt-8 justify-center flex-wrap">
              {session.categoryPickData.categories.map(cat => (
                <div key={cat} className="px-6 py-3 rounded-2xl bg-amber-500/10 border-2 border-amber-500/30 text-[clamp(1rem,2vw,1.5rem)] font-bold text-amber-300">
                  📂 {cat}
                </div>
              ))}
            </div>
          )}
          {chosen && (
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.3, type: 'spring' }}
              className="mt-6 text-[clamp(2rem,5vw,4rem)] font-black text-brand">
              📂 {chosen}
            </motion.div>
          )}
        </motion.div>
      </div>
    )
  }

  // === DUEL INTRO ===
  if (status === 'duelIntro' && session.duel) {
    const duel = session.duel
    const round = duel.rounds[duel.currentRound]
    const match = round[duel.currentMatch]
    const p1 = playerMap[match.player1]
    const p2 = match.player2 ? playerMap[match.player2] : null
    const roundNames = ['🏟️ Tour 1', '⚔️ Quarts', '🔥 Demis', '🏆 FINALE']
    const roundName = roundNames[Math.min(duel.currentRound, roundNames.length - 1)]

    return (
      <div className="screen-bg-lobby min-h-screen flex flex-col items-center justify-center tv-safe">
        <div className="text-[clamp(1rem,2vw,1.5rem)] text-slate-400 uppercase font-bold mb-6 tracking-widest">{roundName}</div>
        <div className="flex items-center justify-center gap-[clamp(2rem,8vw,6rem)]">
          <motion.div initial={{ x: -100, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ type: 'spring' }} className="text-center">
            <div className="text-[clamp(4rem,10vw,8rem)]">{p1?.avatar || '?'}</div>
            <div className="text-[clamp(1.2rem,3vw,2rem)] font-black mt-2 drop-shadow-lg">{p1?.name || '?'}</div>
          </motion.div>
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.3, type: 'spring' }}
            className="text-[clamp(3rem,8vw,6rem)] font-black text-brand drop-shadow-lg"
          >⚔️</motion.div>
          <motion.div initial={{ x: 100, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ type: 'spring' }} className="text-center">
            <div className="text-[clamp(4rem,10vw,8rem)]">{p2?.avatar || '👤'}</div>
            <div className="text-[clamp(1.2rem,3vw,2rem)] font-black mt-2 drop-shadow-lg">{p2?.name || 'Bye'}</div>
          </motion.div>
        </div>

        {/* Mini bracket */}
        <div className="mt-10 flex gap-3 flex-wrap justify-center">
          {round.map((m, mi) => {
            const mp1 = playerMap[m.player1]
            const mp2 = m.player2 ? playerMap[m.player2] : null
            const isCurrent = mi === duel.currentMatch
            return (
              <div key={mi} className={`px-3 py-1.5 rounded-xl text-sm font-bold ${isCurrent ? 'bg-brand/20 border-2 border-brand text-brand' : m.winner ? 'bg-white/5 text-slate-500' : 'bg-white/5 text-slate-400'}`}>
                {mp1?.name?.slice(0, 8) || '?'} vs {mp2?.name?.slice(0, 8) || 'bye'}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // === DUEL RESULT ===
  if (status === 'duelResult' && session.duelMatchResult) {
    const r = session.duelMatchResult
    const p1 = playerMap[r.player1]
    const p2 = playerMap[r.player2]
    const pw = playerMap[r.winner]
    return (
      <div className="screen-bg-podium min-h-screen flex flex-col items-center justify-center tv-safe">
        <div className="flex items-center justify-center gap-[clamp(2rem,8vw,6rem)] mb-8">
          <motion.div initial={{ scale: 0.8 }} animate={{ scale: r.winner === r.player1 ? 1.1 : 0.7, opacity: r.winner === r.player1 ? 1 : 0.4 }}
            transition={{ type: 'spring' }} className="text-center"
          >
            <div className="text-[clamp(3rem,8vw,6rem)]">{p1?.avatar}</div>
            <div className="text-[clamp(1rem,2.5vw,1.5rem)] font-black mt-1 drop-shadow-lg">{p1?.name}</div>
            <div className={`text-lg mt-1 font-bold ${r.correct1 ? 'text-accent-green' : 'text-accent-red'}`}>
              {r.correct1 ? '✅' : '❌'} {r.time1 ? `${r.time1.toFixed(1)}s` : ''}
            </div>
          </motion.div>
          <div className="text-[clamp(2rem,5vw,4rem)] font-black text-brand">VS</div>
          <motion.div initial={{ scale: 0.8 }} animate={{ scale: r.winner === r.player2 ? 1.1 : 0.7, opacity: r.winner === r.player2 ? 1 : 0.4 }}
            transition={{ type: 'spring' }} className="text-center"
          >
            <div className="text-[clamp(3rem,8vw,6rem)]">{p2?.avatar}</div>
            <div className="text-[clamp(1rem,2.5vw,1.5rem)] font-black mt-1 drop-shadow-lg">{p2?.name}</div>
            <div className={`text-lg mt-1 font-bold ${r.correct2 ? 'text-accent-green' : 'text-accent-red'}`}>
              {r.correct2 ? '✅' : '❌'} {r.time2 ? `${r.time2.toFixed(1)}s` : ''}
            </div>
          </motion.div>
        </div>
        <motion.div initial={{ scale: 0, y: 20 }} animate={{ scale: 1, y: 0 }} transition={{ delay: 0.5, type: 'spring' }}>
          <div className="text-[clamp(1.5rem,4vw,3rem)] font-black text-brand drop-shadow-lg">
            🎉 {pw?.name} gagne !
          </div>
        </motion.div>
      </div>
    )
  }

  // === ROUND INTRO ===
  if (status === 'roundIntro' && session.roundIntroData) {
    const { roundNum, category, prevCategory, roundScores } = session.roundIntroData
    const roundSorted = roundScores ? Object.entries(roundScores)
      .map(([pid, score]) => ({ pid, score, name: players[pid]?.name || pid, avatar: players[pid]?.avatar || '?' }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5) : []

    return (
      <div className="screen-bg-podium min-h-screen flex flex-col items-center justify-center tv-safe relative overflow-hidden">
        {/* Background beams */}
        {[0,1,2,3].map(i => (
          <motion.div key={i}
            animate={{ rotate: [-15 + i*10, 15 + i*10, -15 + i*10], opacity: [0, 0.2, 0] }}
            transition={{ duration: 3, delay: i * 0.3, repeat: Infinity }}
            className="absolute pointer-events-none"
            style={{
              top: '-20%', left: `${15 + i * 20}%`, width: '6px', height: '150%',
              background: `linear-gradient(180deg, ${['#f59e0b','#8b5cf6','#06b6d4','#ec4899'][i]}, transparent)`,
              filter: 'blur(30px)', transformOrigin: 'top center',
            }}
          />
        ))}

        {/* Previous round recap */}
        {prevCategory && roundSorted.length > 0 && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
            className="relative z-10 mb-8 text-center">
            <div className="text-slate-500 text-sm font-bold tracking-widest uppercase mb-3">
              Résultat — {prevCategory}
            </div>
            <div className="flex gap-3 justify-center">
              {roundSorted.map((p, i) => (
                <motion.div key={p.pid} initial={{ scale: 0 }} animate={{ scale: 1 }}
                  transition={{ delay: 0.3 + i * 0.1, type: 'spring' }}
                  className="bg-white/5 rounded-xl px-4 py-2 border border-white/10 text-center min-w-[100px]">
                  <div className="text-lg">{p.avatar}</div>
                  <div className="text-xs font-bold text-white">{p.name}</div>
                  <div className={`text-sm font-black font-mono ${p.score > 0 ? 'text-emerald-400' : 'text-slate-500'}`}>
                    {p.score > 0 ? '+' : ''}{p.score.toLocaleString()}
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* New round announcement */}
        <motion.div initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: prevCategory ? 1.5 : 0, type: 'spring', damping: 10 }}
          className="relative z-10 text-center">
          <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 2, repeat: Infinity }}
            className="text-slate-500 text-lg font-bold tracking-[0.3em] uppercase mb-2">
            ROUND {roundNum}
          </motion.div>
          <div className="text-[clamp(3rem,8vw,6rem)] font-black bg-gradient-to-r from-amber-400 via-brand to-purple-400 bg-clip-text text-transparent drop-shadow-lg">
            {category}
          </div>
          <motion.div initial={{ width: 0 }} animate={{ width: '80%' }}
            transition={{ delay: prevCategory ? 2 : 0.5, duration: 0.6 }}
            className="h-1 bg-gradient-to-r from-transparent via-brand to-transparent mx-auto mt-4"
          />
        </motion.div>

        {/* Progress */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          transition={{ delay: prevCategory ? 2.5 : 1.5 }}
          className="relative z-10 mt-8 text-slate-500 text-sm">
          Question {qIdx + 1} / {quiz.questions.length}
        </motion.div>
      </div>
    )
  }

  // === COUNTDOWN 3-2-1-GO ===
  if (status === 'countdown') {
    const qType = QUESTION_TYPES[q?.type] || {}
    return <Countdown questionText={q?.prompt} questionType={qType.label} />
  }

  // === STEALING PHASE ===
  if (status === 'stealing') {
    return <StealScreen session={session} players={players} />
  }

  // === STEAL REVEAL ===
  if (status === 'stealReveal') {
    return <StealRevealScreen session={session} />
  }

  // === QUESTION ===
  if (!q) return null
  const isRev = status === 'revealing'
  const isPreMedia = status === 'preMedia'
  const ansCount = getAnswerCount()
  const qType = QUESTION_TYPES[q.type] || {}

  // Choice counts for stats
  const choiceCounts = new Array(q.choices?.length || 0).fill(0)
  Object.values(answers).forEach(a => {
    if (a.questionIndex === qIdx) {
      if (Array.isArray(a.selected)) a.selected.forEach(s => { if (choiceCounts[s] !== undefined) choiceCounts[s]++ })
      else if (choiceCounts[a.selected] !== undefined) choiceCounts[a.selected]++
    }
  })

  return (
    <>
    <LiveCommentary session={session} players={players} sorted={sorted} qIdx={qIdx} totalQ={quiz.questions.length} answers={answers} status={status} />

    {/* Dynamic music mood indicator */}
    {(musicMood === 'tense' || musicMood === 'final') && (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="fixed top-4 right-4 z-40 pointer-events-none"
      >
        <motion.div
          animate={musicMood === 'final' ? { scale: [1, 1.2, 1], opacity: [0.7, 1, 0.7] } : { opacity: [0.5, 0.8, 0.5] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className={`px-3 py-1 rounded-full text-xs font-bold ${musicMood === 'final' ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'}`}
        >
          {musicMood === 'final' ? '🔥 DERNIÈRE QUESTION' : '⚡ TENSION'}
        </motion.div>
      </motion.div>
    )}

    <div className="screen-bg-question min-h-screen flex flex-col tv-safe">
      <ReactionOverlay reactions={reactions} />
      {/* TV Transition overlay */}
      {showTransition && (
        <TVTransition
          questionNumber={qIdx + 1}
          totalQuestions={quiz.questions.length}
          category={q?.category}
          onComplete={() => setShowTransition(false)}
        />
      )}
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{qType.icon}</span>
          <span className="text-slate-400 font-semibold">Question {qIdx + 1}/{quiz.questions.length}</span>
          {q.steal && session.teamMode && (
            <span className="text-amber-400 bg-amber-500/15 px-3 py-1 rounded-xl font-bold text-sm border border-amber-500/30">
              🏴‍☠️ VOL — {q.stealPoints || q.points} pts
            </span>
          )}
          {q.mystery && (
            <span className="text-purple-400 bg-purple-500/15 px-3 py-1 rounded-xl font-bold text-sm border border-purple-500/30 animate-pulse">
              ❓ MYSTÈRE — Points x2 !
            </span>
          )}
          {q.bet && (
            <span className="text-emerald-400 bg-emerald-500/15 px-3 py-1 rounded-xl font-bold text-sm border border-emerald-500/30">
              🎰 PARI
            </span>
          )}
          {session.bonusMultiplier > 1 && (
            <span className="text-cyan-400 bg-cyan-500/15 px-3 py-1 rounded-xl font-bold text-sm border border-cyan-500/30 animate-pulse">
              🎲 BONUS x{session.bonusMultiplier}
            </span>
          )}
          {q.category && (
            <span className="text-slate-300 bg-white/10 px-3 py-1 rounded-xl text-sm">
              📂 {q.category}
            </span>
          )}
        </div>
        <div className="flex items-center gap-4">
          <span className="text-slate-400">{ansCount}/{playerList.length} réponses</span>
          {session.gameMode === 'suddenDeath' && (
            <AliveCounter alive={getAliveCount()} total={playerList.length} />
          )}
          {!isRev && (
            <span className={`text-[clamp(1.5rem,3vw,3rem)] font-black font-mono ${timer.isUrgent ? 'text-accent-red' : 'text-brand'}`}>
              {timer.timeLeft}
            </span>
          )}
        </div>
      </div>

      {!isRev && !isPreMedia && <TimerBar progress={timer.progress} isUrgent={timer.isUrgent} size="large" />}
      {isPreMedia && (
        <div className="h-3 w-full bg-white/5 rounded-full overflow-hidden">
          <div className="h-full bg-accent-purple/50 rounded-full animate-pulse" style={{ width: '60%' }} />
        </div>
      )}

      {/* Question + Choices — use flex-1 with start alignment instead of center to prevent TV overflow */}
      <div className="flex-1 flex flex-col items-center pt-6 pb-4">
        {q.type === 'karaoke' && isPreMedia ? (
          /* Karaoke phase 1: music plays during preMedia */
          <div className="text-center max-w-[1000px] mb-6">
            <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1.5 }}
              className="text-[clamp(4rem,8vw,7rem)] mb-4">🎤</motion.div>
            {q.media && q.media.url && (
              <div className="w-full max-w-[500px] mx-auto mb-4">
                <MediaPlayer media={q.media} autoPlay={true} blindMode={true} large />
              </div>
            )}
            <div className="text-[clamp(1.5rem,3vw,2.5rem)] font-black text-purple-400">
              🎵 Écoutez l'extrait...
            </div>
            <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 2 }}
              className="text-slate-500 text-lg mt-3">Les paroles arrivent après !</motion.div>
          </div>
        ) : q.type === 'karaoke' ? (
          /* Karaoke phase 2: lyrics with blanks during running/revealing */
          <div className="text-center max-w-[1000px] mb-6">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring' }}
              className="text-5xl mb-4">🎤</motion.div>
            <div className="text-slate-400 text-sm mb-3 font-bold">Complétez les paroles !</div>
            <div className="text-[clamp(1.5rem,3.5vw,3rem)] font-extrabold leading-relaxed">
              {q.prompt.split('___').map((part, i, arr) => {
                const answers = Array.isArray(q.correctAnswer) ? q.correctAnswer : String(q.correctAnswer).split(',')
                return (
                <span key={i}>
                  <span className="text-white">{part}</span>
                  {i < arr.length - 1 && (
                    isRev ? (
                      <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', delay: 0.5 }}
                        className="inline-block mx-2 px-4 py-1 bg-emerald-500/20 rounded-xl border-b-4 border-emerald-500 font-black text-emerald-400"
                      >
                        {answers[i] || answers[0] || '?'}
                      </motion.span>
                    ) : (
                      <motion.span
                        animate={{ opacity: [0.3, 1, 0.3], color: ['#a855f7', '#f59e0b', '#a855f7'] }}
                        transition={{ repeat: Infinity, duration: 1.5, delay: i * 0.3 }}
                        className="inline-block mx-2 px-3 py-1 bg-purple-500/20 rounded-xl border-b-4 border-purple-500 font-black"
                      >
                        &nbsp;?????&nbsp;
                      </motion.span>
                    )
                  )}
                </span>
              )})}
            </div>
          </div>
        ) : (
        <div className="text-[clamp(1.3rem,3.5vw,2.8rem)] font-extrabold text-center max-w-[1000px] leading-snug mb-6 drop-shadow-md">
          {/* Chain hint — show previous answer as clue */}
          {q.chainHint && qIdx > 0 && (() => {
            const prevQ = quiz.questions[qIdx - 1]
            const prevAnswer = prevQ?.type === 'qcm' || prevQ?.type === 'truefalse'
              ? prevQ.choices?.[prevQ.correctAnswer]
              : String(prevQ?.correctAnswer || '')
            return prevAnswer ? (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                className="text-sm font-bold text-amber-400 mb-3 tracking-wider uppercase">
                🔗 Indice : la réponse précédente était « {prevAnswer} »
              </motion.div>
            ) : null
          })()}
          {q.prompt}
        </div>
        )}

        {/* Media on screen (skip for karaoke — already rendered above) */}
        {q.media && q.media.url && q.type !== 'karaoke' && (
          <div className="w-full max-w-[700px] mb-8">
            {isPreMedia ? (
              // Pre-media: for Spotify, show the player so Host can click play
              // For others, show "get ready" animation
              (q.media.type === 'spotify' || q.media.url?.includes('spotify.com')) ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center">
                  {/* Show Spotify player so Host can hit play */}
                  <div className="w-full max-w-[500px] mb-4">
                    <MediaPlayer media={q.media} autoPlay={false} blindMode={q.type === 'blindtest'} large />
                  </div>
                  <motion.div animate={{ opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 1.5 }}
                    className="text-xl font-bold text-green-400 text-center">
                    👆 Appuyez sur ▶ Play ci-dessus
                  </motion.div>
                  <div className="text-slate-500 text-sm mt-2">
                    Puis lancez le timer depuis la console Host
                  </div>
                </motion.div>
              ) : (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="flex flex-col items-center justify-center py-8">
                  <motion.div animate={{ scale: [1, 1.15, 1] }} transition={{ repeat: Infinity, duration: 1.2 }}
                    className="text-7xl mb-4">{q.type === 'blindtest' ? '🎵' : '📎'}</motion.div>
                  <div className="text-2xl font-bold text-slate-400">Préparez-vous...</div>
                </motion.div>
              )
            ) : q.type === 'blindtest' && q.blindtestMode === 'pixel' ? (
              /* Pixel mode — image with blur filter based on revealLevel */
              <div className="relative">
                <div style={{ filter: `blur(${[40, 25, 15, 6, 0][session.revealLevel || 0]}px)`, transition: 'filter 1s ease-out' }}>
                  <MediaPlayer media={q.media} autoPlay={false} blindMode={false} large />
                </div>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="absolute top-3 right-3 bg-black/60 backdrop-blur-sm rounded-xl px-4 py-2 text-sm font-bold"
                >
                  <span className="text-purple-400">{['💎 Ultra flou', '🔷 Très flou', '🔶 Flou', '🟡 Léger flou', '✨ Net'][session.revealLevel || 0]}</span>
                  <span className="text-slate-400 ml-2">— {[1000, 800, 600, 400, 200][session.revealLevel || 0]} pts</span>
                </motion.div>
              </div>
            ) : q.type === 'blindtest' && q.blindtestMode === 'progressive' ? (
              /* Progressive mode — show level indicator */
              <div>
                <MediaPlayer media={q.media} autoPlay={status === 'running'} blindMode={true} large />
                <motion.div
                  key={session.revealLevel || 0}
                  initial={{ scale: 1.3, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="text-center mt-2"
                >
                  <span className="bg-purple-500/20 border border-purple-500/30 rounded-xl px-5 py-2 text-lg font-bold text-purple-300 inline-block">
                    🎵 Extrait {['2s', '5s', '10s', '20s'][session.revealLevel || 0]} — {[1000, 750, 500, 250][session.revealLevel || 0]} pts
                  </span>
                </motion.div>
              </div>
            ) : q.type === 'zoom' && q.media ? (
              /* Zoom mode — image zoomed in with CSS transform */
              <div className="relative overflow-hidden rounded-2xl" style={{ maxHeight: '500px' }}>
                <div style={{
                  transform: `scale(${[8, 5, 3, 1.5, 1][session.revealLevel || 0]})`,
                  transition: 'transform 1.5s ease-out',
                  transformOrigin: 'center center',
                }}>
                  <MediaPlayer media={q.media} autoPlay={false} blindMode={false} large />
                </div>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="absolute top-3 right-3 bg-black/60 backdrop-blur-sm rounded-xl px-4 py-2 text-sm font-bold"
                >
                  <span className="text-pink-400">{['🔬 Zoom x8', '🔍 Zoom x5', '👀 Zoom x3', '📷 Zoom x1.5', '🖼️ Normal'][session.revealLevel || 0]}</span>
                  <span className="text-slate-400 ml-2">— {[1000, 800, 600, 400, 200][session.revealLevel || 0]} pts</span>
                </motion.div>
              </div>
            ) : q.type === 'blindtest' && q.blindtestMode === 'reverse' && (!q.reverseAnswerMode || q.reverseAnswerMode === 'buzzer') ? (
              /* Reverse mode buzzer — play media with "reversed" visual indicator */
              <div className="relative">
                <MediaPlayer media={q.media} autoPlay={status === 'running'} blindMode={true} large />
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center mt-3"
                >
                  <motion.span
                    animate={{ rotate: [0, 360] }}
                    transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                    className="inline-block text-4xl"
                  >🔄</motion.span>
                  <div className="bg-rose-500/20 border border-rose-500/30 rounded-xl px-5 py-2 text-lg font-bold text-rose-300 inline-block mt-2">
                    🔄 AUDIO INVERSÉ — Buzzez quand vous reconnaissez !
                  </div>
                </motion.div>
              </div>
            ) : q.type === 'blindtest' && q.blindtestMode === 'reverse' ? (
              /* Reverse mode text/qcm — play media with indicator */
              <div className="relative">
                <MediaPlayer media={q.media} autoPlay={status === 'running'} blindMode={true} large />
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center mt-3"
                >
                  <motion.span
                    animate={{ rotate: [0, 360] }}
                    transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                    className="inline-block text-4xl"
                  >🔄</motion.span>
                  <div className="bg-rose-500/20 border border-rose-500/30 rounded-xl px-5 py-2 text-lg font-bold text-rose-300 inline-block mt-2">
                    🔄 AUDIO INVERSÉ — {q.reverseAnswerMode === 'qcm' ? 'Choisissez la bonne réponse !' : 'Tapez votre réponse !'}
                  </div>
                </motion.div>
              </div>
            ) : (
              <MediaPlayer media={q.media} autoPlay={status === 'running'} blindMode={q.type === 'blindtest'} large />
            )}
          </div>
        )}

        {/* Choices grid (for QCM/multi/truefalse/blindtest-qcm/reverse-qcm only — hidden during preMedia) */}
        {!isPreMedia && q.choices && q.choices.length > 0 && !(q.type === 'blindtest' && q.blindtestMode && q.blindtestMode !== 'qcm' && !(q.blindtestMode === 'reverse' && q.reverseAnswerMode === 'qcm')) && q.type !== 'order' && q.type !== 'match' && q.type !== 'zoom' && (
          <div className="grid grid-cols-2 gap-4 w-full max-w-[1000px]">
            {q.choices.map((choice, idx) => {
              const isCorrect = q.type === 'multi' ? q.correctAnswer.includes(idx) : idx === q.correctAnswer
              const pct = playerList.length > 0 ? Math.round((choiceCounts[idx] / playerList.length) * 100) : 0
              return (
                <div key={idx}
                  className="relative rounded-2xl flex flex-col items-center justify-center overflow-hidden transition-all duration-300"
                  style={{
                    padding: 'clamp(12px, 2.5vw, 32px)',
                    minHeight: 'clamp(60px, 10vw, 120px)',
                    background: isRev ? (isCorrect ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.02)') : CHOICE_COLORS[idx] + '20',
                    border: `3px solid ${isRev ? (isCorrect ? '#10b981' : 'rgba(255,255,255,0.06)') : CHOICE_COLORS[idx] + '70'}`,
                    opacity: isRev && !isCorrect ? 0.35 : 1,
                  }}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-[clamp(1rem,2vw,1.5rem)] opacity-70" style={{ color: CHOICE_COLORS[idx] }}>{CHOICE_SHAPES[idx]}</span>
                    <span className="text-[clamp(1rem,2.5vw,1.8rem)] font-bold">{choice}</span>
                    {isRev && isCorrect && <span className="text-xl">✅</span>}
                  </div>
                  {isRev && (
                    <>
                      <div className="mt-2 text-slate-400 font-semibold text-sm">{pct}% ({choiceCounts[idx]})</div>
                      <div className="absolute bottom-0 left-0 h-1 rounded-full animate-bar-grow"
                        style={{ width: `${pct}%`, background: isCorrect ? '#10b981' : CHOICE_COLORS[idx] }}
                      />
                    </>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Estimate display */}
        {(q.type === 'estimate' || (q.type === 'blindtest' && q.blindtestMode === 'estimate')) && isRev && (
          <div className="text-center mt-8">
            <div className="text-slate-400 text-lg mb-2">La bonne réponse était</div>
            <div className="text-5xl font-black text-brand font-mono">{q.correctAnswer}</div>
          </div>
        )}

        {/* Geo reveal — show target + player pins */}
        {q.type === 'geo' && isRev && q.geoTarget && (
          <div className="mt-6 max-w-[700px] w-full mx-auto">
            <div className="text-center text-slate-400 text-lg mb-3">📍 La bonne réponse</div>
            <div className="flex flex-wrap gap-3 justify-center">
              {revealResults && Object.entries(revealResults).filter(([,r]) => r.distanceKm !== undefined).sort(([,a],[,b]) => (a.distanceKm || 99999) - (b.distanceKm || 99999)).map(([pid, r], i) => (
                <motion.div key={pid} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: i * 0.1 }}
                  className={`rounded-xl px-4 py-2 text-center border ${i === 0 ? 'bg-emerald-500/15 border-emerald-500/30' : 'bg-white/5 border-white/10'}`}>
                  <div className="flex items-center gap-2 justify-center">
                    <span className="text-lg">{players[pid]?.avatar}</span>
                    <span className="font-bold text-sm">{players[pid]?.name}</span>
                  </div>
                  <div className={`font-mono text-sm font-bold ${i === 0 ? 'text-emerald-400' : 'text-slate-400'}`}>
                    {r.distanceKm?.toLocaleString()} km
                  </div>
                  {r.score > 0 && <div className="text-xs text-brand">+{r.score}</div>}
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Order — show correct order during reveal */}
        {q.type === 'order' && (
          <div className="w-full max-w-[700px] mt-4">
            <div className="text-center text-slate-400 text-sm mb-3">{isRev ? '✅ Le bon ordre :' : '📊 Remettez dans l\'ordre !'}</div>
            <div className="flex flex-col gap-2">
              {(q.orderItems || []).map((item, idx) => (
                <motion.div key={idx} initial={isRev ? { x: -50, opacity: 0 } : {}} animate={{ x: 0, opacity: 1 }} transition={{ delay: isRev ? idx * 0.2 : 0 }}
                  className={`flex items-center gap-3 rounded-xl px-5 py-3 border ${isRev ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-white/5 border-white/10'}`}>
                  <span className={`text-xl font-black ${isRev ? 'text-emerald-400' : 'text-orange-400'}`}>{idx + 1}</span>
                  <span className={`text-lg font-bold ${isRev ? 'text-white' : 'text-slate-400'}`}>
                    {isRev ? item : '???'}
                  </span>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Match — show pairs during reveal */}
        {q.type === 'match' && (
          <div className="w-full max-w-[700px] mt-4">
            <div className="text-center text-slate-400 text-sm mb-3">{isRev ? '✅ Les bonnes associations :' : '🔗 Associez les paires !'}</div>
            <div className="flex flex-col gap-2">
              {(q.matchPairs || []).map((pair, idx) => (
                <motion.div key={idx} initial={isRev ? { scale: 0.8, opacity: 0 } : {}} animate={{ scale: 1, opacity: 1 }} transition={{ delay: isRev ? idx * 0.2 : 0 }}
                  className={`flex items-center gap-3 rounded-xl px-5 py-3 border ${isRev ? 'bg-cyan-500/10 border-cyan-500/30' : 'bg-white/5 border-white/10'}`}>
                  <span className={`flex-1 text-lg font-bold ${isRev ? 'text-white' : 'text-slate-400'}`}>
                    {pair.left}
                  </span>
                  <span className="text-cyan-400 text-xl">↔</span>
                  <span className={`flex-1 text-lg font-bold text-right ${isRev ? 'text-cyan-300' : 'text-slate-500'}`}>
                    {isRev ? pair.right : '???'}
                  </span>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Buzzer display - BIG visible on projector (hidden during preMedia) */}
        {!isPreMedia && ( q.type === 'buzzer' || q.type === 'zoom' || (q.type === 'blindtest' && (q.blindtestMode === 'buzzer' || q.blindtestMode === 'progressive' || q.blindtestMode === 'pixel' || (q.blindtestMode === 'reverse' && (!q.reverseAnswerMode || q.reverseAnswerMode === 'buzzer')))) ) && !isRev && !session.buzzerWinner && (
          <div className="text-[120px] mt-6">🔔</div>
        )}
        {( q.type === 'buzzer' || q.type === 'zoom' || (q.type === 'blindtest' && (q.blindtestMode === 'buzzer' || q.blindtestMode === 'progressive' || q.blindtestMode === 'pixel' || (q.blindtestMode === 'reverse' && (!q.reverseAnswerMode || q.reverseAnswerMode === 'buzzer')))) ) && session.buzzerWinner && !isRev && (
          <motion.div initial={{ scale: 0, rotate: -10 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', damping: 8 }}
            className="text-center mt-8">
            <div className="text-[80px] mb-4">{players[session.buzzerWinner]?.avatar || '⚡'}</div>
            <div className="text-[clamp(2rem,5vw,4rem)] font-black text-accent-cyan mb-2">
              {players[session.buzzerWinner]?.name || '?'}
            </div>
            <div className="text-xl text-slate-400">a buzzé en premier !</div>
            {players[session.buzzerWinner]?.team && (
              <div className="mt-2 text-lg" style={{ color: TEAM_COLORS.find(t => t.id === players[session.buzzerWinner]?.team)?.color }}>
                {TEAM_COLORS.find(t => t.id === players[session.buzzerWinner]?.team)?.emoji} {TEAM_COLORS.find(t => t.id === players[session.buzzerWinner]?.team)?.name}
              </div>
            )}
            <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 2 }}
              className="text-slate-500 mt-4 text-lg">Le joueur répond à voix haute...</motion.div>
          </motion.div>
        )}

        {/* Penalized buzzer players */}
        {( q.type === 'buzzer' || q.type === 'zoom' || (q.type === 'blindtest' && (q.blindtestMode === 'buzzer' || q.blindtestMode === 'progressive' || q.blindtestMode === 'pixel' || (q.blindtestMode === 'reverse' && (!q.reverseAnswerMode || q.reverseAnswerMode === 'buzzer')))) ) && (session.buzzerPenalized || []).length > 0 && !isRev && (
          <div className="mt-4 text-center">
            <span className="text-accent-red text-sm">Éliminés du buzz : {session.buzzerPenalized.map(pid => players[pid]?.name || '?').join(', ')}</span>
          </div>
        )}
      </div>
    </div>
    </>
  )
}

// === STEAL SCREEN (separate from question screen) ===
function StealScreen({ session, players }) {
  const sd = session.stealData
  if (!sd) return null

  return (
    <div className="screen-bg min-h-screen flex flex-col items-center justify-center tv-safe">
      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring' }}>
        <div className="text-[100px] mb-6">🏴‍☠️</div>
      </motion.div>
      <h1 className="text-[clamp(2rem,5vw,4rem)] font-black text-amber-400 mb-4">PHASE DE VOL !</h1>
      <div className="text-xl text-slate-400 mb-8">{sd.stealPoints} points en jeu</div>

      <div className="space-y-4 w-full max-w-[600px]">
        {sd.winningTeams.map((tid, i) => {
          const tc = TEAM_COLORS.find(t => t.id === tid)
          const choice = sd.steals?.[tid]
          const targetTc = choice ? TEAM_COLORS.find(t => t.id === choice) : null
          const isCurrent = i === sd.currentStealerIndex && !choice

          return (
            <motion.div key={tid}
              initial={{ x: -50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: i * 0.2 }}
              className={`flex items-center justify-between px-6 py-4 rounded-2xl text-lg ${isCurrent ? 'bg-amber-500/20 border-2 border-amber-500' : 'bg-white/5 border border-white/10'}`}
            >
              <div className="flex items-center gap-3">
                <span className="text-3xl">{tc?.emoji}</span>
                <span className="font-bold text-xl" style={{ color: tc?.color }}>{getTeamName(tid, session)}</span>
              </div>
              {choice ? (
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="flex items-center gap-2 text-amber-400 font-bold">
                  → vole {targetTc?.emoji} {targetTc?.name}
                </motion.div>
              ) : isCurrent ? (
                <motion.div animate={{ opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 1.5 }}
                  className="text-amber-400 font-bold">Choisit sa cible... 🎯</motion.div>
              ) : (
                <span className="text-slate-500">En attente</span>
              )}
            </motion.div>
          )
        })}
      </div>

      {/* Vulnerable teams */}
      <div className="mt-8 text-center">
        <div className="text-sm text-slate-500 mb-3">Équipes vulnérables :</div>
        <div className="flex justify-center gap-4">
          {sd.losingTeams.map(tid => {
            const tc = TEAM_COLORS.find(t => t.id === tid)
            const isTargeted = Object.values(sd.steals || {}).includes(tid)
            return (
              <motion.div key={tid}
                animate={isTargeted ? { x: [-3, 3, -3] } : {}}
                transition={isTargeted ? { repeat: Infinity, duration: 0.3 } : {}}
                className={`text-xl px-5 py-3 rounded-xl ${isTargeted ? 'bg-accent-red/20 border border-accent-red/40' : 'bg-white/5 border border-white/10'}`}
              >
                <span className="text-2xl">{tc?.emoji}</span> <span style={{ color: tc?.color }}>{getTeamName(tid, session)}</span>
              </motion.div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// === STEAL REVEAL SCREEN ===
function StealRevealScreen({ session }) {
  const stealLog = session.stealLog || []

  return (
    <div className="screen-bg min-h-screen flex flex-col items-center justify-center tv-safe">
      <motion.div initial={{ scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring' }}>
        <div className="text-[100px] mb-4">💰</div>
      </motion.div>
      <h1 className="text-[clamp(2rem,5vw,4rem)] font-black text-amber-400 mb-8">Vol effectué !</h1>
      <div className="space-y-6 w-full max-w-[700px]">
        {stealLog.map((s, i) => {
          const fromTc = TEAM_COLORS.find(t => t.id === s.from)
          const toTc = TEAM_COLORS.find(t => t.id === s.to)
          return (
            <motion.div key={i}
              initial={{ x: -100, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: i * 0.8, type: 'spring' }}
              className="flex items-center justify-center gap-6 text-2xl"
            >
              <span className="text-3xl" style={{ color: toTc?.color }}>{toTc?.emoji} {getTeamName(s.to, session)}</span>
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: [0, 1.3, 1] }}
                transition={{ delay: i * 0.8 + 0.3 }}
                className="text-amber-400 font-black text-3xl"
              >🏴‍☠️ -{s.points}</motion.span>
              <span className="text-3xl" style={{ color: fromTc?.color }}>{fromTc?.emoji} {getTeamName(s.from, session)}</span>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
